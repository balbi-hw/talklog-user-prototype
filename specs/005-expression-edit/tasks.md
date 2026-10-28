# Tasks: 카드 편집

**Input**: `/specs/005-expression-edit/`의 spec·plan·research·data-model·contracts·quickstart

**서브도메인**: 표현 학습 (**Core**), `draft.md` §4 12단계.

**Tests**: 신규 테스트 프레임워크 없음. 빌드·임시 Node 계약 검증과 quickstart 수동 시나리오를
분리한다. 사용자 지시로 수동 브라우저 검증은 별도 검증자가 수행하며 작업 완료로 위장하지 않는다.

## Phase 1: Setup

- [X] T001 `specs/005-expression-edit/spec.md`, `checklists/requirements.md` — 브리프 결정 반영, 요구사항 검토·clarify 완료
- [X] T002 `specs/005-expression-edit/plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` — 헌법 게이트와 설계·수용 시나리오 작성

## Phase 2: Foundational

- [X] T003 `app/lib/types.ts` — ExpressionUpdate는 term·meaning만, UpdateFailure는 SaveFailure + not-found, UpdateResult 추가. 기존 저장 필드·SaveFailure 유지 (FR-003, FR-015)
- [X] T004 `app/lib/expressions.ts` — 순수 updateExpressionIn, 기존 isValidTerm·isValidMeaning·NFC 정규화 재사용, 자기 id 제외, 불변 필드 보존, 실패 이유별 문구 (FR-003, FR-006, FR-007)

## Phase 3: US1 기록을 유지하며 고치기 (P1, MVP)

**Goal**: 항목 편집·저장·취소·영속화. **Independent Test**: quickstart S1.

- [X] T005 [US1] `app/hooks/useExpressions.ts` — update 추가, 최신 readAll 후 변환·쓰기 성공 후만 반영, savedAt·count 유지, 기존 save·remove 동작 유지 (FR-003, FR-004, FR-009, FR-011, FR-015)
- [X] T006 [US1] `app/components/ExpressionList.tsx` — 항목 내부 단일 편집 상태, 본문·뜻 입력, 저장·취소·화면 이동 시 폐기, 예문·출처 텍스트 유지 (FR-001, FR-002, FR-003, FR-005)
- [X] T007 [US1] `app/components/ExpressionList.tsx` — 뜻 autoFocus, 저장·취소 후 편집 버튼 ref 복원, label·aria 속성·role=status·Escape 취소 (FR-004, FR-013)
- [X] T008 [US1] `app/page.tsx` — Cards의 onUpdate만 셸 훅에서 목록까지 연결 (FR-001, FR-015)
- [X] T009 [P] [US1] `app/globals.css` — 편집 폼·동작 버튼·긴 입력 스타일, 기존 CSS 변수만 사용, 320px 셸 대응 (FR-014)

**Checkpoint**: S1·S4의 흐름을 코드 계약과 대조하고 다음 스토리로 진행한다.

## Phase 4: US2 잘못된 변경·중복 막기 (P2)

**Goal**: 입력 즉시 검증·이유 안내. **Independent Test**: quickstart S2.

- [X] T010 [US2] `app/components/ExpressionList.tsx` — 기존 검증·자기 자신 제외 NFC 중복 판정, 저장 비활성과 보이는 이유·aria-describedby (FR-006, FR-007, FR-008)

## Phase 5: US3 실패와 삭제 확인에서 입력 지키기 (P2)

**Goal**: 실패 후 입력 유지·재시도·배타 처리. **Independent Test**: quickstart S3·S4.

- [X] T011 [US3] `app/hooks/useExpressions.ts` — 읽기·쓰기 실패 시 unavailable, 목록·ref 유지, not-found 재생성 금지, 성공 시 ready (FR-010, FR-011)
- [X] T012 [US3] `app/components/ExpressionList.tsx` — unavailable 안내와 기존 목록·입력 함께 유지, 실패 이유·재시도, 초기 실패·빈 상태 구분 (FR-010, FR-014)
- [X] T013 [US3] `app/components/ExpressionList.tsx` — 편집 중 다른 편집·삭제 비활성, 삭제 확인 중 편집 비활성·기존 확인 유지, 이유 문구·취소 포커스 (FR-002, FR-012, FR-013)

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 `README.md` — 주요 기능·현재 구현 범위·구조에 카드 편집 반영 (FR-015)
- [X] T015 `app/lib/expressions.ts`, `app/hooks/useExpressions.ts`, `app/components/ExpressionList.tsx` — 임시 Node 계약 검증·코드 검토, quickstart S1~S5 수동 인계 기록 (FR-001~FR-015, SC-001~SC-005)
- [X] T016 `package.json` — npm.cmd run build 통과·TypeScript 오류 0개 확인, `specs/005-expression-edit/spec.md` 상태·이 파일 결과 갱신

## Dependencies & Execution Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T010 → T011 → T012 → T013 → T014 → T015 → T016.
T009는 T005 이후 T006~T008과 다른 파일이므로 병렬 가능하나 이 작업은 순차 수행한다.
US2·US3는 US1의 편집 진입점에 의존하되 각각 별도 데이터로 독립 검증할 수 있다.

## Parallel Examples

- US1: T006~T008 목록·연결 작업과 T009 CSS는 T005 이후 별도 파일에서 진행 가능.
- US2: 동일 목록 파일을 수정하므로 T010은 병렬 없음.
- US3: T011 훅과 T012 목록 변경은 계약이 고정된 뒤 분리 가능하나 순차 검증한다.

## Implementation Strategy

US1을 먼저 연결하되 검증·실패 계약은 기초 단계에서 완성해 실패를 성공처럼 보이지 않게 한다.
US2 안내, US3 실패·삭제 상태를 마무리한 뒤 빌드와 계약 검증을 수행한다.
완료 조건은 16개 작업 체크, README 동기화, docs·feat 두 커밋이다. push는 하지 않는다.

## 구현·검증 결과 (2026-10-27)

- T001~T016 구현·문서·검증 작업 완료. 기능 요구사항 15/15 작업 연결, 미연결 작업 0건.
- analyze: 중복·모호함·헌법 위반·CRITICAL 이슈 0건. spec·plan·tasks·계약을 대조했다.
- npm.cmd run build 최종 통과(exit 0). TypeScript 오류 0개, 정적 페이지 생성 완료.
- 임시 Node 검증 52개 통과. 실제 TS 모듈을 임시로 변환해 유효성·NFC 중복·불변 필드·최신
  저장소 보존·읽기/쓰기 실패·재시도·대상 없음·기존 저장/삭제를 검증했다. 컴포넌트는 가짜
  React 훅 실행기로 입력 보존·단일 편집·배타 처리·포커스 복원 요청·빈/실패 상태를 검증했다.
- 임시 검증 파일은 .next에 작성했고 최종 빌드가 정리했다. 런타임·테스트 의존성 추가 없음.
- 실제 브라우저의 포커스·키보드·모바일 배치는 검증하지 않았다. quickstart S1~S5는 사용자
  지시에 따라 별도 검증자가 수행할 수 있도록 인계한다. 위 52개 검사를 브라우저 검증으로 간주하지 않는다.
- git diff --check 통과. page.tsx는 onUpdate 연결 3곳만 수정했고 소유 범위 밖 화면은 유지했다.
