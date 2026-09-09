# Contract: `useVoiceRecorder`

**File**: `app/hooks/useVoiceRecorder.ts`
**Covers**: FR-001~FR-010, FR-017~FR-022 | **Model**: [data-model.md](../data-model.md) §1 §3 §4

녹음 상태 머신과 마이크 장치 제어를 담당한다. UI를 렌더링하지 않는다.

## 입력

```ts
type UseVoiceRecorderOptions = {
  maxDurationMs?: number;   // 기본 60_000 (FR-009)
  minDurationMs?: number;   // 기본 1_000  (FR-010)
  onSend: (recording: SentRecording) => void;  // T11. 호출자가 대화에 메시지를 추가한다
};

type SentRecording = {
  url: string;        // 소유권이 호출자에게 넘어간다. 훅은 revoke 하지 않는다
  durationMs: number;
};
```

## 출력

```ts
type UseVoiceRecorderResult = {
  state: "idle" | "requesting" | "recording" | "review" | "blocked";
  micStatus: "unknown" | "requesting" | "granted" | "denied"
           | "no-device" | "unsupported" | "error";

  elapsedMs: number;       // recording 중에는 경과, review 에서는 최종 길이
  stopReason: "user" | "limit" | null;
  sendable: boolean;       // review 에서만 의미가 있다 (FR-010)
  previewUrl: string | null;  // review 에서만 값이 있다

  start: () => void;       // T1, T15
  stop: () => void;        // T4
  retake: () => void;      // T10
  send: () => void;        // T11 / T12
  cancel: () => void;      // T13
  discard: () => void;     // T7 · T14 확인 후 폐기
  hasPending: boolean;     // recording 또는 review — FR-022 판단에 사용
};
```

## 계약 조항

1. `start()`는 `state`가 `idle` 또는 `blocked`일 때만 효과가 있다. `micStatus`가
   `"unsupported"`면 아무 일도 하지 않는다 (T15 예외).
2. `stop()`은 `recording`에서만 효과가 있다.
3. `send()`는 `sendable === false`면 `onSend`를 호출하지 않는다 (T12).
4. `send()`가 `onSend`를 호출한 뒤 훅은 `previewUrl`을 `revokeObjectURL` 하지 **않는다**.
   URL 소유권이 호출자로 넘어간다.
5. `retake()` · `cancel()` · `discard()`는 반드시 `revokeObjectURL(previewUrl)`을
   호출한다.
6. 녹음이 끝나는 모든 경로에서 `stream.getTracks().forEach(t => t.stop())`을 호출한다
   (R-005).
7. 언마운트 시 진행 중인 녹음을 정리하고 URL을 해제한다 (T8).
8. `elapsedMs`는 `performance.now()` 기준 차이로 계산한다. 인터벌 카운터를 누적하지
   않는다 (R-003).
9. `elapsedMs >= maxDurationMs`면 훅이 스스로 `stop()`하고 `stopReason = "limit"`으로
   둔다 (T5).
10. `micStatus`는 `getUserMedia` 오류 `name`으로만 결정한다. Permissions API를 호출하지
    않는다 (R-002, FR-017).

11. `SentRecording`에 `mimeType`을 담지 않는다. `VoiceMessage`(data-model.md §2)에 해당
    필드가 없어 전달해도 버려진다. 형식은 훅 내부에서만 쓴다 (analyze F1).
