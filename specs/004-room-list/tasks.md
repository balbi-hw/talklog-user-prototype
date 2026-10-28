# Tasks: 학습방 목록·개설

**Input**: `/specs/004-room-list/`의 spec·plan·research·data-model·contracts·quickstart

**서브도메인**: 학습 관계 (**Supporting**), 흐름 2·3

**Tests**: 신규 테스트 프레임워크 없이 빌드와 순수 로직 경계 검증. 브라우저 수동 검증은 별도 검증자에게 quickstart 시나리오를 제공한다.

## Phase 1: Setup

- [X] T001 `app/lib/rooms.ts` — Room·RoomDraft·언어 허용 목록·예시 상수·표시 이름·1~20자 검증을 정의한다 (FR-004,005).

## Phase 2: Foundational

- [X] T002 `app/lib/rooms.ts` — 별도 키 읽기/쓰기·손상 항목 제거·중복 id 제외·try/catch를 구현한다 (FR-006,010).
- [X] T003 `app/hooks/useRooms.ts` — 첫 loading, effect 읽기, 매 쓰기 전 재읽기, 실패 유지·재시도·storage 이벤트를 구현한다 (FR-006,009,010).

## Phase 3: US1 목록·입장 (P1)

**Goal / Independent Test**: 홈과 대화 메뉴에서 예시 학습방 입장, quickstart S1.

- [X] T004 [P] [US1] `app/components/RoomList.tsx` — 목록·요약·예시 표시·3상태·사용자 학습방 빈 상태를 구현한다 (FR-002,004,010).
- [X] T005 [P] [US1] `app/components/RoomSummary.tsx` — 실제 학습방 최대 3개와 전체/개설 진입을 구현한다 (FR-001).
- [X] T006 [US1] `app/page.tsx` — 목록 화면·대화 내비게이션·홈 hero 연결·선택 학습방 머리말과 예시 출처를 연결한다 (FR-001~004).

## Phase 4: US2 개설·메시지 분리 (P2)

**Goal / Independent Test**: 개설 후 녹음·왕복·새로고침, quickstart S2.

- [X] T007 [US2] `app/components/RoomCreate.tsx` — 이름·언어 폼, 유효성 이유, 미구현 안내, 실패 초안 유지·취소·성공 입장을 구현한다 (FR-005,006,011,012).
- [X] T008 [US2] `app/page.tsx` — id별 메시지·전송 시각·최근 활동 정렬, 빈 대화와 예시 전용 보조 기능, 녹음 이탈 확인을 연결한다 (FR-003,007,008,013).

## Phase 5: US3 삭제·복구 (P3)

**Goal / Independent Test**: 삭제 취소·확인·저장소 실패 후 복구, quickstart S3~S4.

- [X] T009 [US3] `app/components/RoomList.tsx` — 삭제 확인/취소, 예시 삭제 불가, 실패 확인 유지, aria 속성·포커스 복구를 구현한다 (FR-004,009,012).
- [X] T010 [US3] `app/page.tsx` — 삭제 성공 시 해당 메시지·시각 제거와 URL 해제, 표현 보존·앱 정리를 구현한다 (FR-008,009).

## Phase 6: Polish

- [X] T011 `app/globals.css` — 기존 변수만 사용하는 모바일 시맨틱 클래스·긴 이름 줄바꿈·포커스 표시를 추가한다 (FR-012).
- [X] T012 `README.md` — 주요 기능·구현 범위·프로젝트 구조를 동기화한다 (FR-011).
- [X] T013 `specs/004-room-list/quickstart.md` — 수용 시나리오와 구현 대조, 저장소·조사·손상 경계 검증 및 npm.cmd run build 결과를 `specs/004-room-list/tasks.md`에 기록한다 (FR-001~013).

## Dependencies & Parallel Opportunities

T001 → T002 → T003 → US1 → US2 → US3 → Polish. T004와 T005는 별개 파일이어서 병렬 실행 가능하다. 셸과 목록의 후속 수정은 순차 수행한다. MVP는 예시 목록·입장까지이며 최종 완료는 모든 스토리를 포함한다.

## Implementation Strategy

저장소 계약을 먼저 확정한 후 각 스토리를 연결한다. 미구현 동작을 임시 버튼으로 만들지 않는다. 파일 경계 밖 ExpressionList/useExpressions·복습·홈 기록 섹션을 수정하지 않는다.

## 실행·검증 기록 (2026-10-27)

- T001~T013 구현 완료. requirements 체크리스트 10개 전부 통과.
- analyze: 요구사항 13개·작업 13개, 요구사항 작업 연결 100%, 미확정·중복·헌법 위반·매핑 없는 작업 0개.
- `npm.cmd run build` 통과 (exit 0), TypeScript 오류 0개, 정적 페이지 4개 생성.
- 순수 학습방 로직·저장소 경계 24개 검증 통과: 1/20/21자·공백·NFC·이모지·받침 조사·3개 언어·잘못된 JSON/배열/항목·중복/예시/예약 id·읽기 차단·쓰기 실패·복구·id 생성.
- `git diff --check` 통과. 런타임 의존성 변경 없음. ExpressionList/useExpressions와 복습·홈 기록 섹션 수정 없음.
- quickstart S1~S5 브라우저 수동 검증은 사용자 지시에 따라 수행하지 않았으며 별도 검증자 몫이다.
