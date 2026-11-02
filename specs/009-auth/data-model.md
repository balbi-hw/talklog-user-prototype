# Data Model: 로그인

DB 테이블은 없다. 사용자 레코드는 Supabase Auth(`auth.users`)가 가진다.

| 이름 | 위치 | 필드 | 규칙 |
| --- | --- | --- | --- |
| AccountState | `app/lib/account.ts` | `loading` · `unavailable` · `signed-out` · `signed-in(user)` | 첫 렌더는 `loading`. 키 없으면 `unavailable` |
| AccountUser | `app/lib/account.ts` | `id`, `email`, `displayName` | `displayName` = `user_metadata.display_name`(앞뒤 공백 제거, 20자) 또는 이메일 앞부분. 표시 전용이며 권한 판단에 쓰지 않는다 |
| AccountFailure | `app/lib/account.ts` | 11가지 사유 | Supabase `code`/`status` → 사유. 원문 메시지는 버린다 |
| ConfirmNotice | `app/hooks/useAccount.ts` | `confirmed` · `confirm-failed` · null | 주소 `account`/`code` 질의값에서 한 번 읽고 지운다 |
| 세션 | 쿠키 (`@supabase/ssr`) | access/refresh 토큰 | 미들웨어가 요청마다 `getClaims()` 로 갱신 |

## 상태 전이

```text
loading ─(키 없음)→ unavailable
loading ─(세션 없음)→ signed-out ─(로그인·가입+세션)→ signed-in
signed-out ─(가입, 세션 없음)→ signed-out + "확인 메일을 보냈어요"
signed-in ─(로그아웃 확인)→ signed-out
```
