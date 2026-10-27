# Tasks: 저장한 표현 복습

**Input**: `specs/003-review/` spec·plan·research·data-model·contracts

## Phase 1: Setup

- [X] T001 `.specify/feature.json` 경로 및 `specs/003-review/checklists/requirements.md` 통과 확인, `.gitignore` 기존 Node 산출물 제외 확인

## Phase 2: Foundational

- [X] T002 `app/lib/reviews.ts`에 ReviewRecord 검증·별도 저장소·고아 제거 구현 (FR-006,FR-007,FR-012). expressionId는 현재 표현에 존재, dueDate 실제 YYYY-MM-DD, intervalDays 정수1~30, knownCount 안전한 정수0 이상, answerCount 안전한 정수1 이상이며 knownCount 이상
- [X] T003 `app/lib/reviews.ts`에 로컬 날짜·간격·정렬·정답률 순수 함수 구현 (FR-001,FR-003,FR-010)

## Phase 3: US1 오늘의 카드 복습 (P1, MVP)

**Independent Test**: quickstart S1/S2/S4. 저장 표현으로 복습 후 새로고침하여 일정 확인.

- [X] T004 [US1] `app/hooks/useReviews.ts`에 3상태·현황 읽기·start/answer/end 구현 (FR-001,FR-005~FR-007,FR-012)
- [X] T005 [US1] `app/hooks/useReviews.ts`에 최대20개·재등장1회 큐·최종 응답·저장 실패 보존·중복 응답 차단 구현 (FR-003~FR-005,SC-002)
- [X] T006 [US1] `app/components/ReviewSession.tsx`에 실제 앞뒤·예문·출처·진행·응답·이탈·실패 UI 구현 (FR-002,FR-007,FR-011,SC-001)
- [X] T007 [US1] `app/page.tsx`에 단일 훅과 세션 연결, 기존 고정 Review/answer 제거 (FR-005)

## Phase 4: US2 결과와 다음 행동 (P2)

**Independent Test**: quickstart S3. 한 카드 재등장 후 고유 카드 최종 응답 합계 확인.

- [X] T008 [US2] `app/components/ReviewComplete.tsx`에 고유 카드/최종 응답/복귀/포커스 구현 (FR-008,FR-011,SC-003)
- [X] T009 [US2] `app/page.tsx`에 완료 화면과 홈/학습방 복귀 연결 (FR-008)

## Phase 5: US3 실제 현황 (P2)

**Independent Test**: quickstart S3/S4. 두 진입의 수 일치 및 0개/미래 예정 구분.

- [X] T010 [P] [US3] `app/components/ReviewEntry.tsx`에 대기·실패·재시도·빈 상태2종·실제 시작 구현 (FR-007,FR-009)
- [X] T011 [US3] `app/components/ReviewHome.tsx`에 실제 수/누적 정답률·기록 없음·전체 보기 구현 (FR-010)
- [X] T012 [US3] `app/page.tsx`에 홈 복습/통계·Cards 진입 연결, 대화한 날 제거, hero-card 보존 (FR-009,FR-010,SC-004)

## Phase 6: Polish

- [X] T013 `app/globals.css`에 기존 변수만 쓰는 시맨틱 복습 스타일·긴 텍스트·키보드 포커스 추가 (FR-011,SC-005)
- [X] T014 `README.md` 주요 기능·현재 범위·구조 동기화 (원칙 II)
- [X] T015 `app/lib/reviews.ts` 순수 로직을 Node로 검증하고 `npm.cmd run build`, `specs/003-review/quickstart.md`에 결과/브라우저 인계 기록
- [X] T016 `specs/003-review/spec.md` 상태 및 `specs/003-review/tasks.md` 완료 갱신 후 두 번째 구현 커밋

## Dependencies & Execution Order

T001 → T002/T003 → T004/T005 → T006/T007 → T008/T009 → T010~T012 → T013~T016.
US1이 MVP. US2는 세션 종료 결과를, US3는 공통 현황을 사용한다.
독립 파일인 T010과 T008은 공통 훅 계약 확정 후 병렬 가능하나 이번 구현은 순차 수행한다.
US1 완료 시 저장·간격 검증, 이후 완료/진입을 추가하고 최종 빌드한다.
브라우저 수동 검증은 사용자 지시에 따라 별도 검증자에게 인계하며 체크 완료로 주장하지 않는다.

## 요구사항 추적

| 요구사항 | 작업 |
|---|---|
| FR-001 | T003,T004,T005 |
| FR-002 | T006 |
| FR-003 | T003,T005 |
| FR-004 | T005 |
| FR-005 | T004,T005,T007 |
| FR-006 | T002,T004 |
| FR-007 | T002,T004,T006,T010 |
| FR-008 | T008,T009 |
| FR-009 | T010,T012 |
| FR-010 | T003,T011,T012 |
| FR-011 | T006,T008,T013 |
| FR-012 | T002,T004 |
| SC-001~SC-005 | T005,T006,T008,T012,T013,T015 |

## 완료 기록

T001~T016 구현/검증·커밋 완료.
브라우저 시나리오는 별도 검증자에게 인계한다.
