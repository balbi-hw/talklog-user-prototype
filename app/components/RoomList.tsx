"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MOCK_ROOM, ROOM_FAILURE_MESSAGE, roomName, type RoomOverview } from "../lib/rooms";
import type { StorageStatus } from "../lib/types";
import { RoomItems } from "./RoomSummary";

/** 011: 지우기 결과. 실패하면 화면에 보일 이유를 준다 (학습 짝이 있는 학습방은 나가기라 서버를 거친다). */
export type RemoveRoomResult = { ok: true } | { ok: false; message: string };

export default function RoomList({ items, status, onOpen, onCreate, onRemove, onReload, isShared, inviteJoin }: {
  items: RoomOverview[]; status: StorageStatus; onOpen: (id: string) => void;
  onCreate: () => void; onRemove: (id: string) => Promise<RemoveRoomResult>; onReload: () => void;
  /** 011: 학습 짝과 함께 쓰는 학습방이면 지우기가 나가기다 (FR-012). */
  isShared?: (id: string) => boolean;
  /** 011: 초대 코드 입력 자리. */
  inviteJoin?: ReactNode;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleteRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => { headingRef.current?.focus(); }, []);
  // 다른 탭에서 확인 대상이 사라져도 포커스를 잃지 않는다.
  useEffect(() => {
    if (pendingId && !items.some(({ room }) => room.id === pendingId)) {
      setPendingId(null);
      headingRef.current?.focus();
    }
  }, [items, pendingId]);

  return <section className="screen room-list-screen">
    <div className="eyebrow">나의 대화</div>
    <h1 ref={headingRef} tabIndex={-1}>학습방 목록</h1>
    <p className="lead">학습 짝과 학습 언어를 확인하고 대화를 이어가세요.</p>
    <button className="primary-button" onClick={onCreate}>새 학습방</button>
    {inviteJoin}
    {status === "loading" ? <p role="status">학습방을 읽고 있어요.</p> : <>
      {status === "unavailable" && <div className="room-notice" role="status"><p>{ROOM_FAILURE_MESSAGE["storage-unavailable"]} 마지막으로 확인한 목록을 표시해요.</p><button onClick={onReload}>다시 시도</button></div>}
      {status === "ready" && items.length === 1 && <p className="room-empty">아직 만든 학습방이 없어요. 새 학습방을 만들거나 예시 학습방에서 시작해보세요.</p>}
      <div className="room-list">{items.map((item) => {
        const { room } = item;
        const pending = pendingId === room.id;
        const busy = busyId === room.id;
        const shared = isShared?.(room.id) ?? false;
        const confirmId = `room-confirm-${room.id}`;
        return <article className="room-list-item" key={room.id}>
          <RoomItems items={[item]} onOpen={onOpen} />
          {room.id !== MOCK_ROOM.id && <button className="room-delete" ref={(node) => { if (node) deleteRefs.current.set(room.id, node); else deleteRefs.current.delete(room.id); }}
            aria-label={`${roomName(room)} 지우기`} aria-expanded={pending} aria-controls={confirmId} disabled={busy}
            onClick={() => { setPendingId(pending ? null : room.id); setNotice(""); }}>지우기</button>}
          {pending && <div className="room-confirm" id={confirmId}>
            {shared ? <>
              <strong>{roomName(room)} 학습방에서 나갈까요?</strong>
              <p>나가면 이 학습방의 메시지를 더 볼 수 없어요. 학습 짝에게는 내가 나갔다고 보여요. 저장한 표현은 남아요.</p>
            </> : <>
              <strong>{roomName(room)} 학습방을 지울까요?</strong>
              <p>이 학습방과 여기에 보낸 음성 메시지는 되돌릴 수 없어요. 저장한 표현은 남아요.</p>
            </>}
            {busy && <p className="room-status" role="status">{shared ? "학습방에서 나가고 있어요." : "학습방을 지우고 있어요."}</p>}
            <div className="room-actions"><button autoFocus disabled={busy} onClick={() => { setPendingId(null); deleteRefs.current.get(room.id)?.focus(); }}>취소</button>
              <button className="room-danger" disabled={busy} onClick={async () => {
                setBusyId(room.id);
                const result = await onRemove(room.id);
                setBusyId(null);
                if (!result.ok) { setNotice(result.message); return; }
                setPendingId(null);
                setNotice(shared ? "학습방에서 나갔어요." : "학습방을 지웠어요.");
                headingRef.current?.focus();
              }}>{shared ? "학습방 나가기" : "학습방 지우기"}</button></div>
          </div>}
        </article>;
      })}</div>
    </>}
    <p className="room-status" role="status">{notice}</p>
  </section>;
}
