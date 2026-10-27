"use client";

import { MOCK_ROOM, roomName, type RoomOverview } from "../lib/rooms";
import type { StorageStatus } from "../lib/types";

export function RoomItems({ items, onOpen }: { items: RoomOverview[]; onOpen: (id: string) => void }) {
  return <>{items.map(({ room, messageCount, lastMessageLabel }) => <button className="room-open" key={room.id} onClick={() => onOpen(room.id)}>
    <span className="room-item-name">{roomName(room)}</span>
    <span>학습 짝 {room.partner} · {room.language}{room.id === MOCK_ROOM.id ? " · 예시 학습방" : ""}</span>
    <small>음성 메시지 {messageCount}개{lastMessageLabel ? ` · 마지막 메시지 ${lastMessageLabel}` : ""}</small>
  </button>)}</>;
}

export default function RoomSummary({ items, status, onOpen, onAll, onCreate, onReload }: {
  items: RoomOverview[]; status: StorageStatus; onOpen: (id: string) => void;
  onAll: () => void; onCreate: () => void; onReload: () => void;
}) {
  return <section className="room-summary" aria-labelledby="room-summary-title">
    <h2 id="room-summary-title">진행 중인 학습방</h2>
    {status === "loading" ? <p role="status">학습방을 읽고 있어요.</p> : <>
      {status === "unavailable" && <div className="room-notice" role="status">학습방을 읽거나 저장할 수 없어요. 마지막으로 확인한 목록이에요. <button onClick={onReload}>다시 시도</button></div>}
      <RoomItems items={items.slice(0, 3)} onOpen={onOpen} />
    </>}
    <div className="room-actions"><button onClick={onAll}>전체 학습방</button><button onClick={onCreate}>새 학습방</button></div>
  </section>;
}
