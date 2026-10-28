import type { StorageStatus } from "./types";

export const ROOM_LANGUAGES = ["일본어", "영어", "중국어"] as const;
export type RoomLanguage = (typeof ROOM_LANGUAGES)[number];
export type Room = { id: string; partner: string; language: RoomLanguage; createdAt: number };
export type RoomDraft = { partner: string; language: string };
export type RoomFailure = "invalid-partner" | "invalid-language" | "storage-unavailable";
export type CreateRoomResult = { ok: true; room: Room } | { ok: false; reason: RoomFailure };
export type RoomOverview = { room: Room; messageCount: number; lastMessageLabel: string | null };
export type RoomsState = { status: StorageStatus; rooms: Room[] };

export const ROOMS_STORAGE_KEY = "talklog.rooms";
/** 사용자 저장 데이터와 분리된 삭제 불가 예시 학습방. */
export const MOCK_ROOM: Room = { id: "mock-yuki", partner: "유키", language: "일본어", createdAt: 0 };
export const ROOM_FAILURE_MESSAGE: Record<RoomFailure, string> = {
  "invalid-partner": "학습 짝 이름을 앞뒤 공백을 제외한 1~20자로 적어주세요.",
  "invalid-language": "학습 언어를 일본어·영어·중국어 중에서 골라주세요.",
  "storage-unavailable": "학습방을 저장할 수 없어요. 브라우저의 사이트 데이터 설정과 저장 공간을 확인한 뒤 다시 시도해주세요.",
};

export function normalizePartner(partner: string): string {
  return partner.trim().normalize("NFC");
}

export function isValidPartner(partner: string): boolean {
  const length = Array.from(normalizePartner(partner)).length;
  return length >= 1 && length <= 20;
}

export function isRoomLanguage(language: unknown): language is RoomLanguage {
  return ROOM_LANGUAGES.some((item) => item === language);
}

export function roomName(room: Pick<Room, "partner" | "language">): string {
  const partner = normalizePartner(room.partner);
  const last = partner.charCodeAt(partner.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${partner}${hasFinal ? "과" : "와"} ${room.language} 대화`;
}

function isRoom(value: unknown): value is Room {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.trim().length > 0 && !(item.id in Object.prototype) && item.id !== MOCK_ROOM.id &&
    typeof item.partner === "string" && isValidPartner(item.partner) && isRoomLanguage(item.language) &&
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt) && item.createdAt >= 0 &&
    !Number.isNaN(new Date(item.createdAt).getTime());
}

export function readRooms(): { ok: true; items: Room[] } | { ok: false } {
  let raw: string | null;
  try { raw = window.localStorage.getItem(ROOMS_STORAGE_KEY); }
  catch { return { ok: false }; }
  if (raw === null) return { ok: true, items: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: true, items: [] };
    const seen = new Set<string>();
    const items = parsed.filter(isRoom).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).map((item) => ({ id: item.id, partner: normalizePartner(item.partner), language: item.language, createdAt: item.createdAt }));
    return { ok: true, items };
  } catch { return { ok: true, items: [] }; }
}

export function writeRooms(items: Room[]): boolean {
  try {
    window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch { return false; }
}

export function createRoomId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
