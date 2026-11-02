# Contract: GET /auth/confirm

확인 메일 링크가 돌아오는 Route Handler (`app/auth/confirm/route.ts`).

| 입력 | 처리 | 응답 |
| --- | --- | --- |
| `?code=` | `exchangeCodeForSession(code)` | 성공 307 `/?account=confirmed`, 실패 307 `/?account=confirm-failed` |
| `?token_hash=&type=` (`signup`·`email`·`invite`·`magiclink`·`recovery`·`email_change`) | `verifyOtp({ type, token_hash })` | 위와 같다 |
| 둘 다 없음 · 알 수 없는 `type` · Supabase 설정 없음 · 예외 | — | 307 `/?account=confirm-failed` |

세션 쿠키는 서버 클라이언트가 응답에 쓴다. 오류 원문은 주소에 싣지 않는다.

Supabase 대시보드 **Authentication → URL Configuration** 의 Redirect URLs 에 `<origin>/auth/confirm` 을 더해야 이 경로로 돌아온다.
