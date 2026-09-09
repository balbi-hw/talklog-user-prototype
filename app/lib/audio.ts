import type { MicrophoneStatus } from "./types";

/**
 * 브라우저 오디오 유틸리티.
 *
 * 이 파일의 함수는 모두 클라이언트에서만 호출해야 한다. 서버 렌더링 중에는
 * MediaRecorder·navigator가 없어 isRecordingSupported()가 false를 돌려주므로,
 * 렌더 시점이 아니라 이벤트 핸들러나 useEffect 안에서 호출한다.
 */

// research.md R-001: 브라우저마다 지원 컨테이너가 달라 런타임에 선택한다.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/** 지원되는 첫 형식을 반환한다. 아무것도 지원하지 않으면 빈 문자열(브라우저 기본값)이다. */
export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * getUserMedia 오류를 마이크 상태로 분류한다 (research.md R-002).
 * Permissions API는 브라우저 지원이 고르지 않아 사용하지 않는다.
 */
export function classifyMicError(error: unknown): MicrophoneStatus {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return "no-device";
    case "SecurityError":
      return "unsupported";
    default:
      // NotReadableError, AbortError, TrackStartError 및 그 외 전부
      return "error";
  }
}

/** 밀리초를 `0:08` 형태로 표시한다 (FR-002: 1초 단위). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
