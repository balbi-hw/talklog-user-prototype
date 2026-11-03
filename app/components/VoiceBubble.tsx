"use client";

import { useRef } from "react";
import { formatDuration } from "../lib/audio";
import type { VoiceMessage } from "../lib/types";

/** 고정 막대 파형. 실제 음성을 분석하지 않는다 (Constitution 원칙 IV). */
export const Wave = ({ light = false }: { light?: boolean }) => (
  <div className={`wave ${light ? "wave-light" : ""}`} aria-hidden="true">
    {[9, 18, 12, 24, 16, 29, 20, 13, 23, 17, 27, 14, 21, 11, 18, 8].map((h, i) => (
      <i key={i} style={{ height: h }} />
    ))}
  </div>
);

type VoiceBubbleProps = {
  message: VoiceMessage;
  isActive: boolean;
  progress: number;
  onToggle?: () => void;
  /** 011: 재생하지 못했을 때 다시 시도. 있으면 실패 안내를 보인다. */
  playFailed?: boolean;
  onRetryPlay?: () => void;
  /** 011: 보내지 못한 메시지의 다시 보내기·지우기. */
  onResend?: () => void;
  onDiscard?: () => void;
};

/**
 * 음성 메시지 버블 (contracts/voice-message-ui.md).
 *
 * FR-016 / 원칙 II: source === "mock" 메시지는 재생할 소리가 없으므로 재생 버튼을
 * 비활성으로 둔다. 눌리는 것처럼 보이지만 아무 일도 일어나지 않는 상태를 만들지 않는다.
 */
export default function VoiceBubble({ message, isActive, progress, onToggle, playFailed, onRetryPlay, onResend, onDiscard }: VoiceBubbleProps) {
  const isMine = message.sender === "me";
  const playable = message.source === "recorded" && message.url !== null && !!onToggle;

  const label = !playable
    ? "재생할 음성이 없는 예시 메시지입니다"
    : isActive
      ? "일시정지"
      : "음성 재생";

  const delivery = message.delivery ?? "sent";
  // 다시 보내기·다시 재생을 누르면 그 버튼이 사라진다. 포커스를 이 메시지의 재생 버튼으로 옮긴다 (D6).
  const playRef = useRef<HTMLButtonElement>(null);
  const keepFocus = () => requestAnimationFrame(() => playRef.current?.focus());

  return (<>
    <div
      className={`bubble audio-bubble voice-bubble ${isMine ? "mine-bubble" : ""} ${
        isActive ? "is-active" : ""
      }`}
    >
      <button className="play-button" ref={playRef} onClick={onToggle} disabled={!playable} aria-label={label}>
        <span aria-hidden="true">{isActive ? "❙❙" : "▶"}</span>
      </button>
      <div className="wave-track">
        <Wave light={isMine} />
        {isActive && (
          <span
            className="bubble-progress"
            style={{ width: `${Math.round(progress * 100)}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <time>
        {formatDuration(isActive ? progress * message.durationMs : message.durationMs)}
      </time>
    </div>
    {/* 011 FR-007: 보내는 중·실패 상태. 보낸 시각은 보낸 뒤에만 보인다 (화면이 sent 일 때만 표시). */}
    {delivery === "sending" && <p className="delivery-status" role="status">보내는 중…</p>}
    {delivery === "failed" && <div className="delivery-status failed" role="status">
      <p>보내지 못했어요. 녹음은 이 화면에 남아 있어요.</p>
      <div className="delivery-actions">
        {onResend && <button type="button" onClick={() => { onResend(); keepFocus(); }} aria-label="이 음성 메시지 다시 보내기">다시 보내기</button>}
        {onDiscard && <button type="button" onClick={onDiscard} aria-label="보내지 못한 음성 메시지 지우기">지우기</button>}
      </div>
    </div>}
    {playFailed && <div className="delivery-status failed" role="status">
      <p>음성을 재생하지 못했어요.</p>
      {onRetryPlay && <div className="delivery-actions"><button type="button" onClick={() => { onRetryPlay(); keepFocus(); }} aria-label="음성 다시 재생하기">다시 시도</button></div>}
    </div>}
  </>);
}
