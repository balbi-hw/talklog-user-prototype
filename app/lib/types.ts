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

// specs/002-expression-capture/data-model.md §1 §2 §4
// 이름은 docs/domain-model.md §4 용어집에서만 뽑았다 (Constitution 원칙 I).
// "단어" · "어휘" · "플래시카드" 는 용어집이 금지한 말이므로 쓰지 않는다.

/**
 * 저장된 표현 (data-model.md §1).
 *
 * 결정 D-1에 따라 단어 · 구 · 문장을 모두 담으며 길이로 종류를 구분하지 않는다.
 */
export type SavedExpression = {
  id: string;
  /** 표현 본문. 사용자가 고르고 다듬은 것 (FR-001, FR-009) */
  term: string;
  /** 뜻. 사용자가 직접 적는다 (FR-007) */
  meaning: string;
  /** 표현이 나온 문장 전체 (FR-010) */
  example: string;
  /** 출처 학습방 이름 (FR-011) */
  sourceRoom: string;
  /** 저장 시각(epoch ms). 정렬 기준 (FR-017) */
  savedAt: number;
};

/** 저장 전 초안 (data-model.md §2). 동시에 최대 1개만 존재한다. */
export type ExpressionDraft = {
  term: string;
  meaning: string;
  /** 고를 때 확정되며 사용자가 고치지 않는다 — 고치면 근거가 사라진다 */
  example: string;
  sourceRoom: string;
};

/**
 * 저장소 상태 (data-model.md §4).
 *
 * `loading` 과 "저장한 것이 없음"을 같은 화면으로 처리해서는 안 된다. 표현이 있는
 * 사용자에게도 빈 상태 안내가 한 순간 보이고, 사용자는 저장이 사라졌다고 오해한다 (R-004).
 */
export type StorageStatus = "loading" | "ready" | "unavailable";

/** 저장 실패 이유. 화면이 이유별로 다른 문구를 보여줄 수 있어야 한다 (계약 조항 5). */
export type SaveFailure =
  | "invalid-term"
  | "invalid-meaning"
  | "duplicate"
  | "storage-unavailable";

/** 005: 예문·출처·식별자·저장 시각은 편집 입력으로 받지 않는다. */
export type ExpressionUpdate = Pick<SavedExpression, "term" | "meaning">;

export type UpdateFailure = SaveFailure | "not-found";

export type UpdateResult =
  | { ok: true; saved: SavedExpression }
  | { ok: false; reason: UpdateFailure };
