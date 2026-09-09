# Contract: `useTranscriptSelection`

**File**: `app/hooks/useTranscriptSelection.ts`
**Covers**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-028
**Model**: [data-model.md](../data-model.md) §3

스크립트 요소 안에서 일어난 글자 선택만 읽는다. UI를 렌더링하지 않고 저장소를 다루지
않는다.

## 입력

```ts
type UseTranscriptSelectionOptions = {
  transcriptRef: React.RefObject<HTMLElement | null>;
  example: string;      // 그 스크립트의 전체 텍스트 (FR-010)
  sourceRoom: string;   // 그 스크립트가 속한 학습방 (FR-011)
  enabled: boolean;     // 스크립트가 열려 있는지 (FR-006)
};
```

## 출력

```ts
type TranscriptSelection = {
  text: string;
  example: string;
  sourceRoom: string;
};

type UseTranscriptSelectionResult = {
  selection: TranscriptSelection | null;   // isValid 하지 않으면 null
  clear: () => void;                       // 선택을 지우고 null 로 만든다
};
```

## 계약 조항

1. `selection`이 `null`이 아니려면 data-model.md §3의 유효 조건 4개를 모두 만족해야
   한다. 하나라도 어긋나면 `null`이다.
2. 선택이 `transcriptRef.current` 밖에서 일어났으면 `null`이다. 화면의 다른 텍스트를
   선택했을 때 저장 수단이 나타나서는 안 된다 (R-001).
3. `enabled`가 `false`면 항상 `null`이다 (FR-006).
4. `text`는 `trim()` 을 적용한 값이다. 문자·숫자가 하나도 없으면 `null`이다 (FR-005).
5. 선택 확정은 `document`의 `selectionchange`와 `pointerup` · `keyup`을 모두 듣고 같은
   읽기 함수를 호출해 판정한다. 브라우저 사이 `selectionchange` 발생 시점이 달라 어느
   한쪽만으로는 놓치는 경우가 있다 (R-001).
6. **입력 수단으로 분기하지 않는다.** 마우스 드래그 · 터치 롱프레스 · `Shift`+방향키가
   모두 같은 경로로 처리된다. 이것이 FR-028을 별도 UI 없이 충족하는 방식이다 (R-002).
7. `clear()`는 브라우저 선택도 함께 해제한다 (`selection.removeAllRanges()`).
8. 언마운트 시 등록한 이벤트 리스너를 모두 해제한다.
9. 훅은 초안(`ExpressionDraft`)을 만들지 않는다. 초안 생성은 호출자의 몫이다.
