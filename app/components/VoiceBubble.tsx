"use client";

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
};

/**
 * 음성 메시지 버블 (contracts/voice-message-ui.md).
 *
 * FR-016 / 원칙 II: source === "mock" 메시지는 재생할 소리가 없으므로 재생 버튼을
 * 비활성으로 둔다. 눌리는 것처럼 보이지만 아무 일도 일어나지 않는 상태를 만들지 않는다.
 */
export default function VoiceBubble({ message, isActive, progress, onToggle }: VoiceBubbleProps) {
  const isMine = message.sender === "me";
  const playable = message.source === "recorded" && message.url !== null && !!onToggle;

  const label = !playable
    ? "재생할 음성이 없는 예시 메시지입니다"
    : isActive
      ? "일시정지"
      : "음성 재생";

  return (
    <div
      className={`bubble audio-bubble voice-bubble ${isMine ? "mine-bubble" : ""} ${
        isActive ? "is-active" : ""
      }`}
    >
      <button className="play-button" onClick={onToggle} disabled={!playable} aria-label={label}>
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
  );
}
