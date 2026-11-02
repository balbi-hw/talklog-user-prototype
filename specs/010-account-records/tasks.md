# Tasks: 학습 기록을 계정에 저장하기

## Phase 1: Setup
- [X] T001 사용자 결정(가져올지 묻기, 로그아웃 상태는 기기 저장)을 반영해 specs/010-account-records/ 명세·설계·계약을 작성한다.
- [X] T002 supabase/migrations/20261102020000_account_records.sql 에 3테이블·트리거·RLS·권한을 작성한다.

## Phase 2: Foundation
- [X] T003 app/lib/record-scope.ts 에 범위·키·readRaw·writeRecords·구독을 둔다.
- [X] T004 app/lib/expressions.ts, app/lib/rooms.ts, app/lib/reviews.ts 의 읽기·쓰기를 범위 경유로 바꾸고 parse* 를 내보낸다.
- [X] T005 app/hooks/useRooms.ts, useExpressions.ts, useReviews.ts 가 pending 이면 loading, 범위 변경·storage 이벤트에 다시 읽게 한다.

## Phase 3: US1 (P1) 계정 저장
독립 확인: A4, A5, A8, A9.
- [X] T006 [US1] app/lib/record-sync.ts 에 대기열(합치기·seq), 받아 오기(대기열 다시 얹기), 보내기(삭제→갱신), 재시도를 구현한다.
- [X] T007 [US1] app/hooks/useRecordSync.ts 에 계정 상태 → 범위 전환과 online·focus 재시도를 구현하고 app/page.tsx 에 연결한다.

## Phase 4: US2 (P1) 가져오기
독립 확인: A2, A3, A11.
- [X] T008 [US2] app/lib/record-sync.ts 에 importDeviceRecords(중복 기준 id·정규화 본문, 복습은 가져온 표현만)와 처리 표시를 구현한다.
- [X] T009 [US2] app/components/RecordSyncNotice.tsx 에 가져오기 대화상자, app/components/AccountScreen.tsx 에 수동 가져오기를 둔다.

## Phase 5: US3 (P2) 연결 끊김
독립 확인: A6, A7, A10.
- [X] T010 [US3] app/components/RecordSyncNotice.tsx 에 상단 알림과 상태 문구를 둔다.
- [X] T011 [US3] app/components/AccountScreen.tsx 로그아웃 확인에 보낼 변경 경고, 확정 후 계정 사본 삭제를 더한다.

## Phase 6: US4 (P1) 로그인 없이
독립 확인: A1, A12.
- [X] T012 [US4] 키 없는 build 에서 범위가 device 이고 동기화 알림이 없는지 확인한다.

## Phase 7: Polish
- [X] T013 README.md, docs/domain-model.md, docs/product-plan.md 를 동기화한다.
- [X] T014 quickstart 자동 시나리오 A1~A13 을 실행한다.
- [ ] T015 마이그레이션을 실제 프로젝트에 적용하고 R1~R5 를 확인한다 (사용자 적용 필요).
