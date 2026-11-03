/**
 * 학습 짝 초대와 음성 메시지 (specs/011-partner-messages/data-model.md §2).
 * 순수 함수와 타입만 둔다. 서버 호출은 `partner-client.ts`, 상태는 `usePartnerRooms` 가 맡는다.
 */
import { isRoomLanguage, type RoomLanguage } from "./rooms";
import type { VoiceMessage } from "./types";

/** 함께 쓰는 학습방. `roomId` 는 내 `rooms.id` 이고, `partnerName` 은 내 기준 학습 짝의 표시 이름이다. */
export type SharedRoom = {
  id: string;
  role: "owner" | "partner";
  roomId: string;
  language: RoomLanguage;
  partnerName: string | null;
  /** 누군가 나갔다. 보낼 수 없고 초대할 수 없다. */
  closed: boolean;
  /** 내가 아닌 쪽이 나갔다. */
  partnerLeft: boolean;
  ownerId: string;
  partnerId: string | null;
};

export type InviteFailure = "invalid" | "has-partner" | "closed" | "network" | "timeout" | "failed";

/** `revokeFailed` 가 있으면 취소하지 못했고 코드는 아직 쓸 수 있다. */
export type InviteState =
  | { status: "none" }
  | { status: "creating" }
  | { status: "active"; code: string; expiresAt: number; revokeFailed?: InviteFailure }
  | { status: "failed"; reason: InviteFailure };

export type JoinFailure = "invalid-format" | "not-found" | "expired" | "used" | "own-room"
  | "has-partner" | "too-many" | "network" | "timeout" | "failed";

export type LeaveFailure = "network" | "timeout" | "failed";
export type Delivery = "sent" | "sending" | "failed";
export type ConnectionState = "connecting" | "live" | "lost";

/** 헷갈리는 글자(0·O·1·I·L)를 뺀 31자 (research R3). */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_PATTERN = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/** 앞뒤 공백을 지우고 대문자로 바꾼다. 서버도 같은 규칙을 쓴다. */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isInviteCode(code: string): boolean {
  return INVITE_CODE_PATTERN.test(normalizeInviteCode(code));
}

export const JOIN_FAILURE_MESSAGE: Record<JoinFailure, string> = {
  "invalid-format": "초대 코드는 숫자와 영문 6자예요. 받은 코드를 다시 확인해 주세요.",
  "not-found": "없는 초대 코드예요. 받은 코드를 다시 확인해 주세요.",
  expired: "만료된 초대 코드예요. 학습 짝에게 새 코드를 받아 주세요.",
  used: "이미 쓰인 초대 코드예요. 학습 짝에게 새 코드를 받아 주세요.",
  "own-room": "내가 만든 학습방의 초대 코드라 들어갈 수 없어요. 이 코드는 학습 짝에게 알려 주세요.",
  "has-partner": "이 학습방에는 이미 학습 짝이 있어요.",
  "too-many": "틀린 코드를 여러 번 넣었어요. 10분쯤 뒤에 다시 시도해 주세요.",
  network: "연결할 수 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
  timeout: "응답이 늦어지고 있어요. 연결을 확인하고 다시 시도해 주세요.",
  failed: "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
};

export const INVITE_FAILURE_MESSAGE: Record<InviteFailure, string> = {
  invalid: "이 학습방의 정보를 확인하지 못했어요. 다시 시도해 주세요.",
  "has-partner": "이 학습방에는 이미 학습 짝이 들어와 있어요.",
  closed: "학습 짝이 나간 학습방이라 다시 초대할 수 없어요.",
  network: JOIN_FAILURE_MESSAGE.network,
  timeout: JOIN_FAILURE_MESSAGE.timeout,
  failed: JOIN_FAILURE_MESSAGE.failed,
};

export const LEAVE_FAILURE_MESSAGE: Record<LeaveFailure, string> = {
  network: "연결이 없어 학습방에서 나가지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
  timeout: "응답이 늦어 학습방에서 나가지 못했어요. 다시 시도해 주세요.",
  failed: "학습방에서 나가지 못했어요. 잠시 뒤 다시 시도해 주세요.",
};

export const JOIN_FAILURES: readonly JoinFailure[] = ["invalid-format", "not-found", "expired", "used", "own-room",
  "has-partner", "too-many", "network", "timeout", "failed"];
export const INVITE_FAILURES: readonly InviteFailure[] = ["invalid", "has-partner", "closed", "network", "timeout", "failed"];

// ── 서버 행 ───────────────────────────────────────────────────────────────

export type SharedRoomRow = {
  id: string; owner_id: string; owner_room_id: string; language: string; owner_name: string;
  partner_id: string | null; partner_name: string | null;
  owner_left_at: string | null; partner_left_at: string | null;
};

export type VoiceMessageRow = {
  id: string; shared_room_id: string; sender_id: string; duration_ms: number;
  storage_path: string; mime_type: string; created_at: string;
};

export const SHARED_ROOM_COLUMNS = "id,owner_id,owner_room_id,language,owner_name,partner_id,partner_name,owner_left_at,partner_left_at";
export const VOICE_MESSAGE_COLUMNS = "id,shared_room_id,sender_id,duration_ms,storage_path,mime_type,created_at";

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isNullableText = (value: unknown): value is string | null => value === null || typeof value === "string";

export function isSharedRoomRow(value: unknown): value is SharedRoomRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return isText(row.id) && isText(row.owner_id) && isText(row.owner_room_id) && isText(row.language) && isText(row.owner_name) &&
    isNullableText(row.partner_id) && isNullableText(row.partner_name) &&
    isNullableText(row.owner_left_at) && isNullableText(row.partner_left_at);
}

export function isVoiceMessageRow(value: unknown): value is VoiceMessageRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return isText(row.id) && isText(row.shared_room_id) && isText(row.sender_id) && typeof row.duration_ms === "number" &&
    isText(row.storage_path) && isText(row.mime_type) && isText(row.created_at) && !Number.isNaN(Date.parse(row.created_at));
}

/**
 * 내 기준의 학습방. 내가 멤버가 아니거나 이미 나간 학습방은 null 이다 — 목록에서 사라진 학습방이다.
 * 만든 사람은 자기 010 학습방(`owner_room_id`)으로, 학습 짝은 `id` 와 같은 학습방으로 본다 (research R1).
 */
export function toSharedRoom(row: SharedRoomRow, userId: string): SharedRoom | null {
  if (!isRoomLanguage(row.language)) return null;
  const role = row.owner_id === userId ? "owner" : row.partner_id === userId ? "partner" : null;
  if (!role) return null;
  const mine = role === "owner" ? row.owner_left_at : row.partner_left_at;
  if (mine) return null;
  const other = role === "owner" ? row.partner_left_at : row.owner_left_at;
  return {
    id: row.id, role, roomId: role === "owner" ? row.owner_room_id : row.id, language: row.language,
    partnerName: role === "owner" ? row.partner_name : row.owner_name,
    closed: !!(row.owner_left_at || row.partner_left_at), partnerLeft: !!other,
    ownerId: row.owner_id, partnerId: row.partner_id,
  };
}

export const timeLabel = (at: number) =>
  new Date(at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

/** 서버가 받은 메시지. 정렬은 서버가 받은 시각(`createdAt`)으로 한다. */
export type ServerMessage = { row: VoiceMessageRow; createdAt: number; url: string };

/** 아직 서버가 받지 않은 내 메시지. 녹음의 blob 주소를 가진다. */
export type OutgoingMessage = { id: string; durationMs: number; url: string; delivery: "sending" | "failed"; sentAtLabel: string };

export function toVoiceMessage(message: ServerMessage, userId: string): VoiceMessage {
  return {
    id: message.row.id, sender: message.row.sender_id === userId ? "me" : "partner", durationMs: message.row.duration_ms,
    sentAtLabel: timeLabel(message.createdAt), source: "recorded", url: message.url, readLabel: null, delivery: "sent",
  };
}

/**
 * 서버 메시지와 보내는 중인 메시지를 하나로 합친다. 같은 id 는 서버 메시지가 이긴다 (다시 보내도 한 번만 놓인다).
 * 서버 메시지는 받은 시각 순, 보내는 중인 메시지는 그 뒤에 보낸 순서대로 붙는다.
 */
export function mergeMessages(server: ServerMessage[], outgoing: OutgoingMessage[], userId: string): VoiceMessage[] {
  const seen = new Set<string>();
  const sorted = [...server]
    .filter((message) => { if (seen.has(message.row.id)) return false; seen.add(message.row.id); return true; })
    .sort((a, b) => a.createdAt - b.createdAt || a.row.id.localeCompare(b.row.id));
  return [
    ...sorted.map((message) => toVoiceMessage(message, userId)),
    ...outgoing.filter((message) => !seen.has(message.id)).map((message): VoiceMessage => ({
      id: message.id, sender: "me", durationMs: message.durationMs, sentAtLabel: message.sentAtLabel,
      source: "recorded", url: message.url, readLabel: null, delivery: message.delivery,
    })),
  ];
}

/** 서버가 받는 형식으로 맞춘다. 녹음 형식 뒤의 `;codecs=` 는 뗀다 (001 녹음 후보와 같은 4종). */
export const VOICE_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"] as const;
export function voiceMimeType(type: string): string {
  const base = type.split(";")[0].trim().toLowerCase();
  return VOICE_MIME_TYPES.find((item) => item === base) ?? "audio/webm";
}

export const voicePath = (sharedRoomId: string, senderId: string, messageId: string) =>
  `${sharedRoomId}/${senderId}/${messageId}`;
