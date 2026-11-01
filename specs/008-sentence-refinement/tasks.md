# Tasks: 실제 문장 다듬기

## Phase 1: Setup
- [X] T001 명세·설계·계약 및 요구사항 체크리스트를 specs/008-sentence-refinement/에 작성·검토한다.

## Phase 2: Foundation
- [X] T002 app/lib/understanding.ts에 입력(1~8,000자, ja|en|zh, real|mock), 결과(문장 1~8,000자, 이유 1~1,000자, changed boolean), 상태·검증 계약을 추가한다.
- [X] T003 app/lib/server/understanding/http.ts 공통 방어를 결과 타입에 독립적으로 확장한다.

## Phase 3: US1 (P1) 내 문장 다듬기
독립 확인: 내 스크립트 준비 후 최초 열기·문장/이유/예시·변경 없음 확인.
- [X] T004 [US1] app/lib/server/understanding/adapters/refinement.ts에 JSON 구조·종료·길이·변경 여부 검증과 Claude·Mock 구현을 추가한다.
- [X] T005 [US1] app/lib/server/understanding/config.ts 및 .env.example에 제공자·모델 선택을 추가한다.
- [X] T006 [US1] app/api/refinement/route.ts에 JSON 64KiB·입력 검증·Mock 전파를 구현한다.
- [X] T007 [US1] app/hooks/useMessageUnderstanding.ts에 메시지별 최초 요청·성공/변경 없음 재사용을 추가한다.
- [X] T008 [US1] app/components/MessageUnderstanding.tsx에 인라인 진입·이유·변경 없음·출처·전송 안내를 추가한다.

## Phase 4: US2 (P2) 대화 유지
독립 확인: 네 오류 상태·재시도·기본 행동과 늦은 응답 무시.
- [X] T009 [US2] app/hooks/useMessageUnderstanding.ts에 타임아웃·오류·재시도·스크립트 재요청 취소/무효화·삭제 처리를 완성한다.
- [X] T010 [US2] app/components/MessageUnderstanding.tsx에 오류 알림·재시도·접근성을 연결한다.

## Phase 5: US3 (P3) 표현 저장
독립 확인: 전체·일부 저장 후 예문·출처·중복 확인.
- [X] T011 [US3] app/components/TranscriptCapture.tsx의 라벨을 매개변수화하고 MessageUnderstanding.tsx에서 기존 선택·저장 경로를 연결한다.

## Phase 6: Polish
- [X] T012 [P] README.md, docs/domain-model.md §2·5, docs/product-plan.md의 구현·Mock 상태를 동기화한다.
- [X] T013 tests/refinement.cjs에서 상태·어댑터·동시 요청을 검증하고 키 없는 npm.cmd run build와 API 스모크 검증 결과·한계를 specs/008-sentence-refinement/validation.md에 기록한다.

## Dependencies & Strategy
T001 → T002 → T003 → T004~T006 → T007~T008 (MVP) → T009~T010 → T011 → T013.
T012는 코드와 별도로 작업 가능. US1 어댑터와 UI 설계, US2 오류 시나리오 준비, US3 선택 시나리오 준비는 파일 충돌 없이 병행 가능.
본 작업은 순차 실행한다. 모든 작업은 구현 후 표시하며 커밋하지 않는다.
