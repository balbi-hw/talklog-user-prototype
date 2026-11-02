# Implementation Plan: 학습 기록을 계정에 저장하기

**Branch**: `010-account-sync` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

## Summary
로그인 상태의 학습방·표현·복습 기록을 Supabase 테이블에 저장한다. 화면의 동기 저장 계약은 그대로 두고, 로컬 사본 + 대기열로 서버와 맞춘다. 로그인 직후 기기 기록을 가져올지 묻는다. 로그아웃 상태는 지금과 같다.

## Technical Context
- TypeScript 5 strict, React 19, Next.js 15 App Router. 추가 의존성 0 (`@supabase/supabase-js` 재사용).
- 저장: localStorage(기기 키 그대로, 계정 사본 키 추가) + Supabase Postgres 3테이블(RLS).
- 요청 상한 15초. 재시도 offline 15초 · error 60초, `online`·`focus` 때 즉시.
- 검증: 키 있는/없는 build, 가짜 Auth·PostgREST 로 클라이언트 전 흐름(브라우저), 실제 DB 는 마이그레이션 적용 후.

## Constitution Check
| 원칙 | 설계 전 | 설계 후 근거 |
| --- | --- | --- |
| I | PASS | 계정이 표현 학습·복습·학습 관계에 소유자를 준다. 용어집 이름 사용(학습방·표현·복습) |
| II | PASS | 받아 오기 전 빈 목록 대신 loading/실패, 저장 위치 안내가 사실과 일치, 녹음은 올라가지 않는다고 알림 |
| III | PASS | 가져오기 대화상자 포커스·Escape, 상태 role=status, 다시 시도 버튼 |
| IV | PASS | 추가 의존성 0 |
| V | PASS | 받아 오는 중·보내는 중·대기·실패·재시도, 오프라인에서도 저장, 로그아웃 경고 |
| VI | 해당 없음 | AI 경계 변경 없음 |
| 기술 제약: RLS | PASS | 3테이블 모두 RLS, 행동별 정책, anon 권한 없음 |
| 기술 제약: 비밀 | PASS | publishable key 만. 서버 비밀 없음 |
| 기술 제약: 키 없는 빌드 | PASS | 범위가 곧바로 device, 동기화 비활성 |

## Project Structure
- `app/lib/record-scope.ts`: 범위·키·쓰기 훅 지점.
- `app/lib/record-sync.ts`: 대기열, 받아 오기, 보내기, 가져오기, 사본 삭제.
- `app/lib/expressions.ts`, `rooms.ts`, `reviews.ts`: 읽기·쓰기를 범위 경유로. `parse*` 를 내보내 가져오기에서 재사용.
- `app/hooks/useRooms.ts`, `useExpressions.ts`, `useReviews.ts`: `pending` 이면 loading, 범위 변경 구독, storage 이벤트 키 비교.
- `app/hooks/useRecordSync.ts`: 계정 상태 → 범위, 가져오기 질문, 재시도.
- `app/components/RecordSyncNotice.tsx`: 상단 알림·가져오기 대화상자·상태 문구.
- `app/components/AccountScreen.tsx`, `app/page.tsx`, `app/globals.css`: 연결과 스타일.
- `supabase/migrations/20261102020000_account_records.sql`: 테이블·트리거·RLS·권한.

## Complexity Tracking
- 동기화 엔진을 직접 만든다. 대안(라이브러리)은 의존성이 커지고 이 규모(사람 한 명 분량, 3컬렉션)에 과하다.
- 다중 탭: 한 탭의 계정 사본 쓰기는 다른 탭에 storage 이벤트로 전해진다. 대기열은 두 탭이 같은 키를 쓰므로 같은 변경이 두 번 보내질 수 있지만 upsert·delete 가 멱등이라 결과는 같다.
