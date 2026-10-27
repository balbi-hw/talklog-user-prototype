# Implementation Plan: 저장한 표현 복습

**Branch**: `003-review` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

## Summary

셸이 `useReviews`를 한 번 소유한다. 표현은 읽기만 하고 별도 복습 저장소에 응답을 즉시 저장한다.
홈 복습/통계·카드 진입·세션·완료는 새 컴포넌트로 분리한다.

## Technical Context

**Language/Version**: TypeScript 5 strict, ES2017, React 19, Next.js 15 App Router
**Primary Dependencies**: 기존 next/react/react-dom. 신규 런타임 의존성 0개
**Storage**: localStorage `talklog.reviews` JSON 배열
**Testing**: `npm.cmd run build`, Node 순수 로직 검증, [quickstart.md](./quickstart.md) 별도 검증자 인계
**Target Platform**: 모바일 브라우저, 최대 520px 셸
**Project Type**: 프론트엔드 웹 앱
**Performance Goals**: 이벤트 내 응답 확정, 세션 최대 20개/응답 40회
**Constraints**: 렌더 중 저장소 접근 금지, 새 색상·의존성·서버 없음
**Scale/Scope**: 표현 수백 개. 홈 hero-card·학습방·음성·표현 저장/삭제는 변경하지 않음

## Constitution Check

| 원칙 | 초기 | 설계 후 근거 |
|---|---|---|
| I | PASS | 복습 Core 지원, 13·14단계, 상류 표현 읽기 전용, 기존 용어 사용 |
| II | PASS | 고정 카드/숫자 제거, 전체 보기 연결, README 실제 범위 반영 |
| III | PASS | 네이티브 버튼, 라벨·열림 상태·상태 알림, 다음 카드/완료 제목 포커스 |
| IV | PASS | React 내장 상태·Date·localStorage만 사용 |
| V | PASS | loading/ready/unavailable, 빈 상태 두 종류, 실패 시 카드 보존·재시도, 이탈 시 확정 응답 유지 |
| 기술 제약 | PASS | strict/App Router, 시맨틱 CSS 및 기존 변수, API/DB 미추가 |

응답은 사용자가 명시적으로 선택하는 기록으로 삭제/전송이 아니므로 별도 확인이 필요하지 않다.
표현 삭제 확인은 기존 기능을 유지한다. 초기/설계 후 위반 없음.

## Project Structure

```text
specs/003-review/{spec,plan,research,data-model,quickstart,tasks}.md
specs/003-review/contracts/{use-reviews,review-ui}.md
specs/003-review/checklists/requirements.md
app/lib/reviews.ts
app/hooks/useReviews.ts
app/components/ReviewEntry.tsx
app/components/ReviewHome.tsx
app/components/ReviewSession.tsx
app/components/ReviewComplete.tsx
app/page.tsx       # 연결과 기존 Mock 복습 제거만
app/globals.css    # 복습 전용 시맨틱 클래스
```

기존 lib/hooks/components 구조를 유지한다. 세션은 셸에서 소유하고 이탈 시 폐기한다.
창 포커스·storage 이벤트·자정에 현황을 갱신하며 쓰기 전에도 두 저장소를 읽는다.

## Complexity Tracking

위반 없음. localStorage 다중 탭 동시 쓰기 원자성은 보장하지 않는다.
