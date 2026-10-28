# Contract: `useExpressions`

**File**: `app/hooks/useExpressions.ts` (저장소 접근은 `app/lib/expressions.ts`)
**Covers**: FR-014, FR-015, FR-016, FR-017, FR-018, FR-021, FR-022
**Model**: [data-model.md](../data-model.md) §1 §4 §5

표현 모음의 단일 소유자다. `TalklogApp` 셸에서 한 번만 호출한다.

## 출력

```ts
type UseExpressionsResult = {
  status: "loading" | "ready" | "unavailable";
  expressions: SavedExpression[];          // savedAt 내림차순 (FR-017)
  count: number;                           // expressions.length (FR-018)

  findDuplicate: (term: string) => SavedExpression | null;
  save: (draft: {
    term: string;
    meaning: string;
    example: string;
    sourceRoom: string;
  }) => { ok: true; saved: SavedExpression } | { ok: false; reason: SaveFailure };
  remove: (id: string) => boolean;         // 성공 여부
};

type SaveFailure = "invalid-term" | "invalid-meaning" | "duplicate" | "storage-unavailable";
```

## 계약 조항

1. 첫 렌더의 `status`는 항상 `"loading"`이다. 저장소 읽기는 `useEffect` 안에서만
   한다 — 렌더 중에 읽으면 hydration 이 어긋난다 (R-004).
2. `expressions`는 `savedAt` 내림차순으로 정렬해 반환한다. 호출자가 정렬하지 않는다
   (FR-017).
3. `count`는 언제나 `expressions.length`와 같다. 별도 카운터를 두지 않는다 (FR-018).
4. `findDuplicate(term)`은 `term.trim().normalize("NFC")` 로 정규화해 비교한다. 예문은
   비교하지 않는다 (R-005).
5. `save()`는 실패 이유를 구분해 반환한다. 호출자가 어떤 문구를 보여줄지 결정할 수
   있어야 한다:
   - `"invalid-term"` — `term`이 비었거나 문자·숫자가 없다 (FR-005)
   - `"invalid-meaning"` — `meaning`이 비었다 (FR-008)
   - `"duplicate"` — 같은 표현이 이미 있다. **아무것도 저장하지 않는다** (FR-021)
   - `"storage-unavailable"` — 저장소 쓰기가 실패했다 (FR-015)
6. `save()`가 `{ ok: false }`를 돌려주면 `expressions`는 변하지 않는다. 화면에서만
   성공한 것처럼 보이는 상태를 만들어서는 안 된다 (원칙 II, FR-015).
7. 저장소 접근에서 예외가 나면 `status`를 `"unavailable"`로 바꾼다. 예외를 삼켜
   조용히 실패해서는 안 된다 (R-003).
8. `status === "unavailable"` 은 영구가 아니다. 이후 시도가 성공하면 `"ready"` 로
   되돌린다 — 브라우저 설정이 그동안 바뀔 수 있다.
9. 저장소 접근(읽기·쓰기·삭제)은 전부 `app/lib/expressions.ts`의 순수 함수에 두고,
   훅은 상태 관리만 한다. 접근 자체가 예외를 던지는 환경이 있으므로 모든 호출을
   `try`/`catch` 로 감싼다 (R-003).
10. `remove(id)`는 저장소에서도 지운다. 새로고침 후 다시 나타나서는 안 된다
    (US3 시나리오 4).
11. 저장소 키는 `talklog.expressions` 하나이며 JSON 배열을 담는다. 표현마다 별도 키를
    쓰지 않는다 (R-003).
12. 저장소에서 읽은 값이 배열이 아니거나 필드가 깨져 있으면 그 항목을 버리고 나머지를
    쓴다. 전체를 버리거나 예외를 던져 화면을 멈추게 하지 않는다.
13. `reload(): void`는 저장소를 다시 읽는다. 성공하면 `expressions`를 `savedAt` 내림차순으로
    갱신하고 `status`를 `"ready"`로 바꾼다. 실패하면 기존 목록을 유지하고 `status`를
    `"unavailable"`로 둔다. 첫 렌더의 loading 규칙과 기존 쓰기 동작은 유지한다.
