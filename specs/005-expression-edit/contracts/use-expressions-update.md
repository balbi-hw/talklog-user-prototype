# Contract: useExpressions.update

**File**: app/hooks/useExpressions.ts, app/lib/expressions.ts, app/lib/types.ts
**Covers**: FR-003, FR-004, FR-006, FR-007, FR-009, FR-010, FR-011, FR-015

```ts
type ExpressionUpdate = Pick<SavedExpression, "term" | "meaning">;
type UpdateFailure = SaveFailure | "not-found";
type UpdateResult =
  | { ok: true; saved: SavedExpression }
  | { ok: false; reason: UpdateFailure };
// UseExpressionsResult에 추가
update: (id: string, changes: ExpressionUpdate) => UpdateResult;
```

1. 기존 status·expressions·count·findDuplicate·save·remove의 시그니처와 동작은 유지한다.
2. 매 호출 readAll로 최신 배열을 읽고 실패하면 unavailable을 반환한다.
3. 순수 updateExpressionIn은 검증 → 대상 확인 → 자기 자신 제외 중복 확인 →
   최신 대상의 term·meaning만 trim 후 교체한다. 실패 시 입력 배열을 바꾸지 않는다.
4. id·example·sourceRoom·savedAt을 보존한다. 새 id나 시각을 만들지 않는다.
5. 대상 없음은 not-found이며 항목을 추가하거나 저장소에 쓰지 않는다.
6. writeAll 실패 시 status만 unavailable로 바꾸고 목록·ref는 변경하지 않는다.
7. 쓰기 성공 후만 정렬된 next를 ref·상태에 반영하며 ready로 돌아간다.
8. count는 expressions.length이며 편집만으로 늘거나 줄지 않는다. 외부에서 바뀐 항목 수는
   최신 저장소를 기준으로 반영한다.
9. 저장소 접근은 기존 try/catch readAll·writeAll만 사용하고 렌더에서 읽지 않는다.
10. 완전히 동시인 탭 쓰기의 원자성은 보장하지 않는다. 최신 읽기 전 변경은 보존한다.
