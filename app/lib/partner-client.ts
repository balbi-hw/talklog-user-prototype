/**
 * 학습 짝 초대·음성 메시지의 Supabase 호출 (specs/011-partner-messages/contracts/partner-server.md).
 * 화면은 이 파일을 직접 쓰지 않고 `usePartnerRooms` 를 쓴다. 키가 없으면 모든 호출이 `failed` 다.
 * 시간 상한은 010 과 같이 15초, 소리 올리기만 30초다 (research R5).
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { withTimeout } from "./account";
import {
  INVITE_FAILURES, JOIN_FAILURES, SHARED_ROOM_COLUMNS, VOICE_MESSAGE_COLUMNS, isSharedRoomRow, isVoiceMessageRow,
  type InviteFailure, type JoinFailure, type SharedRoomRow, type VoiceMessageRow,
} from "./partner";

export type CallFailure = "network" | "timeout" | "failed";
type Failed<R extends string = CallFailure> = { ok: false; reason: R | CallFailure };

const BUCKET = "voice-messages";
const CALL_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const SIGNED_URL_SECONDS = 3600;
/** 학습방 하나에서 한 번에 받아 오는 메시지 수 (plan 규모). */
const MESSAGE_LIMIT = 500;

export function partnerClientAvailable(): boolean {
  return createClient() !== null;
}

/** 오류를 이유로 옮긴다. 제공자 원문은 화면에 내보내지 않는다. */
function failureOf(error: unknown): CallFailure {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "network";
  if (!error || typeof error !== "object") return "failed";
  const { name, message, code } = error as { name?: string; message?: string; code?: string };
  if (code === "request_timeout") return "timeout";
  if (name === "TypeError" || /failed to fetch|network|load failed/i.test(message ?? "")) return "network";
  return "failed";
}

function offline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** 서버 함수 호출. 함수는 실패를 예외가 아닌 `{ok:false, reason}` 으로 돌려준다 (research R2). */
async function callRpc<R extends string>(name: string, args: Record<string, unknown>, reasons: readonly R[]):
  Promise<{ ok: true; data: Record<string, unknown> } | Failed<R>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, reason: "failed" };
  if (offline()) return { ok: false, reason: "network" };
  try {
    const { data, error } = await withTimeout(Promise.resolve(supabase.rpc(name, args)), CALL_TIMEOUT_MS);
    if (error) return { ok: false, reason: failureOf(error) };
    if (!data || typeof data !== "object") return { ok: false, reason: "failed" };
    const result = data as Record<string, unknown>;
    if (result.ok === true) return { ok: true, data: result };
    const reason = reasons.find((item) => item === result.reason);
    return { ok: false, reason: reason ?? "failed" };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

export async function ensureSharedRoom(roomId: string, language: string):
  Promise<{ ok: true; sharedRoomId: string } | Failed<InviteFailure>> {
  const result = await callRpc("ensure_shared_room", { p_room_id: roomId, p_language: language }, INVITE_FAILURES);
  if (!result.ok) return result;
  const id = text(result.data.shared_room_id);
  return id ? { ok: true, sharedRoomId: id } : { ok: false, reason: "failed" };
}

export async function createInvite(roomId: string, language: string):
  Promise<{ ok: true; code: string; expiresAt: number } | Failed<InviteFailure>> {
  const result = await callRpc("create_invite", { p_room_id: roomId, p_language: language }, INVITE_FAILURES);
  if (!result.ok) return result;
  const code = text(result.data.code);
  const expiresAt = Date.parse(text(result.data.expires_at));
  return code && !Number.isNaN(expiresAt) ? { ok: true, code, expiresAt } : { ok: false, reason: "failed" };
}

export async function revokeInvite(roomId: string): Promise<{ ok: true } | Failed> {
  const result = await callRpc("revoke_invite", { p_room_id: roomId }, [] as const);
  return result.ok ? { ok: true } : result;
}

/** 내 학습방의 유효 코드 (검증 후 보완 D2). 없으면 code 가 null 이다. */
export async function currentInvite(roomId: string):
  Promise<{ ok: true; code: string | null; expiresAt: number } | Failed> {
  const result = await callRpc("current_invite", { p_room_id: roomId }, [] as const);
  if (!result.ok) return result;
  const code = text(result.data.code);
  const expiresAt = Date.parse(text(result.data.expires_at));
  if (!code) return { ok: true, code: null, expiresAt: 0 };
  return Number.isNaN(expiresAt) ? { ok: false, reason: "failed" } : { ok: true, code, expiresAt };
}

export type InvitePreview = { ownerName: string; language: string };

export async function previewInvite(code: string): Promise<({ ok: true } & InvitePreview) | Failed<JoinFailure>> {
  const result = await callRpc("preview_invite", { p_code: code }, JOIN_FAILURES);
  if (!result.ok) return result;
  return { ok: true, ownerName: text(result.data.owner_name), language: text(result.data.language) };
}

export async function acceptInvite(code: string):
  Promise<({ ok: true; sharedRoomId: string; joined: boolean } & InvitePreview) | Failed<JoinFailure>> {
  const result = await callRpc("accept_invite", { p_code: code }, JOIN_FAILURES);
  if (!result.ok) return result;
  const id = text(result.data.shared_room_id);
  if (!id) return { ok: false, reason: "failed" };
  return { ok: true, sharedRoomId: id, joined: result.data.joined === true,
    ownerName: text(result.data.owner_name), language: text(result.data.language) };
}

/** 이미 멤버가 아니면(`not-member`) 앞선 시도가 닿은 것이므로 나간 것으로 본다. */
export async function leaveSharedRoom(sharedRoomId: string): Promise<{ ok: true; deleted: boolean } | Failed> {
  const result = await callRpc("leave_shared_room", { p_shared_room_id: sharedRoomId }, ["not-member"] as const);
  if (result.ok) return { ok: true, deleted: result.data.deleted === true };
  if (result.reason === "not-member") return { ok: true, deleted: false };
  return { ok: false, reason: result.reason };
}

// ── 조회·넣기 ─────────────────────────────────────────────────────────────

/** RLS 로 내가 멤버인 학습방만 온다. 나간 학습방도 행이 남아 있으면 온다 — 거르는 것은 `toSharedRoom` 이다. */
export async function fetchSharedRooms(): Promise<{ ok: true; rows: SharedRoomRow[] } | Failed> {
  const supabase = createClient();
  if (!supabase) return { ok: false, reason: "failed" };
  if (offline()) return { ok: false, reason: "network" };
  try {
    const { data, error } = await withTimeout(Promise.resolve(supabase.from("shared_rooms").select(SHARED_ROOM_COLUMNS)), CALL_TIMEOUT_MS);
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true, rows: ((data ?? []) as unknown[]).filter(isSharedRoomRow) };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

/** 최근 500개를 받은 시각 순으로 돌려준다. */
export async function fetchMessages(sharedRoomId: string): Promise<{ ok: true; rows: VoiceMessageRow[] } | Failed> {
  const supabase = createClient();
  if (!supabase) return { ok: false, reason: "failed" };
  if (offline()) return { ok: false, reason: "network" };
  try {
    const { data, error } = await withTimeout(Promise.resolve(supabase.from("voice_messages").select(VOICE_MESSAGE_COLUMNS)
      .eq("shared_room_id", sharedRoomId).order("created_at", { ascending: false }).limit(MESSAGE_LIMIT)), CALL_TIMEOUT_MS);
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true, rows: ((data ?? []) as unknown[]).filter(isVoiceMessageRow).reverse() };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

export type NewVoiceMessage = Omit<VoiceMessageRow, "created_at">;

/**
 * 메시지 행을 넣고 서버가 받은 행을 돌려준다. 같은 id 가 이미 있으면(23505) 앞선 시도가 닿은 것이므로
 * 그 행을 다시 읽어 성공으로 본다 (FR-007, research R5). `created_at` 은 보내지 않는다 — 서버 시각이 정렬 기준이다.
 */
export async function insertMessage(message: NewVoiceMessage): Promise<{ ok: true; row: VoiceMessageRow } | Failed> {
  const supabase = createClient();
  if (!supabase) return { ok: false, reason: "failed" };
  if (offline()) return { ok: false, reason: "network" };
  try {
    const inserted = await withTimeout(Promise.resolve(supabase.from("voice_messages").insert(message).select(VOICE_MESSAGE_COLUMNS)), CALL_TIMEOUT_MS);
    if (!inserted.error) {
      const row = ((inserted.data ?? []) as unknown[]).find(isVoiceMessageRow);
      if (row) return { ok: true, row };
    } else if (inserted.error.code !== "23505") {
      return { ok: false, reason: failureOf(inserted.error) };
    }
    const existing = await withTimeout(Promise.resolve(supabase.from("voice_messages").select(VOICE_MESSAGE_COLUMNS)
      .eq("id", message.id).limit(1)), CALL_TIMEOUT_MS);
    if (existing.error) return { ok: false, reason: failureOf(existing.error) };
    const row = ((existing.data ?? []) as unknown[]).find(isVoiceMessageRow);
    return row ? { ok: true, row } : { ok: false, reason: "failed" };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

// ── Storage ───────────────────────────────────────────────────────────────

/** 이미 있다는 응답(409·Duplicate)은 앞선 시도가 올린 것이므로 성공으로 본다. */
function isDuplicate(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, statusCode, code, error: kind } = error as { status?: number; statusCode?: string; code?: string; error?: string };
  return status === 409 || statusCode === "409" || code === "Duplicate" || code === "ResourceAlreadyExists" || kind === "Duplicate";
}

export async function uploadVoice(path: string, blob: Blob, contentType: string): Promise<{ ok: true } | Failed> {
  const supabase = createClient();
  if (!supabase) return { ok: false, reason: "failed" };
  if (offline()) return { ok: false, reason: "network" };
  try {
    const { error } = await withTimeout(supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false }), UPLOAD_TIMEOUT_MS);
    if (error && !isDuplicate(error)) return { ok: false, reason: failureOf(error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

/** 재생·스크립트용 1시간짜리 주소를 한 번에 받는다. 받지 못한 경로는 결과에 없다. */
export async function signVoiceUrls(paths: string[]): Promise<{ ok: true; urls: Map<string, string> } | Failed> {
  const supabase = createClient();
  if (!supabase) return { ok: false, reason: "failed" };
  if (!paths.length) return { ok: true, urls: new Map() };
  if (offline()) return { ok: false, reason: "network" };
  try {
    const { data, error } = await withTimeout(supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS), CALL_TIMEOUT_MS);
    if (error) return { ok: false, reason: failureOf(error) };
    const urls = new Map<string, string>();
    (data ?? []).forEach((item) => { if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl); });
    return { ok: true, urls };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

/**
 * 학습방 폴더의 소리를 지운다. 마지막으로 나가는 사람이 `leave_shared_room` 전에 부른다 (research R4·R8).
 * 실패해도 나가기는 진행한다 — 멤버가 없어진 뒤에는 아무도 읽을 수 없다.
 */
export async function removeVoiceFolder(sharedRoomId: string, senderIds: string[]): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  try {
    const bucket = supabase.storage.from(BUCKET);
    for (const senderId of senderIds) {
      const folder = `${sharedRoomId}/${senderId}`;
      for (;;) {
        const listed = await withTimeout(bucket.list(folder, { limit: 1000 }), CALL_TIMEOUT_MS);
        if (listed.error) return false;
        const paths = (listed.data ?? []).filter((item) => item.id !== null).map((item) => `${folder}/${item.name}`);
        if (!paths.length) break;
        const removed = await withTimeout(bucket.remove(paths), CALL_TIMEOUT_MS);
        if (removed.error) return false;
        if (paths.length < 1000) break;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// ── Realtime ──────────────────────────────────────────────────────────────

export type ChannelStatus = "live" | "lost";
export type PartnerChannelHandlers = {
  onMessage: (row: VoiceMessageRow) => void;
  onSharedRoom: (row: SharedRoomRow) => void;
  onStatus: (status: ChannelStatus) => void;
};

/** 닫는 중인 채널. 같은 이름의 채널은 클라이언트가 재사용하므로, 다 닫힌 뒤에 새로 연다. */
let removing: Promise<unknown> = Promise.resolve();

/**
 * 사용자당 채널 하나로 새 메시지와 학습방 변화를 받는다 (research R6). RLS 가 구독자별로 적용된다.
 * 돌려준 함수로 닫는다. 닫은 뒤에 오는 상태 알림은 무시한다.
 */
export function openPartnerChannel(userId: string, handlers: PartnerChannelHandlers): () => void {
  const supabase = createClient();
  if (!supabase) return () => {};
  let closed = false;
  let channel: RealtimeChannel | null = null;
  void removing.then(() => {
    if (closed) return;
    channel = supabase.channel(`partner:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_messages" }, (payload) => {
        if (!closed && isVoiceMessageRow(payload.new)) handlers.onMessage(payload.new);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shared_rooms" }, (payload) => {
        if (!closed && isSharedRoomRow(payload.new)) handlers.onSharedRoom(payload.new);
      })
      .subscribe((status) => {
        if (closed) return;
        if (status === "SUBSCRIBED") handlers.onStatus("live");
        else handlers.onStatus("lost");
      });
  });
  return () => {
    closed = true;
    const current = channel;
    if (current) removing = supabase.removeChannel(current).catch(() => undefined);
  };
}
