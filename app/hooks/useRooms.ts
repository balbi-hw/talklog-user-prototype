"use client";

import { useCallback, useEffect, useState } from "react";
import { createRoomId, isRoomLanguage, isValidPartner, MOCK_ROOM, normalizePartner, readRooms,
  ROOMS_STORAGE_KEY, writeRooms, type CreateRoomResult, type Room, type RoomDraft, type RoomsState } from "../lib/rooms";

/** 학습방의 단일 소유자. 매 쓰기 전 재읽기하며 실패하면 마지막 정상 목록을 유지한다. */
export function useRooms() {
  const [state, setState] = useState<RoomsState>({ status: "loading", rooms: [MOCK_ROOM] });
  const apply = useCallback((items: Room[]) => {
    setState({ status: "ready", rooms: [MOCK_ROOM, ...items] });
  }, []);
  const fail = useCallback(() => setState((current) => ({ ...current, status: "unavailable" })), []);
  const reload = useCallback(() => {
    const result = readRooms();
    if (result.ok) apply(result.items);
    else fail();
  }, [apply, fail]);

  useEffect(() => {
    reload();
    const onStorage = (event: StorageEvent) => {
      if (event.key === ROOMS_STORAGE_KEY || event.key === null) reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reload]);

  const create = useCallback((draft: RoomDraft): CreateRoomResult => {
    if (!isValidPartner(draft.partner)) return { ok: false, reason: "invalid-partner" };
    if (!isRoomLanguage(draft.language)) return { ok: false, reason: "invalid-language" };
    const base = readRooms();
    if (!base.ok) { fail(); return { ok: false, reason: "storage-unavailable" }; }
    let id = createRoomId();
    while (base.items.some((item) => item.id === id) || id === MOCK_ROOM.id) id = createRoomId();
    const room: Room = { id, partner: normalizePartner(draft.partner), language: draft.language, createdAt: Date.now() };
    const next = [...base.items, room];
    if (!writeRooms(next)) { fail(); return { ok: false, reason: "storage-unavailable" }; }
    apply(next);
    return { ok: true, room };
  }, [apply, fail]);

  const remove = useCallback((id: string): boolean => {
    if (id === MOCK_ROOM.id) return false;
    const base = readRooms();
    if (!base.ok) { fail(); return false; }
    const next = base.items.filter((room) => room.id !== id);
    if (!writeRooms(next)) { fail(); return false; }
    apply(next);
    return true;
  }, [apply, fail]);

  return { ...state, create, remove, reload };
}
