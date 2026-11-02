# Research: 로그인

## R1. 계정 화면을 별도 경로가 아닌 셸 안 화면으로
- 결정: `app/page.tsx` 의 `Screen` 에 `account` 를 더한다.
- 근거: 학습방 메시지·녹음은 셸 메모리에만 있다. `/login` 으로 이동하면 셸이 언마운트되어 보낸 녹음이 사라진다. 기존 화면 전환(`go`)의 전송 전 녹음 확인도 그대로 적용된다.
- 대안: `app/login/page.tsx` — 딥링크는 쉽지만 위 손실 때문에 기각.

## R2. 클라이언트에서 인증 호출
- 결정: 브라우저 클라이언트(`utils/supabase/client.ts`)로 `signUp`·`signInWithPassword`·`signOut` 을 부른다. 세션은 `@supabase/ssr` 가 쿠키에 둔다.
- 근거: 셸이 클라이언트 컴포넌트다. 쿠키 세션이라 서버(미들웨어·Route Handler)도 같은 세션을 읽는다. Server Action 은 화면 상태를 셸 밖으로 나누어 R1 과 어긋난다.

## R3. 세션 확인
- 결정: 미들웨어는 `getClaims()` 로 토큰을 검증·갱신한다. 클라이언트 표시는 `onAuthStateChange` 를 쓴다.
- 근거: Supabase Next.js 가이드가 `getClaims()` 를 권장한다. `getSession()` 은 쿠키를 검증 없이 읽으므로 권한 판단에 쓰지 않는다. 클라이언트 표시는 권한 판단이 아니다.

## R4. 확인 링크
- 결정: `app/auth/confirm/route.ts` 가 `code`(PKCE) 와 `token_hash`+`type`(메일 템플릿) 둘 다 받아 세션을 만들고 `/?account=confirmed|confirm-failed` 로 보낸다.
- 근거: `@supabase/ssr` 기본 흐름은 PKCE 이고, 메일 템플릿을 바꾸면 `token_hash` 가 온다. 허용 목록 밖이라 Site URL 로 돌아오는 경우는 브라우저 클라이언트의 `detectSessionInUrl` 이 교환한다.

## R5. 이미 가입된 이메일
- 결정: `signUp` 결과에서 `user.identities` 가 빈 배열이면 `email-exists` 로 다룬다.
- 근거: 확인 메일이 켜진 프로젝트는 이메일 존재 여부를 숨기려고 오류 대신 가짜 사용자를 돌려준다.

## R6. 시간 초과
- 결정: 인증 호출마다 15초 상한(`withTimeout`). 넘으면 `timeout`.
- 근거: supabase-js 에는 기본 요청 상한이 없다. 원칙 V 의 시간 초과 상태를 정의한다.

## R7. 키 없는 환경
- 결정: `createClient()` 가 키가 없으면 `null` 을 돌려주고, 훅은 `unavailable` 상태가 된다. 미들웨어는 갱신을 건너뛴다.
- 근거: 헌법 — 키 없이 빌드·기본 행동이 되어야 한다. 기존 `!` 단언은 첫 호출에서 예외를 낸다.

## R8. 로그아웃 범위
- 결정: `signOut({ scope: "local" })`.
- 근거: 다른 기기 세션까지 끝낼 이유가 없고, 서버에 닿지 못해도 이 기기 세션은 지워진다.

## R9. 제출 버튼 비활성화
- 결정: 입력이 틀려도 제출 버튼은 활성으로 두고, 제출 시 필드별 안내를 보인다. 처리 중에만 `disabled`.
- 근거: 비활성 버튼은 왜 안 되는지 알려 주지 않는다. `aria-disabled` 만 걸면 보조 기술에는 비활성으로 알리면서 실제로는 눌리므로 쓰지 않는다.
