# Tasks: 로그인

## Phase 1: Setup
- [X] T001 Supabase 연결 기반과 의존성 근거를 specs/009-auth/supabase-foundation.md 로 정리한다.
- [X] T002 명세·설계·계약을 specs/009-auth/ 에 작성한다.

## Phase 2: Foundation
- [X] T003 utils/supabase/client.ts, utils/supabase/server.ts 가 키 없으면 null 을 돌려주게 한다. 브라우저 클라이언트는 한 번만 만든다.
- [X] T004 utils/supabase/middleware.ts 의 세션 갱신을 getClaims() 로 바꾸고 실패를 삼킨다.
- [X] T005 app/lib/account.ts 에 상태·사유 타입, 입력 검증, 오류 → 사유, 표시 이름, withTimeout 을 둔다.

## Phase 3: US1 (P1) 가입·로그인
독립 확인: Q1~Q9, Q13, Q14.
- [X] T006 [US1] app/hooks/useAccount.ts 에 세션 구독과 signIn·signUp(identities 빈 배열 처리)을 구현한다.
- [X] T007 [US1] app/components/AccountScreen.tsx 에 모드 전환, 필드 검증, 처리 중, 실패 문구, 확인 메일 대기를 구현한다.
- [X] T008 [US1] app/auth/confirm/route.ts 에 code·token_hash 처리와 결과 리디렉션을 구현한다.
- [X] T009 [US1] app/hooks/useAccount.ts 에 확인 안내(account·code 질의값) 읽기·지우기를 더하고, app/page.tsx 가 안내가 생기면 계정 화면을 열게 한다.
- [X] T010 [US1] app/page.tsx 에 account 화면과 상단 계정 버튼을 연결하고 app/globals.css 에 스타일을 더한다.

## Phase 4: US2 (P2) 로그아웃
독립 확인: Q11, Q12.
- [X] T011 [US2] app/hooks/useAccount.ts 에 signOut(scope local)을 구현한다.
- [X] T012 [US2] app/components/AccountScreen.tsx 에 로그아웃 확인 단계, Escape 취소, 포커스 복귀를 구현한다.

## Phase 5: US3 (P1) 로그인 없이 쓰기
독립 확인: Q18, Q22.
- [X] T013 [US3] app/hooks/useAccount.ts 에 unavailable 상태를, app/components/AccountScreen.tsx 에 "쓸 수 없음" 안내를 둔다.
- [X] T014 [US3] 키 없는 build·start 로 Q18 을 확인한다.

## Phase 6: Polish
- [X] T015 README.md 의 주요 기능·현재 구현 범위·프로젝트 구조·환경 설정을 동기화한다.
- [X] T016 docs/domain-model.md 계정 행과 docs/product-plan.md 3단계 진행을 갱신한다.
- [X] T017 quickstart.md 자동 시나리오를 실행한다 (Q1~Q19).
