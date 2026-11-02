/**
 * 계정 기록 동기화 (specs/010-account-records/contracts/record-sync.md).
 *
 * 화면은 지금처럼 로컬 저장소에 동기로 쓴다. 계정 범위의 쓰기는 이전 값과 비교해 보낼 변경(대기열)을 남기고,
 * 이 모듈이 그것을 Supabase 로 보낸다. 서버에서 받아 올 때는 서버 값 위에 아직 보내지 못한 변경을 다시 얹는다.
 * 연결이 끊겨도 기록은 로컬에 남고, 연결되면 다시 보낸다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { withTimeout } from "./account";
import { normalizeTerm, parseExpressions } from "./expressions";
import {
  DEVICE_KEYS, RECORD_COLLECTIONS, accountKey, accountPrefix, getRecordScope, notifyRecordsChanged,
  registerRecordSync, setRecordScope, writeRecords, type RecordCollection,
} from "./record-scope";
import { parseReviews, type ReviewRecord } from "./reviews";
import { parseRooms, type Room } from "./rooms";
import type { SavedExpression } from "./types";

export type SyncState = "idle" | "loading" | "syncing" | "offline" | "error";
/** pending: 보낼 변경. rejected: 서버가 받아 주지 않는 변경 — 이 기기 사본에만 남는다. */
export type SyncStatus = { state: SyncState; pending: number; rejected: number };

type Op = { seq: number; collection: RecordCollection; kind: "upsert" | "delete"; id: string; item?: unknown };

const TABLE: Record<RecordCollection, string> = { rooms: "rooms", expressions: "expressions", reviews: "review_records" };
const ID_COLUMN: Record<RecordCollection, string> = { rooms: "id", expressions: "id", reviews: "expression_id" };
const RETRY_MS = { offline: 15_000, error: 60_000 };

let status: SyncStatus = { state: "idle", pending: 0, rejected: 0 };
const statusListeners = new Set<() => void>();
let activeUser: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let pulling = false;
let lastPullAttempt = 0;
// 받아 오기와 보내기는 겹치지 않게 한다. 받아 온 값은 요청 시점의 것이라, 그 사이 보내기가 대기열을 비우면
// 방금 보낸 변경이 다시 얹히지 않아 사라지거나(만들기) 되살아난다(지우기).
let pullAfterFlush = false;
let flushAfterPull = false;

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  statusListeners.forEach((listener) => listener());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}

function idOf(collection: RecordCollection, item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const value = (item as Record<string, unknown>)[collection === "reviews" ? "expressionId" : "id"];
  return typeof value === "string" ? value : null;
}

// ── 대기열 ────────────────────────────────────────────────────────────────

function readOps(userId: string, name: "outbox" | "rejected"): Op[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(accountKey(userId, name)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((op): op is Op => !!op && typeof op === "object" &&
      typeof (op as Op).seq === "number" && RECORD_COLLECTIONS.includes((op as Op).collection) &&
      ((op as Op).kind === "upsert" || (op as Op).kind === "delete") && typeof (op as Op).id === "string");
  } catch {
    return [];
  }
}

const readOutbox = (userId: string) => readOps(userId, "outbox");
const readRejected = (userId: string) => readOps(userId, "rejected");

function writeOps(userId: string, name: "outbox" | "rejected", ops: Op[]): boolean {
  try {
    window.localStorage.setItem(accountKey(userId, name), JSON.stringify(ops));
    if (userId === activeUser) setStatus(name === "outbox" ? { pending: ops.length } : { rejected: ops.length });
    return true;
  } catch {
    return false;
  }
}

const writeOutbox = (userId: string, ops: Op[]) => writeOps(userId, "outbox", ops);

/** 로그아웃하면 사라지는 변경 수. 보낼 변경과 서버가 받아 주지 않은 변경을 함께 센다. */
export function pendingCount(userId: string): number {
  return readOutbox(userId).length + readRejected(userId).length;
}

/** 같은 항목의 변경은 마지막 것만 남긴다. */
function enqueue(userId: string, ops: Omit<Op, "seq">[]) {
  if (!ops.length) return;
  const outbox = readOutbox(userId);
  let seq = outbox.reduce((max, op) => Math.max(max, op.seq), 0);
  const keyOf = (op: { collection: string; id: string }) => `${op.collection}:${op.id}`;
  const incoming = new Set(ops.map(keyOf));
  const next = [...outbox.filter((op) => !incoming.has(keyOf(op))), ...ops.map((op) => ({ ...op, seq: ++seq }))];
  writeOutbox(userId, next);
  // 거부됐던 항목을 다시 고쳤으면 새 변경으로 다시 보낸다.
  const rejected = readRejected(userId);
  if (rejected.some((op) => incoming.has(keyOf(op)))) {
    writeOps(userId, "rejected", rejected.filter((op) => !incoming.has(keyOf(op))));
  }
}

function onWrite(userId: string, collection: RecordCollection, previous: unknown[], next: unknown[]) {
  const before = new Map<string, string>();
  previous.forEach((item) => { const id = idOf(collection, item); if (id) before.set(id, JSON.stringify(item)); });
  const ops: Omit<Op, "seq">[] = [];
  const seen = new Set<string>();
  next.forEach((item) => {
    const id = idOf(collection, item);
    if (!id) return;
    seen.add(id);
    if (before.get(id) !== JSON.stringify(item)) ops.push({ collection, kind: "upsert", id, item });
  });
  before.forEach((_value, id) => { if (!seen.has(id)) ops.push({ collection, kind: "delete", id }); });
  enqueue(userId, ops);
  scheduleFlush();
}

function onReadFailure(userId: string) {
  // 계정 기록을 아직 받아 오지 못한 채 화면이 읽으려 했다. 너무 잦지 않게 다시 받아 온다.
  if (userId !== activeUser || pulling || Date.now() - lastPullAttempt < 5_000) return;
  void pull(userId);
}

registerRecordSync(onWrite, onReadFailure);

// ── 서버 행 변환 ───────────────────────────────────────────────────────────

function toRow(userId: string, collection: RecordCollection, item: unknown): Record<string, unknown> {
  if (collection === "rooms") {
    const room = item as Room;
    return { user_id: userId, id: room.id, partner: room.partner, language: room.language, created_at_ms: room.createdAt };
  }
  if (collection === "expressions") {
    const expression = item as SavedExpression;
    return { user_id: userId, id: expression.id, term: expression.term, meaning: expression.meaning,
      example: expression.example, source_room: expression.sourceRoom, saved_at_ms: expression.savedAt };
  }
  const record = item as ReviewRecord;
  return { user_id: userId, expression_id: record.expressionId, due_date: record.dueDate, interval_days: record.intervalDays,
    known_count: record.knownCount, answer_count: record.answerCount };
}

function fromRow(collection: RecordCollection, row: Record<string, unknown>): unknown {
  if (collection === "rooms") {
    return { id: row.id, partner: row.partner, language: row.language, createdAt: Number(row.created_at_ms) };
  }
  if (collection === "expressions") {
    return { id: row.id, term: row.term, meaning: row.meaning, example: row.example,
      sourceRoom: row.source_room, savedAt: Number(row.saved_at_ms) };
  }
  return { expressionId: row.expression_id, dueDate: row.due_date, intervalDays: row.interval_days,
    knownCount: row.known_count, answerCount: row.answer_count };
}

const SELECT: Record<RecordCollection, string> = {
  rooms: "id,partner,language,created_at_ms",
  expressions: "id,term,meaning,example,source_room,saved_at_ms",
  reviews: "expression_id,due_date,interval_days,known_count,answer_count",
};

/** 값이 테이블 제약을 어겨 다시 보내도 받아 주지 않는 오류 (Postgres 22xxx 데이터 예외, 23xxx 무결성 위반). */
function isRejection(error: unknown): boolean {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && /^2[23]/.test(code);
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message, code } = error as { name?: string; message?: string; code?: string };
  return name === "TypeError" || code === "request_timeout" || /fetch|network/i.test(message ?? "");
}

function scheduleRetry(kind: "offline" | "error", userId: string, task: () => void) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (activeUser === userId) task(); }, RETRY_MS[kind]);
}

// ── 받아 오기 ─────────────────────────────────────────────────────────────

function applyOps<T>(collection: RecordCollection, items: T[], ops: Op[]): T[] {
  let next = [...items];
  ops.filter((op) => op.collection === collection).sort((a, b) => a.seq - b.seq).forEach((op) => {
    next = next.filter((item) => idOf(collection, item) !== op.id);
    if (op.kind === "upsert") next.push(op.item as T);
  });
  return next;
}

async function pull(userId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase || pulling) return false;
  if (flushing) { pullAfterFlush = true; return false; }
  pulling = true;
  lastPullAttempt = Date.now();
  if (status.state !== "syncing") setStatus({ state: "loading" });
  try {
    const results = await Promise.all(RECORD_COLLECTIONS.map((collection) =>
      withTimeout(Promise.resolve(supabase.from(TABLE[collection]).select(SELECT[collection])))));
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    if (activeUser !== userId) return false;
    // 응답을 기다리는 동안 쌓인 변경까지 읽는다. 받아 주지 않은 변경도 이 기기 사본에는 남긴다.
    const outbox = readOutbox(userId);
    const local = [...readRejected(userId), ...outbox];
    RECORD_COLLECTIONS.forEach((collection, index) => {
      const rows = (results[index].data ?? []) as unknown as Record<string, unknown>[];
      const items = applyOps(collection, rows.map((row) => fromRow(collection, row)), local);
      window.localStorage.setItem(accountKey(userId, collection), JSON.stringify(items));
    });
    window.localStorage.setItem(accountKey(userId, "loaded"), String(Date.now()));
    setRecordScope({ kind: "account", userId, loaded: true });
    notifyRecordsChanged();
    setStatus({ state: "idle", pending: outbox.length });
    flushAfterPull = false;
    if (outbox.length) scheduleFlush(0);
    return true;
  } catch (error) {
    if (activeUser !== userId) return false;
    const kind = isNetworkError(error) ? "offline" : "error";
    setStatus({ state: kind });
    scheduleRetry(kind, userId, () => { void pull(userId); });
    return false;
  } finally {
    pulling = false;
    // 받아 오는 동안 미뤄 둔 보내기. 받아 오기가 실패해도 이미 받아 둔 사본이 있으면 보낼 수 있다.
    const scope = getRecordScope();
    if (flushAfterPull && activeUser === userId && scope.kind === "account" && scope.loaded) {
      flushAfterPull = false;
      scheduleFlush(0);
    }
  }
}

// ── 보내기 ────────────────────────────────────────────────────────────────

function scheduleFlush(delay = 400) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flush(); }, delay);
}

type Progress = { sent: Op[]; rejected: Op[] };

async function sendGroup(supabase: SupabaseClient, userId: string, collection: RecordCollection, kind: Op["kind"], ops: Op[]) {
  const table = supabase.from(TABLE[collection]);
  const request = kind === "delete"
    ? table.delete().eq("user_id", userId).in(ID_COLUMN[collection], ops.map((op) => op.id))
    : table.upsert(ops.map((op) => toRow(userId, collection, op.item)), { onConflict: `user_id,${ID_COLUMN[collection]}` });
  const { error } = await withTimeout(Promise.resolve(request));
  return error;
}

/**
 * 삭제 먼저, 그다음 갱신. 같은 항목은 대기열에서 이미 하나로 합쳐졌다.
 * 보낸 것과 거부된 것을 progress 에 남긴다 — 중간에 연결이 끊겨도 이미 보낸 변경은 대기열에서 뺀다.
 */
async function sendOps(supabase: SupabaseClient, userId: string, ops: Op[], progress: Progress) {
  for (const kind of ["delete", "upsert"] as const) {
    for (const collection of RECORD_COLLECTIONS) {
      const group = ops.filter((op) => op.collection === collection && op.kind === kind);
      if (!group.length) continue;
      const error = await sendGroup(supabase, userId, collection, kind, group);
      if (!error) { progress.sent.push(...group); continue; }
      if (!isRejection(error)) throw error;
      // 한 항목이 제약을 어기면 묶음 전체가 거부된다. 하나씩 보내 받아 주지 않는 항목만 가려낸다.
      for (const op of group) {
        const single = await sendGroup(supabase, userId, collection, kind, [op]);
        if (!single) progress.sent.push(op);
        else if (isRejection(single)) progress.rejected.push(op);
        else throw single;
      }
    }
  }
}

export async function flush(): Promise<boolean> {
  const userId = activeUser;
  const supabase = createClient();
  if (!userId || !supabase || flushing) return false;
  if (pulling) { flushAfterPull = true; return false; }
  const ops = readOutbox(userId);
  if (!ops.length) { setStatus({ state: "idle", pending: 0 }); return true; }
  flushing = true;
  setStatus({ state: "syncing", pending: ops.length });
  const progress: Progress = { sent: [], rejected: [] };
  let failure: unknown = null;
  try {
    await sendOps(supabase, userId, ops, progress);
  } catch (error) {
    failure = error;
  } finally {
    flushing = false;
  }

  // 로그아웃했거나 다른 계정으로 바뀌었으면 그 사용자의 사본을 다시 만들지 않는다.
  if (activeUser === userId) {
    // 보내는 동안 새로 쌓인 변경(같은 항목이면 seq 가 바뀐다)은 남긴다.
    const settled = new Set([...progress.sent, ...progress.rejected].map((op) => op.seq));
    const rest = readOutbox(userId).filter((op) => !settled.has(op.seq));
    writeOutbox(userId, rest);
    if (progress.rejected.length) {
      const keyOf = (op: Op) => `${op.collection}:${op.id}`;
      const newer = new Set(rest.map(keyOf));
      const rejected = progress.rejected.filter((op) => !newer.has(keyOf(op)));
      const replaced = new Set(rejected.map(keyOf));
      writeOps(userId, "rejected", [...readRejected(userId).filter((op) => !replaced.has(keyOf(op))), ...rejected]);
    }
    if (failure) {
      const kind = isNetworkError(failure) ? "offline" : "error";
      setStatus({ state: kind });
      scheduleRetry(kind, userId, () => { void flush(); });
    } else {
      setStatus({ state: "idle" });
      if (rest.length) scheduleFlush(0);
    }
  }
  if (pullAfterFlush) {
    pullAfterFlush = false;
    if (activeUser) void pull(activeUser);
  }
  return activeUser === userId && !failure;
}

// ── 시작·끝 ───────────────────────────────────────────────────────────────

/** 로그인 상태가 되면 부른다. 전에 받아 둔 사본이 있으면 바로 보이고, 서버에서 다시 받아 온다. */
export function startAccountRecords(userId: string) {
  if (activeUser === userId) return;
  activeUser = userId;
  let loaded = false;
  try { loaded = window.localStorage.getItem(accountKey(userId, "loaded")) !== null; } catch { loaded = false; }
  setStatus({ state: "loading", pending: readOutbox(userId).length, rejected: readRejected(userId).length });
  setRecordScope({ kind: "account", userId, loaded });
  void pull(userId);
}

/** 로그아웃 상태 또는 로그인을 쓸 수 없는 환경. 기기 기록을 쓴다. */
export function switchToDeviceRecords() {
  activeUser = null;
  if (flushTimer) clearTimeout(flushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  setStatus({ state: "idle", pending: 0, rejected: 0 });
  setRecordScope({ kind: "device" });
}

/** 다시 시도 버튼·연결 복구·창 복귀에서 부른다. */
export function retrySync() {
  const userId = activeUser;
  if (!userId) return;
  const scope = getRecordScope();
  if (scope.kind === "account" && !scope.loaded) void pull(userId);
  else if (readOutbox(userId).length) void flush();
  else void pull(userId);
}

/** 사용자가 로그아웃하면 이 기기에 남은 계정 사본을 지운다 (공용 기기). 보내지 못한 변경도 함께 사라진다. */
export function clearAccountCopy(userId: string) {
  try {
    const prefix = accountPrefix(userId);
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // 지우지 못해도 로그아웃은 진행된다. 다음 로그인 때 서버 값으로 덮인다.
  }
}

// ── 기기 기록 가져오기 ─────────────────────────────────────────────────────

function readDevice(collection: RecordCollection): { ok: true; raw: string | null } | { ok: false } {
  try { return { ok: true, raw: window.localStorage.getItem(DEVICE_KEYS[collection]) }; }
  catch { return { ok: false }; }
}

export type DeviceSummary = { rooms: number; expressions: number };

export function deviceSummary(): DeviceSummary {
  const rooms = parseRooms(readDevice("rooms"));
  const expressions = parseExpressions(readDevice("expressions"));
  return { rooms: rooms.ok ? rooms.items.length : 0, expressions: expressions.ok ? expressions.items.length : 0 };
}

/** 로그아웃 때 지우는 계정 사본과 따로 둔다. 다시 로그인할 때마다 묻지 않기 위해서다. */
const importHandledKey = (userId: string) => `talklog.import-handled.${userId}`;

export function wasImportHandled(userId: string): boolean {
  try { return window.localStorage.getItem(importHandledKey(userId)) !== null; }
  catch { return false; }
}

export type ImportResult =
  | { ok: true; rooms: number; expressions: number; skipped: number }
  | { ok: false; reason: "not-ready" | "storage" };

/**
 * 기기 기록을 계정에 합친다. 기기 기록은 지우지 않는다 — 로그아웃하면 그대로 보인다.
 * 학습방은 id 로, 표현은 정규화한 본문으로 중복을 거른다. 복습 기록은 가져온 표현의 것만 옮긴다.
 */
export function importDeviceRecords(userId: string): ImportResult {
  const scope = getRecordScope();
  if (scope.kind !== "account" || scope.userId !== userId || !scope.loaded) return { ok: false, reason: "not-ready" };
  const deviceRooms = parseRooms(readDevice("rooms"));
  const deviceExpressions = parseExpressions(readDevice("expressions"));
  const accountRooms = parseRooms(readAccount(userId, "rooms"));
  const accountExpressions = parseExpressions(readAccount(userId, "expressions"));
  if (!deviceRooms.ok || !deviceExpressions.ok || !accountRooms.ok || !accountExpressions.ok) return { ok: false, reason: "storage" };
  const deviceReviews = parseReviews(readDevice("reviews"), deviceExpressions.items);
  const accountReviews = parseReviews(readAccount(userId, "reviews"), accountExpressions.items);
  if (!deviceReviews.ok || !accountReviews.ok) return { ok: false, reason: "storage" };

  const roomIds = new Set(accountRooms.items.map((room) => room.id));
  const newRooms = deviceRooms.items.filter((room) => !roomIds.has(room.id));

  const terms = new Set(accountExpressions.items.map((item) => normalizeTerm(item.term)));
  const expressionIds = new Set(accountExpressions.items.map((item) => item.id));
  const newExpressions = deviceExpressions.items.filter((item) => {
    const term = normalizeTerm(item.term);
    if (terms.has(term) || expressionIds.has(item.id)) return false;
    terms.add(term);
    return true;
  });
  const importedIds = new Set(newExpressions.map((item) => item.id));
  const newReviews = deviceReviews.records.filter((record) => importedIds.has(record.expressionId));

  const ok = writeRecords("rooms", [...accountRooms.items, ...newRooms]) &&
    writeRecords("expressions", [...accountExpressions.items, ...newExpressions]) &&
    writeRecords("reviews", [...accountReviews.records, ...newReviews]);
  if (!ok) return { ok: false, reason: "storage" };
  markImportHandled(userId);
  notifyRecordsChanged();
  return { ok: true, rooms: newRooms.length, expressions: newExpressions.length,
    skipped: deviceRooms.items.length - newRooms.length + deviceExpressions.items.length - newExpressions.length };
}

export function markImportHandled(userId: string) {
  try { window.localStorage.setItem(importHandledKey(userId), String(Date.now())); } catch { /* 다음에 다시 묻는다 */ }
}

function readAccount(userId: string, collection: RecordCollection): { ok: true; raw: string | null } | { ok: false } {
  try { return { ok: true, raw: window.localStorage.getItem(accountKey(userId, collection)) }; }
  catch { return { ok: false }; }
}
