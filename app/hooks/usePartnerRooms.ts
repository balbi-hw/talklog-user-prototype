"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseAccountResult } from "./useAccount";
import type { SentRecording } from "./useVoiceRecorder";
import { notifyRecordsChanged, type RecordScope } from "../lib/record-scope";
import { MOCK_ROOM, isRoomLanguage, isValidPartner, normalizePartner, readRooms, writeRooms, type RoomLanguage } from "../lib/rooms";
import {
  isInviteCode, mergeMessages, normalizeInviteCode, timeLabel, toSharedRoom, voiceMimeType, voicePath,
  type ConnectionState, type InviteState, type JoinFailure, type LeaveFailure, type OutgoingMessage,
  type ServerMessage, type SharedRoom, type SharedRoomRow, type VoiceMessageRow,
} from "../lib/partner";
import {
  acceptInvite, createInvite, currentInvite, ensureSharedRoom, fetchMessages, fetchSharedRooms, insertMessage, leaveSharedRoom,
  openPartnerChannel, partnerClientAvailable, previewInvite, removeVoiceFolder, revokeInvite, signVoiceUrls, uploadVoice,
} from "../lib/partner-client";
import type { VoiceMessage } from "../lib/types";

type LoadStatus = "loading" | "ready" | "error";
/**
 * 학습방의 메시지 상태. `unknown` 은 공유 정보를 받아 오지 못해 이 학습방이 학습 짝과 함께 쓰는 학습방인지
 * 모른다는 뜻이다 (검증 후 보완 D3). 오류로 보이지 않고, 녹음·전송은 그대로 할 수 있다.
 */
type MessagesStatus = LoadStatus | "unknown";

/** specs/011-partner-messages/contracts/use-partner-rooms.md */
export type UsePartnerRoomsResult = {
  enabled: boolean;
  status: "idle" | "loading" | "ready" | "error";
  connection: ConnectionState;
  shared(roomId: string): SharedRoom | null;
  messages(roomId: string): VoiceMessage[] | null;
  messagesStatus(roomId: string): MessagesStatus;
  /** 홈·목록 요약용. 서버가 받은 마지막 메시지 시각, 없으면 null. */
  lastMessageAt(roomId: string): number | null;
  openRoom(roomId: string): void;
  /** 재생에 실패한 메시지의 주소를 다시 받는다 (D4). 받지 못하면 null. */
  freshUrl(roomId: string, messageId: string): Promise<string | null>;
  send(roomId: string, language: RoomLanguage, recording: SentRecording): void;
  resend(roomId: string, messageId: string): void;
  discard(roomId: string, messageId: string): void;
  hasSending(roomId?: string): boolean;
  /** 로그아웃하면 사라지는, 보내는 중이거나 보내지 못한 메시지 수 (D8). */
  unsentCount(): number;
  invite: {
    state(roomId: string): InviteState;
    create(roomId: string, language: RoomLanguage): Promise<void>;
    revoke(roomId: string): Promise<void>;
  };
  preview(code: string): Promise<{ ok: true; ownerName: string; language: RoomLanguage } | { ok: false; reason: JoinFailure }>;
  join(code: string): Promise<{ ok: true; roomId: string } | { ok: false; reason: JoinFailure }>;
  leave(roomId: string): Promise<{ ok: true } | { ok: false; reason: LeaveFailure }>;
  retry(): void;
};

/** 공유 정보·메시지·보내는 중인 메시지는 모두 메모리에만 둔다 (research R9). localStorage 새 키는 없다. */
type Store = {
  status: UsePartnerRoomsResult["status"];
  connection: ConnectionState;
  /** shared_rooms.id → 행 */
  rows: Record<string, SharedRoomRow>;
  /** shared_rooms.id → 메시지 id → 메시지 */
  messages: Record<string, Record<string, ServerMessage>>;
  messagesStatus: Record<string, LoadStatus>;
  /** 내 rooms.id → 보내는 중·실패한 메시지 */
  outgoing: Record<string, OutgoingMessage[]>;
  invites: Record<string, InviteState>;
};

const EMPTY: Store = { status: "idle", connection: "connecting", rows: {}, messages: {}, messagesStatus: {}, outgoing: {}, invites: {} };
const NO_INVITE: InviteState = { status: "none" };
const RECONNECT_MS = 15_000;
/** 공유 정보를 받아 오지 못했을 때 다시 받아 오는 간격 (D3). 창 복귀·연결 복구 때도 다시 받는다. */
const SHARED_RETRY_MS = 15_000;
/** 서명 주소는 1시간짜리다. 50분이 지났으면 창 복귀·학습방 열기 때 다시 받는다 (research R4). */
const RESIGN_MS = 50 * 60_000;
const REFRESH_THROTTLE_MS = 5_000;

function sharedFor(rows: Record<string, SharedRoomRow>, userId: string | null, left: Set<string>, roomId: string): SharedRoom | null {
  if (!userId) return null;
  for (const row of Object.values(rows)) {
    if (left.has(row.id)) continue;
    const shared = toSharedRoom(row, userId);
    if (shared && shared.roomId === roomId) return shared;
  }
  return null;
}

/**
 * 서버 메시지를 합친다. 같은 id 의 보내는 중·실패 메시지는 빼고, 서버 메시지가 그 녹음의 blob 주소를 이어 쓴다.
 * 실시간 행이 넣기 응답보다 먼저 오거나 응답을 잃어도 숨은 실패 항목이 남지 않는다 (D9). 뺀 항목을 돌려준다.
 */
function withServerMessages(current: Store, sharedId: string, roomId: string | null, entries: ServerMessage[]) {
  const outgoing = roomId ? current.outgoing[roomId] ?? [] : [];
  const byId = new Map(outgoing.map((message) => [message.id, message]));
  const settled: OutgoingMessage[] = [];
  const messages = { ...(current.messages[sharedId] ?? {}) };
  entries.forEach((entry) => {
    const pending = byId.get(entry.row.id);
    if (pending) { settled.push(pending); messages[entry.row.id] = { ...entry, url: pending.url }; }
    else messages[entry.row.id] = entry;
  });
  const next: Store = { ...current, messages: { ...current.messages, [sharedId]: messages } };
  if (roomId && settled.length) {
    const ids = new Set(settled.map((message) => message.id));
    next.outgoing = { ...current.outgoing, [roomId]: outgoing.filter((message) => !ids.has(message.id)) };
  }
  return { next, settled };
}

/**
 * 학습 짝 쪽 `rooms` 행을 010 쓰기 경로로 만든다 (research R1 복구 규칙, data-model §3).
 * 이미 있으면 그대로 둔다. 쓰지 못하면 false.
 */
function ensurePartnerRoomRow(id: string, ownerName: string, language: RoomLanguage): boolean {
  const base = readRooms();
  if (!base.ok) return false;
  if (base.items.some((room) => room.id === id)) return true;
  const partner = isValidPartner(ownerName) ? normalizePartner(ownerName) : "학습 짝";
  if (!writeRooms([...base.items, { id, partner, language, createdAt: Date.now() }])) return false;
  notifyRecordsChanged();
  return true;
}

export function usePartnerRooms(account: UseAccountResult, scope: RecordScope): UsePartnerRoomsResult {
  const userId = account.state.status === "signed-in" ? account.state.user.id : null;
  const displayName = account.state.status === "signed-in" ? account.state.user.displayName : "";
  // 로그인 상태이고, 010 계정 기록을 받아 왔고, 키가 있을 때만 서버 경로다 (조항 1).
  const enabled = !!userId && scope.kind === "account" && scope.userId === userId && scope.loaded && partnerClientAvailable();
  const activeUser = enabled ? userId : null;

  const [store, setStore] = useState<Store>(EMPTY);
  const storeRef = useRef(store);
  const update = useCallback((change: (current: Store) => Store) => {
    storeRef.current = change(storeRef.current);
    setStore(storeRef.current);
  }, []);

  // 사용자가 바뀌면 session 이 바뀌고, 그 전에 시작한 요청의 결과는 버린다 (조항 6).
  const userRef = useRef<string | null>(null);
  const nameRef = useRef(displayName);
  nameRef.current = displayName;
  const sessionRef = useRef(0);
  const openRoomRef = useRef<string | null>(null);
  /** 보내는 메시지의 학습방·학습 언어. 다시 보내기에 쓴다. */
  const sendMeta = useRef(new Map<string, { roomId: string; language: RoomLanguage }>());
  /** 이 화면에서 보낸 내 메시지는 서명 주소 대신 녹음의 blob 주소를 그대로 쓴다 (data-model §2). */
  const localUrls = useRef(new Map<string, string>());
  const signedAt = useRef(new Map<string, number>());
  /** 나간 학습방. 나가기 전에 시작한 받아 오기가 늦게 와도 되살리지 않는다. */
  const leftIds = useRef(new Set<string>());
  /**
   * `ensure_shared_room` 으로 방금 만든 공유 정보 (D1). 서버 목록에 보일 때까지 둔다 — 그 전에 시작한
   * 받아 오기가 늦게 와도, 받아 오기가 실패해도 처음 보낸 메시지가 대화에서 사라지지 않는다.
   */
  const ensuredRows = useRef(new Map<string, SharedRoomRow>());
  const sharedLoading = useRef(false);
  const sharedAgain = useRef(false);
  const sharedRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesLoading = useRef(new Set<string>());
  const messagesAgain = useRef(new Set<string>());
  const invitesLoading = useRef(new Set<string>());
  const lastRefresh = useRef(0);
  const [channelKey, setChannelKey] = useState(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 아래 함수들은 ref 만 읽으므로 콜백 의존성에 넣지 않아도 늘 최신 값을 본다.
  const alive = (session: number) => session === sessionRef.current && userRef.current !== null;
  const sharedOf = (roomId: string) => sharedFor(storeRef.current.rows, userRef.current, leftIds.current, roomId);
  const roomIdOf = (sharedId: string) => {
    const row = storeRef.current.rows[sharedId];
    return row && userRef.current ? toSharedRoom(row, userRef.current)?.roomId ?? null : null;
  };
  /** 서버 메시지를 넣고, 대신한 보내는 중 항목의 blob 주소를 보내 둔 메시지 주소로 옮긴다. */
  const putServerMessages = (sharedId: string, entries: ServerMessage[], status?: LoadStatus) => {
    let settled: OutgoingMessage[] = [];
    update((current) => {
      const merged = withServerMessages(current, sharedId, roomIdOf(sharedId), entries);
      settled = merged.settled;
      return status ? { ...merged.next, messagesStatus: { ...merged.next.messagesStatus, [sharedId]: status } } : merged.next;
    });
    settled.forEach((message) => { localUrls.current.set(message.id, message.url); sendMeta.current.delete(message.id); });
  };

  // ── 메시지 받아 오기 ─────────────────────────────────────────────────────

  const loadMessages = useCallback(async (sharedId: string) => {
    const session = sessionRef.current;
    if (!userRef.current) return;
    if (messagesLoading.current.has(sharedId)) { messagesAgain.current.add(sharedId); return; }
    messagesLoading.current.add(sharedId);
    if (storeRef.current.messagesStatus[sharedId] !== "ready") {
      update((current) => ({ ...current, messagesStatus: { ...current.messagesStatus, [sharedId]: "loading" } }));
    }
    try {
      const fetched = await fetchMessages(sharedId);
      if (!alive(session) || leftIds.current.has(sharedId)) return;
      if (!fetched.ok) {
        update((current) => ({ ...current, messagesStatus: { ...current.messagesStatus,
          [sharedId]: current.messagesStatus[sharedId] === "ready" ? "ready" : "error" } }));
        return;
      }
      const signed = await signVoiceUrls(fetched.rows.filter((row) => !localUrls.current.has(row.id)).map((row) => row.storage_path));
      if (!alive(session) || leftIds.current.has(sharedId)) return;
      if (signed.ok) signedAt.current.set(sharedId, Date.now());
      const known = storeRef.current.messages[sharedId] ?? {};
      const entries: ServerMessage[] = [];
      let missing = false;
      fetched.rows.forEach((row) => {
        const url = localUrls.current.get(row.id) ?? (signed.ok ? signed.urls.get(row.storage_path) : undefined) ?? known[row.id]?.url;
        if (!url) { missing = true; return; }
        entries.push({ row, createdAt: Date.parse(row.created_at), url });
      });
      // 이미 받은 메시지는 남기고 합친다. 받아 오는 사이 실시간으로 온 메시지를 잃지 않는다.
      putServerMessages(sharedId, entries, missing && !entries.length && !Object.keys(known).length ? "error" : "ready");
    } finally {
      messagesLoading.current.delete(sharedId);
      if (messagesAgain.current.delete(sharedId) && alive(session)) void loadMessages(sharedId);
    }
  }, [update]);

  // ── 초대 코드 받아 오기 (D2) ─────────────────────────────────────────────

  /** 새로고침·다른 기기에서도 유효한 초대 코드를 다시 보고 취소할 수 있게, 학습방을 열 때 서버에서 받아 온다. */
  const loadInvite = useCallback(async (roomId: string) => {
    const session = sessionRef.current;
    const shared = sharedOf(roomId);
    if (!userRef.current || !shared || shared.role !== "owner" || shared.partnerName || shared.closed) return;
    const state = storeRef.current.invites[roomId];
    if (state && state.status !== "none" && state.status !== "active") return;
    if (invitesLoading.current.has(roomId)) return;
    invitesLoading.current.add(roomId);
    try {
      const result = await currentInvite(roomId);
      if (!alive(session) || !result.ok) return;
      const now = storeRef.current.invites[roomId];
      // 받아 오는 사이 코드를 새로 만들거나 취소했으면 그 결과가 앞선다.
      if (now && now.status !== "none" && now.status !== "active") return;
      if (now?.status === "active" && now.revokeFailed) return;
      update((current) => {
        const invites = { ...current.invites };
        if (result.code) invites[roomId] = { status: "active", code: result.code, expiresAt: result.expiresAt };
        else delete invites[roomId];
        return { ...current, invites };
      });
    } finally {
      invitesLoading.current.delete(roomId);
    }
  }, [update]);

  // ── 공유 정보 받아 오기 ─────────────────────────────────────────────────

  const loadShared = useCallback(async () => {
    const session = sessionRef.current;
    const uid = userRef.current;
    if (!uid) return;
    if (sharedLoading.current) { sharedAgain.current = true; return; }
    sharedLoading.current = true;
    if (sharedRetryTimer.current) { clearTimeout(sharedRetryTimer.current); sharedRetryTimer.current = null; }
    if (storeRef.current.status !== "ready") update((current) => ({ ...current, status: "loading" }));
    try {
      const result = await fetchSharedRooms();
      if (!alive(session)) return;
      if (!result.ok) {
        update((current) => ({ ...current, status: current.status === "ready" ? "ready" : "error" }));
        // 처음 받아 오기에 실패했으면 스스로 다시 받아 온다 (D3).
        if (storeRef.current.status === "error") {
          sharedRetryTimer.current = setTimeout(() => { sharedRetryTimer.current = null; if (alive(session)) void loadShared(); }, SHARED_RETRY_MS);
        }
        return;
      }
      const rows: Record<string, SharedRoomRow> = {};
      result.rows.forEach((row) => { if (!leftIds.current.has(row.id)) rows[row.id] = row; });
      ensuredRows.current.forEach((row, id) => {
        if (rows[id] || leftIds.current.has(id)) ensuredRows.current.delete(id);
        else rows[id] = storeRef.current.rows[id] ?? row;
      });
      update((current) => {
        const invites = { ...current.invites };
        Object.values(rows).forEach((row) => {
          const shared = toSharedRoom(row, uid);
          // 학습 짝이 들어왔거나 학습방이 닫히면 초대 코드는 더 보이지 않는다.
          if (shared && (shared.partnerName || shared.closed)) delete invites[shared.roomId];
        });
        return { ...current, status: "ready", rows, invites };
      });
      const now = Date.now();
      Object.values(rows).forEach((row) => {
        const shared = toSharedRoom(row, uid);
        if (!shared) return;
        // 학습 짝인데 내 학습방 목록에 없으면(들어온 직후 쓰기 실패, 다른 기기) 다시 만든다. 만든 사람 쪽은 010 행이 원본이다.
        if (shared.role === "partner") ensurePartnerRoomRow(shared.id, row.owner_name, shared.language);
        const stale = now - (signedAt.current.get(shared.id) ?? 0) > RESIGN_MS;
        const open = openRoomRef.current === shared.roomId;
        if (!storeRef.current.messagesStatus[shared.id] || open || stale) void loadMessages(shared.id);
        if (open) void loadInvite(shared.roomId);
      });
    } finally {
      sharedLoading.current = false;
      if (sharedAgain.current && alive(session)) { sharedAgain.current = false; void loadShared(); }
    }
  }, [update, loadMessages, loadInvite]);

  /** 연결 복구·창 복귀·채널 연결 때. 너무 잦지 않게 한다. */
  const refresh = useCallback((force = false) => {
    if (!userRef.current) return;
    if (!force && Date.now() - lastRefresh.current < REFRESH_THROTTLE_MS) return;
    lastRefresh.current = Date.now();
    void loadShared();
  }, [loadShared]);

  // ── 시작·끝 ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeUser) return;
    userRef.current = activeUser;
    const session = sessionRef.current;
    void loadShared();
    const onBack = () => refresh();
    window.addEventListener("online", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      window.removeEventListener("online", onBack);
      window.removeEventListener("focus", onBack);
      // 로그아웃·계정 바뀜: 모든 상태를 버리고 blob 주소를 revoke 한다 (조항 6, FR-014).
      if (session === sessionRef.current) sessionRef.current += 1;
      userRef.current = null;
      if (sharedRetryTimer.current) { clearTimeout(sharedRetryTimer.current); sharedRetryTimer.current = null; }
      localUrls.current.forEach((url) => URL.revokeObjectURL(url));
      Object.values(storeRef.current.outgoing).flat().forEach((message) => URL.revokeObjectURL(message.url));
      localUrls.current.clear();
      sendMeta.current.clear();
      signedAt.current.clear();
      leftIds.current.clear();
      ensuredRows.current.clear();
      messagesLoading.current.clear();
      messagesAgain.current.clear();
      invitesLoading.current.clear();
      sharedLoading.current = false;
      sharedAgain.current = false;
      openRoomRef.current = null;
      storeRef.current = EMPTY;
      setStore(EMPTY);
    };
  }, [activeUser, loadShared, refresh]);

  // ── 실시간 ─────────────────────────────────────────────────────────────

  const onMessage = useCallback(async (row: VoiceMessageRow) => {
    const session = sessionRef.current;
    const uid = userRef.current;
    if (!uid) return;
    const sharedRow = storeRef.current.rows[row.shared_room_id];
    // 내가 멤버가 아닌(또는 모르는) 학습방의 메시지는 버린다. 모르는 학습방이면 공유 정보를 다시 받아 온다 (조항 5).
    if (!sharedRow || !toSharedRoom(sharedRow, uid)) { if (!sharedRow) refresh(true); return; }
    if (storeRef.current.messages[row.shared_room_id]?.[row.id]) return;
    const roomId = roomIdOf(row.shared_room_id);
    const pending = roomId ? (storeRef.current.outgoing[roomId] ?? []).find((message) => message.id === row.id) : undefined;
    let url = localUrls.current.get(row.id) ?? pending?.url;
    if (!url) {
      const signed = await signVoiceUrls([row.storage_path]);
      if (!alive(session)) return;
      url = signed.ok ? signed.urls.get(row.storage_path) : undefined;
      if (!url) { void loadMessages(row.shared_room_id); return; }
    }
    putServerMessages(row.shared_room_id, [{ row, createdAt: Date.parse(row.created_at), url }]);
  }, [update, refresh, loadMessages]);

  const onSharedRoom = useCallback((row: SharedRoomRow) => {
    const uid = userRef.current;
    if (!uid || leftIds.current.has(row.id)) return;
    const known = !!storeRef.current.rows[row.id];
    ensuredRows.current.delete(row.id);
    update((current) => {
      const invites = { ...current.invites };
      const shared = toSharedRoom(row, uid);
      if (shared && (shared.partnerName || shared.closed)) delete invites[shared.roomId];
      return { ...current, rows: { ...current.rows, [row.id]: row }, invites };
    });
    if (!known) refresh(true);
  }, [update, refresh]);

  useEffect(() => {
    if (!activeUser) return;
    update((current) => ({ ...current, connection: "connecting" }));
    const close = openPartnerChannel(activeUser, {
      onMessage: (row) => { void onMessage(row); },
      onSharedRoom,
      onStatus: (status) => {
        update((current) => ({ ...current, connection: status }));
        if (status === "live") {
          if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
          // 연결되기 전에 놓친 메시지를 받아 온다 (FR-009).
          refresh(true);
        } else if (!reconnectTimer.current) {
          reconnectTimer.current = setTimeout(() => { reconnectTimer.current = null; setChannelKey((key) => key + 1); }, RECONNECT_MS);
        }
      },
    });
    return () => {
      close();
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    };
  }, [activeUser, channelKey, onMessage, onSharedRoom, refresh, update]);

  // ── 보내기 ─────────────────────────────────────────────────────────────

  const setDelivery = useCallback((roomId: string, id: string, delivery: OutgoingMessage["delivery"]) => {
    update((current) => ({ ...current, outgoing: { ...current.outgoing,
      [roomId]: (current.outgoing[roomId] ?? []).map((message) => message.id === id ? { ...message, delivery } : message) } }));
  }, [update]);

  /** research R5: id 먼저 → 소리 올리기 → 행 넣기. 다시 보내도 같은 id 라 한 번만 놓인다. */
  const deliver = useCallback(async (id: string) => {
    const session = sessionRef.current;
    const uid = userRef.current;
    const meta = sendMeta.current.get(id);
    if (!uid || !meta) return;
    const { roomId, language } = meta;
    const outgoing = (storeRef.current.outgoing[roomId] ?? []).find((message) => message.id === id);
    if (!outgoing) return;
    setDelivery(roomId, id, "sending");
    const fail = () => { if (alive(session)) setDelivery(roomId, id, "failed"); };

    const shared = sharedOf(roomId);
    if (shared?.closed) { fail(); return; }
    let sharedId = shared?.id;
    if (!sharedId) {
      // 처음 보낼 때 공유 정보를 만든다. 학습 짝이 나중에 들어와도 이 메시지를 본다 (US2-4).
      const ensured = await ensureSharedRoom(roomId, language);
      if (!alive(session)) return;
      if (!ensured.ok) { fail(); return; }
      sharedId = ensured.sharedRoomId;
      // 서버 목록을 다시 받기 전에 공유 정보를 먼저 둔다. 보낸 메시지가 이 학습방에 이어서 보인다 (D1).
      if (!storeRef.current.rows[sharedId]) {
        // 학습 짝 쪽 rooms.id 는 공유 id 와 같다. 그때는 학습 짝 역할로 두고 만든 사람 정보는 서버 목록을 기다린다 (N1).
        const asPartner = roomId === sharedId;
        const row: SharedRoomRow = asPartner
          ? { id: sharedId, owner_id: "", owner_room_id: "", language, owner_name: "",
            partner_id: uid, partner_name: nameRef.current || "학습자", owner_left_at: null, partner_left_at: null }
          : { id: sharedId, owner_id: uid, owner_room_id: roomId, language, owner_name: nameRef.current || "학습자",
            partner_id: null, partner_name: null, owner_left_at: null, partner_left_at: null };
        ensuredRows.current.set(sharedId, row);
        const target = sharedId;
        update((current) => ({ ...current, rows: { ...current.rows, [target]: row } }));
      }
      void loadShared();
    }
    let blob: Blob;
    try {
      blob = await (await fetch(outgoing.url)).blob();
    } catch { fail(); return; }
    if (!alive(session)) return;
    // storage-js 는 Blob 의 type 을 그대로 보내므로 서버가 받는 형식으로 다시 감싼다 (`;codecs=` 를 뗀다).
    const mime = voiceMimeType(blob.type);
    const body = blob.type === mime ? blob : new Blob([blob], { type: mime });
    const path = voicePath(sharedId, uid, id);
    const uploaded = await uploadVoice(path, body, mime);
    if (!alive(session)) return;
    if (!uploaded.ok) { fail(); return; }
    const inserted = await insertMessage({ id, shared_room_id: sharedId, sender_id: uid,
      duration_ms: Math.min(61_000, Math.max(1, Math.round(outgoing.durationMs))), storage_path: path, mime_type: mime });
    if (!alive(session)) return;
    if (!inserted.ok) { fail(); return; }
    putServerMessages(sharedId, [{ row: inserted.row, createdAt: Date.parse(inserted.row.created_at), url: outgoing.url }]);
    localUrls.current.set(id, outgoing.url);
    sendMeta.current.delete(id);
  }, [update, setDelivery, loadShared]);

  const send = useCallback((roomId: string, language: RoomLanguage, recording: SentRecording) => {
    if (!userRef.current || roomId === MOCK_ROOM.id) return;
    // 닫힌 학습방에는 보내지 않는다 (조항 4). 화면은 녹음 영역 대신 안내를 보인다.
    if (sharedOf(roomId)?.closed) return;
    const id = crypto.randomUUID();
    sendMeta.current.set(id, { roomId, language });
    const message: OutgoingMessage = { id, durationMs: recording.durationMs, url: recording.url, delivery: "sending", sentAtLabel: timeLabel(Date.now()) };
    update((current) => ({ ...current, outgoing: { ...current.outgoing, [roomId]: [...(current.outgoing[roomId] ?? []), message] } }));
    void deliver(id);
  }, [update, deliver]);

  const resend = useCallback((roomId: string, messageId: string) => {
    const message = (storeRef.current.outgoing[roomId] ?? []).find((item) => item.id === messageId);
    if (message?.delivery === "failed") void deliver(messageId);
  }, [deliver]);

  const discard = useCallback((roomId: string, messageId: string) => {
    const message = (storeRef.current.outgoing[roomId] ?? []).find((item) => item.id === messageId);
    if (!message || message.delivery !== "failed") return;
    URL.revokeObjectURL(message.url);
    sendMeta.current.delete(messageId);
    update((current) => ({ ...current, outgoing: { ...current.outgoing,
      [roomId]: (current.outgoing[roomId] ?? []).filter((item) => item.id !== messageId) } }));
  }, [update]);

  // ── 초대 ───────────────────────────────────────────────────────────────

  const setInvite = useCallback((roomId: string, state: InviteState | null) => {
    update((current) => {
      const invites = { ...current.invites };
      if (state) invites[roomId] = state; else delete invites[roomId];
      return { ...current, invites };
    });
  }, [update]);

  const createCode = useCallback(async (roomId: string, language: RoomLanguage) => {
    const session = sessionRef.current;
    if (!userRef.current) return;
    setInvite(roomId, { status: "creating" });
    const result = await createInvite(roomId, language);
    if (!alive(session)) return;
    setInvite(roomId, result.ok ? { status: "active", code: result.code, expiresAt: result.expiresAt } : { status: "failed", reason: result.reason });
    // 공유 정보가 없었으면 함수가 만들었다. 학습 짝이 들어오면 실시간으로 알 수 있게 받아 둔다.
    if (result.ok || result.reason === "has-partner" || result.reason === "closed") void loadShared();
  }, [setInvite, loadShared]);

  const revokeCode = useCallback(async (roomId: string) => {
    const session = sessionRef.current;
    if (!userRef.current) return;
    const before = storeRef.current.invites[roomId];
    const result = await revokeInvite(roomId);
    if (!alive(session)) return;
    if (result.ok) setInvite(roomId, null);
    else if (before?.status === "active") setInvite(roomId, { ...before, revokeFailed: result.reason });
  }, [setInvite]);

  const preview = useCallback(async (code: string): ReturnType<UsePartnerRoomsResult["preview"]> => {
    const normalized = normalizeInviteCode(code);
    if (!isInviteCode(normalized)) return { ok: false, reason: "invalid-format" };
    const result = await previewInvite(normalized);
    if (!result.ok) return { ok: false, reason: result.reason };
    if (!isRoomLanguage(result.language)) return { ok: false, reason: "failed" };
    return { ok: true, ownerName: result.ownerName, language: result.language };
  }, []);

  const join = useCallback(async (code: string): ReturnType<UsePartnerRoomsResult["join"]> => {
    const session = sessionRef.current;
    const normalized = normalizeInviteCode(code);
    if (!isInviteCode(normalized)) return { ok: false, reason: "invalid-format" };
    const result = await acceptInvite(normalized);
    if (!alive(session)) return { ok: false, reason: "failed" };
    if (!result.ok) return { ok: false, reason: result.reason };
    if (!isRoomLanguage(result.language)) return { ok: false, reason: "failed" };
    // 들어왔으면(또는 이미 학습 짝이면) 내 학습방 목록에 학습방을 둔다 (조항 7). 쓰지 못하면 다시 시도하면 된다.
    leftIds.current.delete(result.sharedRoomId);
    if (!ensurePartnerRoomRow(result.sharedRoomId, result.ownerName, result.language)) return { ok: false, reason: "failed" };
    await loadShared();
    return { ok: true, roomId: result.sharedRoomId };
  }, [loadShared]);

  // ── 나가기 ─────────────────────────────────────────────────────────────

  /** 나간 학습방의 메모리 상태를 지운다. */
  const forgetShared = useCallback((sharedId: string, roomId: string) => {
    leftIds.current.add(sharedId);
    ensuredRows.current.delete(sharedId);
    Object.keys(storeRef.current.messages[sharedId] ?? {}).forEach((id) => {
      const url = localUrls.current.get(id);
      if (url) URL.revokeObjectURL(url);
      localUrls.current.delete(id);
    });
    (storeRef.current.outgoing[roomId] ?? []).forEach((message) => { URL.revokeObjectURL(message.url); sendMeta.current.delete(message.id); });
    signedAt.current.delete(sharedId);
    update((current) => {
      const next = { ...current, rows: { ...current.rows }, messages: { ...current.messages },
        messagesStatus: { ...current.messagesStatus }, outgoing: { ...current.outgoing }, invites: { ...current.invites } };
      delete next.rows[sharedId];
      delete next.messages[sharedId];
      delete next.messagesStatus[sharedId];
      delete next.outgoing[roomId];
      delete next.invites[roomId];
      return next;
    });
  }, [update]);

  /** research R8: 온라인으로 먼저 나가고, 성공하면 셸이 010 경로로 내 학습방을 지운다. */
  const leave = useCallback(async (roomId: string): ReturnType<UsePartnerRoomsResult["leave"]> => {
    const session = sessionRef.current;
    const uid = userRef.current;
    let shared = sharedOf(roomId);
    if (!shared || !uid) return { ok: true };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "network" };
    // 보낸 직후 임시로 둔 공유 정보는 학습 짝 유무를 모른다. 서버 목록으로 확인하기 전에는 소리를 지우지 않는다 (N1).
    if (ensuredRows.current.has(shared.id)) {
      await loadShared();
      if (!alive(session)) return { ok: false, reason: "failed" };
      shared = sharedOf(roomId);
      if (!shared) return { ok: true };
      if (ensuredRows.current.has(shared.id)) return { ok: false, reason: "network" };
    }
    // 마지막으로 나가는 사람이면 소리를 먼저 지운다. 나간 뒤에는 멤버가 아니라 지울 수 없다 (research R4).
    const last = shared.role === "owner" ? !shared.partnerId || shared.partnerLeft : shared.partnerLeft;
    if (last) await removeVoiceFolder(shared.id, [shared.ownerId, shared.partnerId].filter((id): id is string => !!id));
    if (!alive(session)) return { ok: false, reason: "failed" };
    const result = await leaveSharedRoom(shared.id);
    if (!alive(session)) return { ok: false, reason: "failed" };
    if (!result.ok) {
      // 응답만 잃었을 수 있다 (D10). 서버에서 이미 나갔거나 학습방이 지워졌으면 나가기를 마친다.
      if (result.reason === "network" || result.reason === "timeout") {
        const check = await fetchSharedRooms();
        if (!alive(session)) return { ok: false, reason: "failed" };
        const row = check.ok ? check.rows.find((item) => item.id === shared.id) : undefined;
        if (check.ok && (!row || !toSharedRoom(row, uid))) { forgetShared(shared.id, roomId); return { ok: true }; }
      }
      return { ok: false, reason: result.reason };
    }
    forgetShared(shared.id, roomId);
    return { ok: true };
  }, [forgetShared, loadShared]);

  // ── 읽기 ───────────────────────────────────────────────────────────────

  const byRoom = useMemo(() => {
    const map = new Map<string, SharedRoom>();
    if (!activeUser) return map;
    Object.values(store.rows).forEach((row) => {
      if (leftIds.current.has(row.id)) return;
      const shared = toSharedRoom(row, activeUser);
      if (shared) map.set(shared.roomId, shared);
    });
    return map;
  }, [store.rows, activeUser]);

  const shared = useCallback((roomId: string) => byRoom.get(roomId) ?? null, [byRoom]);

  const messages = useCallback((roomId: string): VoiceMessage[] | null => {
    if (!activeUser || roomId === MOCK_ROOM.id) return null;
    const room = byRoom.get(roomId);
    const server = room ? Object.values(store.messages[room.id] ?? {}) : [];
    return mergeMessages(server, store.outgoing[roomId] ?? [], activeUser);
  }, [activeUser, byRoom, store.messages, store.outgoing]);

  /**
   * 공유 정보를 아는 학습방은 그 학습방의 메시지 상태다. 모르는 학습방은 공유 정보 상태로 정한다:
   * 받아 오는 중이면 loading, 받아 왔으면 공유한 적 없는 학습방이라 ready, 받아 오지 못했으면 unknown (D3).
   */
  const messagesStatus = useCallback((roomId: string): MessagesStatus => {
    const room = byRoom.get(roomId);
    if (room) return store.messagesStatus[room.id] ?? "loading";
    if (store.status === "ready") return "ready";
    return store.status === "error" ? "unknown" : "loading";
  }, [byRoom, store.status, store.messagesStatus]);

  const lastMessageAt = useCallback((roomId: string): number | null => {
    const room = byRoom.get(roomId);
    if (!room) return null;
    const times = Object.values(store.messages[room.id] ?? {}).map((message) => message.createdAt);
    return times.length ? Math.max(...times) : null;
  }, [byRoom, store.messages]);

  const openRoom = useCallback((roomId: string) => {
    openRoomRef.current = roomId;
    if (!userRef.current || roomId === MOCK_ROOM.id) return;
    const room = sharedOf(roomId);
    if (room) { void loadMessages(room.id); void loadInvite(roomId); }
  }, [loadMessages, loadInvite]);

  const freshUrl = useCallback(async (roomId: string, messageId: string): Promise<string | null> => {
    const session = sessionRef.current;
    const room = sharedOf(roomId);
    const entry = room ? storeRef.current.messages[room.id]?.[messageId] : undefined;
    if (!room || !entry) {
      return (storeRef.current.outgoing[roomId] ?? []).find((message) => message.id === messageId)?.url ?? null;
    }
    const local = localUrls.current.get(messageId);
    if (local) return local;
    const signed = await signVoiceUrls([entry.row.storage_path]);
    if (!alive(session)) return null;
    const url = signed.ok ? signed.urls.get(entry.row.storage_path) : undefined;
    if (!url) return null;
    const sharedId = room.id;
    update((current) => {
      const list = current.messages[sharedId];
      if (!list?.[messageId]) return current;
      return { ...current, messages: { ...current.messages, [sharedId]: { ...list, [messageId]: { ...list[messageId], url } } } };
    });
    // 한 메시지가 만료됐으면 나머지도 곧 만료된다. 학습방 전체를 다시 받아 둔다.
    void loadMessages(sharedId);
    return url;
  }, [update, loadMessages]);

  const hasSending = useCallback((roomId?: string) => {
    const lists = roomId ? [store.outgoing[roomId] ?? []] : Object.values(store.outgoing);
    return lists.some((list) => list.some((message) => message.delivery === "sending"));
  }, [store.outgoing]);

  const unsentCount = useCallback(() => Object.values(store.outgoing).reduce((sum, list) => sum + list.length, 0), [store.outgoing]);

  const inviteState = useCallback((roomId: string) => store.invites[roomId] ?? NO_INVITE, [store.invites]);

  const retry = useCallback(() => {
    if (!userRef.current) return;
    refresh(true);
    if (storeRef.current.connection === "lost") {
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      setChannelKey((key) => key + 1);
    }
  }, [refresh]);

  const invite = useMemo(() => ({ state: inviteState, create: createCode, revoke: revokeCode }), [inviteState, createCode, revokeCode]);

  return {
    enabled: !!activeUser, status: activeUser ? store.status : "idle", connection: store.connection,
    shared, messages, messagesStatus, lastMessageAt, openRoom, freshUrl, send, resend, discard, hasSending, unsentCount,
    invite, preview, join, leave, retry,
  };
}
