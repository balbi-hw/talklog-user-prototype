# Contract: useReviews

**Files**: `app/hooks/useReviews.ts`, `app/lib/reviews.ts`
**Covers**: FR-001, FR-003~FR-008, FR-010, FR-012

입력 UseExpressionsResult는 읽기 전용. 셸에서 한 번 호출한다.

| 출력 | 계약 |
|---|---|
| status | loading/ready/unavailable, 첫 렌더 loading, 표현 상태 반영 |
| dueCount, nextDate, expressionCount, accuracy | 전체 현재 표현 기준 파생값, 세션 제한 전 대상 수 |
| session/current | 큐·위치·고유 카드 수·최종 응답 / 현재 최신 표현 |
| start() | 최신 두 저장소를 읽어 세션 시작. 실패/0개는 안내 |
| answer(know/again) | 동기 결과 반환. 성공한 응답만 진행/집계 |
| refresh() | 저장소 재시도, 실패 카드와 세션 유지 |
| end() | 세션만 초기화, 영속 기록 불변 |

읽기는 effect/이벤트에서만 한다. 창 포커스·storage 이벤트·자정 갱신.
쓰기 전 두 저장소를 다시 읽고 삭제된 표현에는 기록하지 않는다.
동일 큐 항목의 중복 클릭은 두 번 기록하지 않으며 실패 후 재시도는 막지 않는다.
