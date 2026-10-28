"use client";

import { useState } from "react";
import { isValidPartner, ROOM_FAILURE_MESSAGE, ROOM_LANGUAGES, type CreateRoomResult, type Room, type RoomDraft, type RoomFailure } from "../lib/rooms";
import type { StorageStatus } from "../lib/types";

export default function RoomCreate({ status, onCreate, onCreated, onCancel }: {
  status: StorageStatus; onCreate: (draft: RoomDraft) => CreateRoomResult;
  onCreated: (room: Room) => void; onCancel: () => void;
}) {
  const [partner, setPartner] = useState("");
  const [language, setLanguage] = useState<string>(ROOM_LANGUAGES[0]);
  const [error, setError] = useState<RoomFailure | null>(null);
  const valid = isValidPartner(partner);
  return <section className="screen room-create-screen">
    <button className="back" onClick={onCancel} aria-label="학습방 목록으로 돌아가기">←</button>
    <h1>새 학습방</h1>
    <p className="lead">누구와 어떤 언어로 대화할까요?</p>
    <p className="room-notice">학습 짝에게 실제로 알림이 가지는 않아요. 초대와 실제 전달은 아직 준비 중이에요.</p>
    <form className="room-form" onSubmit={(event) => {
      event.preventDefault();
      const result = onCreate({ partner, language });
      if (!result.ok) setError(result.reason);
      else onCreated(result.room);
    }}>
      <label htmlFor="room-partner">학습 짝 이름</label>
      <input id="room-partner" autoFocus autoComplete="off" value={partner} aria-describedby="room-partner-help" aria-invalid={!valid && partner.length > 0}
        onChange={(event) => { setPartner(event.target.value); setError(null); }} />
      <p id="room-partner-help">앞뒤 공백을 제외한 1~20자로 적어주세요.</p>
      <label htmlFor="room-language">학습 언어</label>
      <select id="room-language" value={language} onChange={(event) => { setLanguage(event.target.value); setError(null); }}>
        {ROOM_LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      {!valid && partner.length > 0 && <p className="room-notice" role="status">{ROOM_FAILURE_MESSAGE["invalid-partner"]}</p>}
      {(error || status === "unavailable") && <p className="room-notice" role="status">{ROOM_FAILURE_MESSAGE[error ?? "storage-unavailable"]}</p>}
      {status === "loading" && <p role="status">학습방을 읽고 있어요.</p>}
      <div className="room-actions"><button type="button" onClick={onCancel}>취소</button><button className="room-primary" type="submit" disabled={!valid || status === "loading"}>학습방 개설</button></div>
    </form>
  </section>;
}
