# Tasks: 공통 셸 원칙 정리

**Input**: [spec.md](./spec.md), 006 브리프. 정리 작업이므로 plan 생략.

## Phase 1: 준비

- [X] T001 `.specify/feature.json`에 006 경로 지정, `specs/006-principle-cleanup/spec.md`에 요구사항·수용 기준 작성

## Phase 2: US1 — 믿을 수 있는 공통 화면 (P1)

**독립 검증**: quickstart S1·S2. 이 단계가 최소 사용자 가치 범위다.

- [X] T002 [US1] `app/page.tsx`에서 프로필·마이 제거, 전체 `app/`의 버튼 핸들러·고정 수치·시각 확인 (FR-001,003,007)
- [X] T003 [US1] `app/components/HomeDate.tsx`에 로컬 날짜와 자정·탭 복귀 갱신 추가, `app/page.tsx`에 연결하고 중립 인사·예시 안내 적용 (FR-002,003)

## Phase 3: US2 — 일관된 언어와 화면 (P2)

**독립 검증**: quickstart S3·S4. US1과 별도로 용어·색상·문서를 대조할 수 있다.

- [X] T004 [US2] `app/page.tsx`, `app/globals.css`, `README.md` 및 `specs/003-review/`, `specs/004-room-list/`, `specs/005-expression-edit/` 용어 검색과 필요한 정리 (FR-004)
- [X] T005 [US2] `app/globals.css` 색상 리터럴을 동일 값별 `:root` 변수로 이동하고 값 보존 대조 (FR-005)
- [X] T006 [US2] `docs/domain-model.md`의 구현 상태·완료 후보·드리프트와 `README.md` 기능·구조·구현 범위 동기화 (FR-006)

## Phase 4: 검증

- [X] T007 `specs/006-principle-cleanup/quickstart.md`에 표 형식 수용·회귀 시나리오 작성 (FR-001~007)
- [X] T008 `package.json`의 `npm.cmd run build`, 정적 용어·컨트롤·색상 검사 및 `git diff --check` 결과를 `specs/006-principle-cleanup/quickstart.md`에 기록

## Dependencies & Execution Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 순서로 수행한다.
T006의 도메인 문서 정리는 T003과 파일이 달라 병렬 가능하지만 이번 작업은 순차 실행한다.
새 기반 구조나 자동화 테스트는 추가하지 않는다. 모든 작업 완료 후에도 커밋하지 않는다.
