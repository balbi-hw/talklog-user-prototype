# Implementation Plan: 로그인

**Branch**: `009-auth` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

## Summary
Supabase Auth 이메일·비밀번호로 가입·로그인·로그아웃을 셸 안 계정 화면에 둔다. 로그인은 선택이고 기록은 이 기기에 남는다. 연결 기반(클라이언트·미들웨어)은 [supabase-foundation.md](./supabase-foundation.md) 에서 깔았고, 이 기능은 그것을 키 없는 환경에서도 안전하게 고친다.

## Technical Context
- TypeScript 5 strict, React 19, Next.js 15 App Router, 520px 모바일 셸.
- 의존성: `@supabase/supabase-js`, `@supabase/ssr` (supabase-foundation.md 에서 추가, 원칙 IV 기록). 이 기능의 추가 의존성 0.
- 세션: 쿠키. 미들웨어 `getClaims()` 갱신. 클라이언트 표시는 `onAuthStateChange`.
- 상한: 인증 호출 15초. 비밀번호 6~72자, 표시 이름 1~20자.
- 검증: 키 있는/없는 build, 실제 Supabase 대상 브라우저 시나리오(틀린 자격 증명), 응답 대체로 성공·확인 대기·이미 가입·429·네트워크 실패.

## Constitution Check
| 원칙 | 설계 전 | 설계 후 근거 |
| --- | --- | --- |
| I | PASS | 계정(Generic) 서브도메인, 다음 기능(수신)의 상류 |
| II | PASS | 기록이 기기에만 남는다는 사실 안내, 키 없으면 "쓸 수 없음" — 동작하는 척하는 진입점 없음 |
| III | PASS | aria-pressed 모드 전환, role=status/alert, 포커스 이동, Escape 취소 |
| IV | PASS | 추가 의존성 0 |
| V | PASS | 11가지 실패·처리 중·확인 대기·로그아웃 확인. 로그인이 기본 행동을 막지 않음 |
| VI | 해당 없음 | AI 제공자 호출 없음 |
| 기술 제약: 비밀 | PASS | publishable key 만 브라우저. secret 키 사용 0 |
| 기술 제약: RLS | 해당 없음 | 테이블 0. 첫 테이블을 만드는 기능에서 정책과 함께 둔다 |
| 기술 제약: 키 없는 빌드 | PASS | `createClient()` → null, 미들웨어 건너뜀 |

## Project Structure
- `app/lib/account.ts`: 상태·사유 타입, 입력 검증, Supabase 오류 → 사유, 표시 이름, `withTimeout`.
- `app/hooks/useAccount.ts`: 세션 구독, 로그인·가입·로그아웃, 확인 안내.
- `app/components/AccountScreen.tsx`: 로그인/가입 폼, 확인 메일 대기, 로그인 상태, 로그아웃 확인.
- `app/auth/confirm/route.ts`: 확인 링크 처리.
- `app/page.tsx`: `account` 화면과 상단 계정 버튼 연결.
- `app/globals.css`: `.account-*`, `.topbar-account`.
- `utils/supabase/client.ts`, `server.ts`: 키 없으면 null. `utils/supabase/middleware.ts`: `getClaims()`·실패 삼킴.
- `README.md`, `docs/domain-model.md`, `docs/product-plan.md` 동기화.

## Complexity Tracking
위반 없음. 미들웨어는 페이지·API 요청마다 `getClaims()` 를 부른다. 비대칭 서명 키 프로젝트는 네트워크 없이 검증하고, 대칭 키 프로젝트는 Auth 서버를 부른다. 지연이 문제가 되면 matcher 에서 `/api` 를 빼는 것을 후속으로 검토한다.
