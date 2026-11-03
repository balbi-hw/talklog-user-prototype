"use client";

import { useEffect, useRef, useState } from "react";
import type { UsePartnerRoomsResult } from "../hooks/usePartnerRooms";
import { INVITE_CODE_LENGTH, JOIN_FAILURE_MESSAGE, type JoinFailure } from "../lib/partner";
import { roomName, type RoomLanguage } from "../lib/rooms";
import type { InviteAvailability } from "./RoomInvite";

/**
 * 학습방 목록의 초대 코드 입력 (specs/011-partner-messages US1, FR-003·FR-004).
 * 코드 → 들어갈 학습방 확인(대화상자) → 들어가기 → 그 학습방을 연다.
 */
export default function InviteJoin({ availability, preview, join, onJoined, onAccount, onRetry }: {
  availability: InviteAvailability;
  preview: UsePartnerRoomsResult["preview"];
  join: UsePartnerRoomsResult["join"];
  onJoined: (roomId: string) => void;
  onAccount: () => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"preview" | "join" | null>(null);
  const [failure, setFailure] = useState<JoinFailure | null>(null);
  const [confirm, setConfirm] = useState<{ ownerName: string; language: RoomLanguage } | null>(null);
  const [joinFailure, setJoinFailure] = useState<JoinFailure | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const joinRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelId = "invite-join-panel";

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (confirm) joinRef.current?.focus(); }, [confirm]);

  const closeConfirm = () => {
    if (busy === "join") return;
    setConfirm(null);
    setJoinFailure(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return <div className="invite-join">
    <button type="button" ref={toggleRef} className="invite-join-toggle" aria-expanded={open} aria-controls={panelId}
      onClick={() => { setOpen(!open); setFailure(null); }}>초대 코드 입력</button>
    <div id={panelId} hidden={!open}>
      {open && (availability === "signed-out" ? <div className="room-invite">
        <p>로그인하면 학습 짝이 알려 준 초대 코드로 학습방에 들어갈 수 있어요.</p>
        <button type="button" onClick={onAccount}>로그인하러 가기</button>
      </div> : availability === "unavailable" ? <div className="room-invite">
        <p>이 환경에서는 로그인을 쓸 수 없어 초대 코드를 입력할 수 없어요.</p>
      </div> : availability === "loading" ? <div className="room-invite"><p role="status">계정 정보를 받아 오고 있어요.</p></div>
      : availability === "error" ? <div className="room-invite warn" role="status">
        <p>학습방 정보를 받아 오지 못했어요.</p><button type="button" onClick={onRetry}>다시 시도</button>
      </div> : <form className="room-form invite-join-form" noValidate onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy("preview");
        setFailure(null);
        const result = await preview(code);
        setBusy(null);
        if (!result.ok) { setFailure(result.reason); inputRef.current?.focus(); return; }
        setJoinFailure(null);
        setConfirm({ ownerName: result.ownerName, language: result.language });
      }}>
        <label htmlFor="invite-join-code">초대 코드</label>
        <input id="invite-join-code" ref={inputRef} className="invite-code-input" value={code} maxLength={INVITE_CODE_LENGTH + 8}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
          aria-invalid={!!failure} aria-describedby={failure ? "invite-join-error invite-join-help" : "invite-join-help"}
          onChange={(event) => { setCode(event.target.value.toUpperCase()); setFailure(null); }} />
        <p id="invite-join-help">학습 짝이 알려 준 6자 코드를 넣어 주세요. 대소문자는 가리지 않아요.</p>
        {failure && <p id="invite-join-error" className="room-notice" role="alert">{JOIN_FAILURE_MESSAGE[failure]}</p>}
        {busy === "preview" && <p className="room-status" role="status">초대 코드를 확인하고 있어요.</p>}
        <div className="room-actions">
          <button className="room-primary" type="submit" disabled={busy !== null}>{busy === "preview" ? "확인 중…" : "확인"}</button>
        </div>
      </form>)}
    </div>

    {confirm && <div className="leave-confirm" role="dialog" aria-modal="true" aria-labelledby="invite-join-title" aria-describedby="invite-join-desc"
      onKeyDown={(event) => {
        if (event.key === "Escape") { closeConfirm(); return; }
        // aria-modal 이므로 Tab·Shift+Tab 이 대화상자 안에서만 돈다 (D5).
        if (event.key !== "Tab") return;
        const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
        if (!items.length) { event.preventDefault(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !cardRef.current?.contains(active))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (active === last || !cardRef.current?.contains(active))) { event.preventDefault(); first.focus(); }
      }}>
      <div className="leave-card" ref={cardRef}>
        <strong id="invite-join-title">{roomName({ partner: confirm.ownerName, language: confirm.language })} 학습방에 들어갈까요?</strong>
        <p id="invite-join-desc">{confirm.ownerName} 님이 만든 {confirm.language} 학습방이에요. 들어가면 음성 메시지를 주고받을 수 있어요.</p>
        {joinFailure && <p className="room-notice" role="alert">{JOIN_FAILURE_MESSAGE[joinFailure]}</p>}
        {busy === "join" && <p className="room-status" role="status">학습방에 들어가고 있어요.</p>}
        <div className="leave-actions">
          <button type="button" ref={joinRef} disabled={busy !== null} onClick={async () => {
            setBusy("join");
            setJoinFailure(null);
            const result = await join(code);
            setBusy(null);
            if (!result.ok) { setJoinFailure(result.reason); requestAnimationFrame(() => joinRef.current?.focus()); return; }
            setConfirm(null);
            setOpen(false);
            setCode("");
            onJoined(result.roomId);
          }}>{busy === "join" ? "들어가는 중…" : "들어가기"}</button>
          <button type="button" className="leave-discard" disabled={busy === "join"} onClick={closeConfirm}>취소</button>
        </div>
      </div>
    </div>}
  </div>;
}
