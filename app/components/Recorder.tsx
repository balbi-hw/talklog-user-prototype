"use client";

import { formatDuration } from "../lib/audio";
import type { MicrophoneStatus, RecordingState, StopReason } from "../lib/types";

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
    // TODO(T023 · T024, Phase 5): micStatus 4가지에 서로 다른 문구와 재시도 규칙을 적용한다.
    // 현재는 화면이 비지 않게 하는 최소 안내만 제공한다 (원칙 V).
    return (
      <div className="recorder recorder-blocked">
        <p role="status">
          녹음을 시작할 수 없었어요. 마이크 사용을 허용했는지 확인하고 다시 시도해주세요.
        </p>
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
            {isPreviewPlaying ? "❙❙ 멈추기" : "▶ 들어보기"}
          </button>
          <button onClick={onRetake}>↻ 다시 녹음</button>
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
      {isRecording && <span className="record-time">● {formatDuration(elapsedMs)}</span>}
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
        {isRecording ? <span className="stop" /> : <span className="mic">●</span>}
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
