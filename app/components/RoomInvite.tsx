"use client";

import { useEffect, useState } from "react";
import { INVITE_FAILURE_MESSAGE, type InviteState, type SharedRoom } from "../lib/partner";

/**
 * 학습방 안의 초대 코드 영역 (specs/011-partner-messages US1).
 * - signed-out: 로그아웃 상태. 동작하지 않는 버튼 대신 로그인 안내를 보인다 (FR-013, 원칙 II).
 * - unavailable: 키가 없어 로그인을 쓸 수 없는 환경.
 * - loading: 로그인했지만 계정 기록이나 공유 정보를 아직 받아 오지 못했다.
 * - error: 공유 정보를 받아 오지 못했다.
 * 예시 학습방에서는 이 영역을 그리지 않는다.
 */
export type InviteAvailability = "signed-out" | "unavailable" | "loading" | "error" | "ready";

function remainingLabel(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}시간 ${minutes % 60}분 남았어요` : `${minutes}분 남았어요`;
}

export default function RoomInvite({ availability, shared, state, onCreate, onRevoke, onRetry, onAccount }: {
  availability: InviteAvailability;
  shared: SharedRoom | null;
  state: InviteState;
  onCreate: () => void;
  onRevoke: () => void;
  onRetry: () => void;
  onAccount: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [copyNotice, setCopyNotice] = useState("");
  const active = state.status === "active" ? state : null;

  // 남은 유효 시간은 30초마다 다시 센다.
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => { setCopyNotice(""); }, [active?.code]);

  if (availability === "signed-out") return <div className="room-invite">
    <p>로그인하면 학습 짝을 초대할 수 있어요.</p>
    <button type="button" onClick={onAccount}>로그인하러 가기</button>
  </div>;
  if (availability === "unavailable") return <div className="room-invite">
    <p>이 환경에서는 로그인을 쓸 수 없어 학습 짝을 초대할 수 없어요.</p>
  </div>;
  if (availability === "loading") return <div className="room-invite"><p role="status">학습방 정보를 받아 오고 있어요.</p></div>;
  if (availability === "error") return <div className="room-invite warn" role="status">
    <p>학습방 정보를 받아 오지 못했어요.</p>
    <button type="button" onClick={onRetry}>다시 시도</button>
  </div>;

  // 학습 짝 쪽이거나 닫힌 학습방은 초대할 수 없다. 닫힌 학습방의 안내는 녹음 영역 자리에 있다.
  if (shared?.role === "partner" || shared?.closed) return null;
  if (shared?.partnerName) return <div className="room-invite done">
    <p>학습 짝 {shared.partnerName} 님이 들어와 있어요. 보낸 음성 메시지가 학습 짝에게 전달돼요.</p>
  </div>;

  if (state.status === "creating") return <div className="room-invite">
    <p role="status">초대 코드를 만들고 있어요.</p>
  </div>;

  if (active) {
    const expired = active.expiresAt <= now;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(active.code);
        setCopyNotice("초대 코드를 복사했어요.");
      } catch {
        setCopyNotice("복사하지 못했어요. 코드를 직접 적어 학습 짝에게 알려 주세요.");
      }
    };
    return <div className="room-invite">
      {expired ? <p role="status">초대 코드가 만료됐어요. 새로 만들어 학습 짝에게 알려 주세요.</p> : <>
        <p>학습 짝에게 이 초대 코드를 알려 주세요. 학습 짝이 로그인한 뒤 학습방 목록에서 입력하면 들어와요.</p>
        <strong className="invite-code" aria-label={`초대 코드 ${active.code.split("").join(" ")}`}>{active.code}</strong>
        <p className="invite-expiry">한 번만 쓸 수 있고 {remainingLabel(active.expiresAt - now)}.</p>
      </>}
      <div className="room-invite-actions">
        {!expired && <button type="button" onClick={copy}>코드 복사</button>}
        {!expired && <button type="button" onClick={onRevoke}>코드 취소</button>}
        <button type="button" onClick={onCreate}>새로 만들기</button>
      </div>
      {active.revokeFailed && <p className="room-invite-error" role="alert">코드를 취소하지 못했어요. {INVITE_FAILURE_MESSAGE[active.revokeFailed]}</p>}
      <p className="room-invite-notice" role="status">{copyNotice}</p>
    </div>;
  }

  return <div className="room-invite">
    {state.status === "failed"
      ? <p className="room-invite-error" role="alert">{INVITE_FAILURE_MESSAGE[state.reason]}</p>
      : <p>초대 코드를 만들어 학습 짝에게 알려 주면 이 학습방에 함께 들어와요.</p>}
    {!(state.status === "failed" && (state.reason === "has-partner" || state.reason === "closed")) &&
      <button type="button" onClick={onCreate}>{state.status === "failed" ? "다시 시도" : "초대 코드 만들기"}</button>}
  </div>;
}
