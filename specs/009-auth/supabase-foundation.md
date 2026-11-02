# 3단계 Supabase 기반 구성 (009 로그인 선행 작업)

**Branch**: `009-auth` | **Date**: 2026-11-02

**Input**: 헌법 v2.0.0 기술 제약(백엔드 = Supabase), `docs/product-plan.md` 3단계 결정

## Summary

3단계 기능(로그인, 학습 짝 메시지 수신·알림)이 공통으로 쓸 Supabase 연결 기반만 깐다.
테이블·버킷·인증 화면은 만들지 않는다. 브라우저·서버 컴포넌트·미들웨어용 클라이언트
생성 함수와 세션 갱신 미들웨어를 추가하고, 환경변수 이름을 `.env.example`에 기록한다.

## Technical Context

**Primary Dependencies**: `@supabase/supabase-js` ^2.118.0, `@supabase/ssr` ^0.12.7 (신규).

**Constraints**: 키가 없어도 빌드가 성공해야 한다. 미들웨어는 키가 없으면 세션 갱신을
건너뛴다. 브라우저로 내려가는 변수는 URL과 publishable key뿐이며 비밀이 아니다.

## 의존성 기록 (원칙 IV)

| 의존성 | 용도 | 범주 |
|---|---|---|
| `@supabase/supabase-js` | 인증·DB·저장소·실시간 클라이언트 | 승인 범주(Supabase 클라이언트) |
| `@supabase/ssr` | Next.js App Router에서 쿠키 기반 세션 공유·갱신 | 승인 범주(Supabase 클라이언트) |

대안 검토:

- **`fetch`로 REST(PostgREST·Auth) 직접 호출**: 단순 조회는 가능하지만 토큰 갱신,
  쿠키 동기화, Realtime(WebSocket) 구독, Storage 업로드를 직접 구현해야 한다. 3단계는
  로그인과 실시간 수신을 포함하므로 SDK 없이 구현하면 오류 가능성과 코드량이 더 크다.
  기각.
- **`@supabase/supabase-js`만 사용**: 브라우저에서는 충분하지만 서버 컴포넌트·미들웨어가
  세션을 읽고 갱신하려면 쿠키 어댑터가 필요하다. 이를 직접 작성하는 것은 `@supabase/ssr`
  재구현이므로 기각.
- 원칙 IV SHOULD(단순 HTTP는 `fetch`)는 유지한다. 이후 기능에서 단발성 HTTP 호출만 필요한
  경우 SDK를 쓰지 않는다.

개발 도구(런타임 의존성 아님): `supabase/agent-skills`를 `.claude/skills/`에 설치했다.
코딩 에이전트용 Markdown 지침만 포함하며 앱 번들에 들어가지 않는다.

## Constitution Check

| 원칙 | 결과 | 근거 |
|---|---|---|
| IV 최소 의존성 | PASS | 승인 범주 안의 2개, 대안 검토 위 기록 |
| VI 제공자 독립 AI 경계 | 해당 없음 | AI 제공자 SDK 추가 없음 |
| 기술 제약: 비밀 | PASS | `.env.local`은 gitignore, `.env.example`에 이름만 기록. 공개 키만 `NEXT_PUBLIC_*` |
| 기술 제약: RLS | 보류 | 이번 작업은 테이블을 만들지 않음. 첫 테이블을 만드는 기능에서 정책을 함께 둔다 |

## Project Structure

```text
middleware.ts                 # 모든 페이지 요청에서 updateSession 호출
utils/supabase/client.ts      # 브라우저 클라이언트
utils/supabase/server.ts      # 서버 컴포넌트·Route Handler 클라이언트
utils/supabase/middleware.ts  # 세션 갱신(updateSession)
.env.example                  # 변수 이름만
```
