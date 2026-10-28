# Tasks: 실제 스크립트·번역

**Input**: `specs/007-stt-translation/`의 spec·plan·research·data-model·contracts·quickstart.
자동화 테스트 프레임워크 추가 없음. API 계약 스모크와 build로 검증하고 브라우저 검증은 별도 검증자가 한다.

## Phase 1: Setup

- [x] T001 `.specify/feature.json` 경로 고정, `specs/007-stt-translation/spec.md` 및 `checklists/requirements.md` 명세·clarify 검토
- [x] T002 `specs/007-stt-translation/plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` 작성·헌법 게이트 확인

## Phase 2: Foundational

- [x] T003 `app/lib/understanding.ts` 제공자 독립 타입·오류·인터페이스 구현 (ja/en/zh, real/mock)
- [x] T004 `app/lib/server/understanding/http.ts` 스트림 상한(8MiB+64KiB/64KiB), 전역 분당 20회·동시 4개, 30초 취소 구현
- [x] T005 `app/lib/server/understanding/config.ts`, `.env.example`, `.gitignore` 서버 선택·키 부재 Mock·모델 설정·비밀 차단 구현

## Phase 3: US1 스크립트 (P1, MVP)

**Goal**: 최초 열기 요청, 캐시와 예시 구분. **Independent Test**: quickstart S1~3.

- [x] T006 [US1] `app/lib/server/understanding/adapters/openai.ts`, `mock.ts` 스크립트 어댑터 구현
- [x] T007 [US1] `app/api/transcript/route.ts` 음성 1~8MiB·MIME·언어 검사, 정규화 응답 구현
- [x] T008 [US1] `app/hooks/useMessageUnderstanding.ts` 메시지별 캐시·중복 차단·40초 취소·삭제 정리 구현
- [x] T009 [US1] `app/components/MessageUnderstanding.tsx`, `app/page.tsx` 최초 열기·고정 예시·셸 수명 연결

## Phase 4: US2 번역 (P2)

**Goal**: 준비된 스크립트를 한국어로 번역. **Independent Test**: S4~5.

- [x] T010 [US2] `app/lib/server/understanding/adapters/claude.ts`, `mock.ts` 번역 어댑터 구현
- [x] T011 [US2] `app/api/translation/route.ts` trim 후 1~8,000자·64KiB·출처 전파 구현
- [x] T012 [US2] `app/hooks/useMessageUnderstanding.ts`, `app/components/MessageUnderstanding.tsx` 준비 조건·명시 번역·캐시 연결

## Phase 5: US3 복구·표현 저장 (P3)

**Goal**: 오류 복구와 Core 연결. **Independent Test**: S6~14.

- [x] T013 [US3] `app/components/MessageUnderstanding.tsx`, `app/globals.css` 전체 상태·재시도·전송 안내·접근성 구현
- [x] T014 [US3] `app/components/TranscriptCapture.tsx`, `app/components/ExpressionSheet.tsx` 기존 선택·저장·포커스 복귀·고유 입력 id 구현
- [x] T015 [US3] `app/page.tsx` 처리 중 재생·답장 비차단, 삭제 시 요청 취소 연결

## Phase 6: Polish

- [x] T016 `README.md` 주요 기능·구현 범위·구조·환경변수 안내 동기화
- [x] T017 `specs/007-stt-translation/quickstart.md`와 계약 기준 API 스모크·키 없는 build 확인, `tasks.md` 결과 기록

## Dependencies & Execution Order

T001→T002→T003~T005→US1→US2→US3→Polish. US2는 US1의 성공 스크립트에 의존한다.
US3는 기존 002 선택·저장 기능에 의존한다. US1만으로 읽기 MVP를 검증할 수 있다.
독립 파일 어댑터 구현은 병렬 가능하나 이번 실행은 순차 진행한다.
각 스토리 완료 시 quickstart의 해당 시나리오로 독립 검증할 수 있다.

## Requirement Coverage

| 요구사항 | 작업 |
| --- | --- |
| FR-001 | T006~T009 |
| FR-002 | T006,T010~T012 |
| FR-003 | T010~T012 |
| FR-004 | T003,T004,T008,T013 |
| FR-005 | T008,T015 |
| FR-006 | T006,T009,T010,T011,T013 |
| FR-007 | T014 |
| FR-008 | T013 |
| FR-009 | T004,T007,T011 |
| FR-010 | T013,T014 |
| FR-011 | T003,T005,T006,T010 |
