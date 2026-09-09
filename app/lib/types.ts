// specs/001-voice-recording/data-model.md §2 §3 §4

export type Sender = "me" | "partner";

/**
 * 재생할 실제 소리가 있는지를 나타낸다.
 * - "mock": 흐름 검증용 예시 메시지. 재생할 소리가 없다.
 * - "recorded": 사용자가 실제로 녹음해 전송한 메시지.
 */
export type MessageSource = "mock" | "recorded";

/**
 * 대화에 놓인 음성 메시지.
 *
 * 불변식 (data-model.md §2 — Constitution 원칙 II: Mock 경계 명시):
 *   source === "recorded"  이면 반드시  url !== null
 *   source === "mock"      이면 반드시  url === null  → 재생 버튼은 비활성이어야 한다
 */
export type VoiceMessage = {
  id: string;
  sender: Sender;
  durationMs: number;
  sentAtLabel: string;
  source: MessageSource;
  url: string | null;
  readLabel: string | null;
};

/** 마이크 사용 상태. 녹음 영역이 무엇을 보여줄지 결정한다 (data-model.md §3). */
export type MicrophoneStatus =
  | "unknown"
  | "requesting"
  | "granted"
  | "denied"
  | "no-device"
  | "unsupported"
  | "error";

/** 녹음 상태 머신 (data-model.md §4). 전이는 T1~T15 표를 따른다. */
export type RecordingState = "idle" | "requesting" | "recording" | "review" | "blocked";

/** 녹음이 멈춘 이유. "limit"이면 60초 상한에 도달해 자동 종료된 것이다 (FR-009a). */
export type StopReason = "user" | "limit";
