# Contract: `useVoicePlayback`

**File**: `app/hooks/useVoicePlayback.ts`
**Covers**: FR-011~FR-015 | **Model**: [data-model.md](../data-model.md) §5

대화 전체의 재생을 조율한다. `HTMLAudioElement` 인스턴스를 하나만 소유한다.

## 출력

```ts
type UseVoicePlaybackResult = {
  activeId: string | null;
  positionMs: number;
  durationMs: number;
  progress: number;                 // 0~1. durationMs 가 0이면 0
  toggle: (id: string, url: string, durationMs: number) => void;
  stop: () => void;
};
```

## 계약 조항

1. `toggle(id, ...)`을 `activeId === id`인 상태에서 호출하면 재생을 멈추고 `activeId`를
   `null`로 만든다.
2. `toggle(id, ...)`을 다른 대상이 재생 중일 때 호출하면 이전 재생을 멈추고 새 대상을
   위치 0부터 재생한다. 두 소리가 겹치지 않는다 (FR-012, SC-005).
3. `progress`는 인수로 받은 `durationMs`를 분모로 쓴다. `audio.duration`을 쓰지 않는다
   (R-003).
4. `ended` 시 `activeId = null`, `positionMs = 0`으로 되돌린다 (FR-015).
5. 재생 중인 대상의 `url`이 무효해지면(다시 녹음·취소) 호출자가 `stop()`을 불러야 한다.
   훅은 URL 유효성을 감시하지 않는다.
6. 언마운트 시 재생을 멈추고 `src`를 비운다.
7. 미리 듣기는 `id = "__preview__"`로 호출한다. 훅은 이 값을 특별 취급하지 않는다.
