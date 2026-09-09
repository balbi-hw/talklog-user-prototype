"use client";

import { formatDuration } from "../lib/audio";
import type { MicrophoneStatus, RecordingState, StopReason } from "../lib/types";

/**
 * blocked 상태의 문구 (contracts/recorder-ui.md, FR-019).
 * 네 경우를 같은 문구로 합치면 FR-019 위반이다 — 사용자가 무엇을 해야 할지 달라진다.
 */
const BLOCKED_MESSAGES: Record<string, string> = {
  denied:
    "마이크 사용이 차단돼 있어요. 브라우저 주소창의 자물쇠 아이콘에서 마이크를 허용해주세요.",
  "no-device": "마이크를 찾을 수 없어요. 마이크가 연결돼 있는지 확인해주세요.",
  unsupported:
    "이 브라우저에서는 음성 녹음을 지원하지 않아요. 다른 기능은 그대로 사용할 수 있어요.",
  error:
    "녹음을 시작할 수 없었어요. 다른 앱이 마이크를 쓰고 있는지 확인하고 다시 시도해주세요.",
};

type RecorderProps = {
  state: RecordingState;
  micStatus: MicrophoneStatus;
  elapsedMs: number;
  stopReason: StopReason | null;
  sendable: boolean;
  isPreviewPlaying: boolean;
  onStart: () => void;
  onStop: () => void;
  onPreview: () => void;
  onRetake: () => void;
  onCancel: () => void;
  onSend: () => void;
};

/**
 * 녹음 영역 (contracts/recorder-ui.md).
 * state 에 따라 idle / requesting / recording / review / blocked 중 하나만 렌더링한다.
 */
export default function Recorder({
  state,
  micStatus,
  elapsedMs,
  stopReason,
  sendable,
  isPreviewPlaying,
  onStart,
  onStop,
  onPreview,
  onRetake,
  onCancel,
  onSend,
}: RecorderProps) {
  if (state === "blocked") {
    return (
      <div className="recorder recorder-blocked">
        <p role="status">{BLOCKED_MESSAGES[micStatus] ?? BLOCKED_MESSAGES.error}</p>
        {/* unsupported 에서는 다시 시도를 제공하지 않는다 — 재시도해도 결과가 같다. */}
        {micStatus !== "unsupported" && (
          <button className="recorder-retry" onClick={onStart}>
            다시 시도
          </button>
        )}
      </div>
    );
  }

  if (state === "review") {
    return (
      <div className="recorder recorder-review">
        <div className="review-length">
          <strong>{formatDuration(elapsedMs)}</strong>
          <span>보내기 전에 들어볼 수 있어요</span>
        </div>

        {/* FR-009a: 상한 때문에 멈췄음을 알린다. */}
        {stopReason === "limit" && (
          <p className="recorder-notice" role="status">
            60초까지만 녹음돼요
          </p>
        )}

        {/* FR-010: 전송을 막는 이유를 화면에 문구로 보여준다 (title 만으로는 부족하다). */}
        {!sendable && (
          <p className="recorder-notice" id="send-blocked-reason">
            녹음이 너무 짧아요. 1초 이상 말한 뒤에 보낼 수 있어요.
          </p>
        )}

        <div className="recorder-actions">
          <button onClick={onPreview} aria-pressed={isPreviewPlaying}>
            <span aria-hidden="true">{isPreviewPlaying ? "❙❙" : "▶"}</span>
            {isPreviewPlaying ? " 멈추기" : " 들어보기"}
          </button>
          <button onClick={onRetake}>
            <span aria-hidden="true">↻</span> 다시 녹음
          </button>
          <button onClick={onCancel}>취소</button>
          <button
            className="send-button"
            onClick={onSend}
            disabled={!sendable}
            aria-describedby={sendable ? undefined : "send-blocked-reason"}
          >
            보내기
          </button>
        </div>
      </div>
    );
  }

  const isRecording = state === "recording";
  const isRequesting = state === "requesting";

  return (
    <div className={`recorder ${isRecording ? "is-recording" : ""}`}>
      {isRecording && (
        <span className="record-time">
          <span aria-hidden="true">●</span> {formatDuration(elapsedMs)}
        </span>
      )}
      {/* 1초마다 바뀌는 시간에는 aria-live 를 걸지 않는다 — 상태 문구에만 건다. */}
      <p aria-live="polite">
        {isRequesting
          ? "마이크 사용을 허용해주세요"
          : isRecording
            ? "말하고 있어요…"
            : "눌러서 음성 메시지를 녹음하세요"}
      </p>
      <button
        className="record-button"
        onClick={isRecording ? onStop : onStart}
        disabled={isRequesting}
        aria-busy={isRequesting}
        aria-label={isRecording ? "녹음 완료" : "녹음 시작"}
      >
        {isRecording ? (
          <span className="stop" aria-hidden="true" />
        ) : (
          <span className="mic" aria-hidden="true">
            ●
          </span>
        )}
      </button>
      <small>
        {isRecording
          ? "완료하려면 다시 눌러주세요"
          : isRequesting
            ? "브라우저 권한 창에서 허용을 눌러주세요"
            : "마이크 버튼을 누르면 녹음이 시작돼요"}
      </small>
    </div>
  );
}
