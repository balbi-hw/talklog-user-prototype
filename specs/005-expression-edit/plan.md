# Implementation Plan: 카드 편집

**Branch**: `005-expression-edit` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: `/specs/005-expression-edit/spec.md`

**서브도메인**: 표현 학습 (**Core**), `draft.md` §4 12단계.

## Summary

카드 목록 항목 안에서 표현 본문과 뜻만 고친다. useExpressions에 update를 추가하고
기존 save·remove와 반환 필드는 유지한다. 쓰기 직전 readAll로 최신 배열을 읽어
대상 확인·유효성·자기 자신 제외 중복 검사를 수행한다. 최신 대상에서 두 필드만 교체하고
writeAll 성공 이후에만 화면 상태를 반영한다. 저장 형식과 저장 시각은 바꾸지 않는다.

## Technical Context

**Language/Version**: TypeScript 5 strict, Next.js 15 App Router, React 19.

**Primary Dependencies**: 추가 없음. React 내장 상태·ref·effect와 표준 문자열 정규화.

**Storage**: 기존 talklog.expressions localStorage JSON 배열. 모든 접근은 기존 try/catch 유틸.

**Testing**: npm.cmd run build와 임시 Node 계약 검증. 브라우저 수용 검증은
[quickstart.md](./quickstart.md)에 작성하고 별도 검증자에게 맡긴다(사용자 지시).

**Target Platform**: 최신 모바일·데스크톱 브라우저, 520px 셸과 320px 폭.

**Project Type**: 프론트엔드 전용 웹 앱.

**Performance Goals**: 200개 표현에서 편집·검증·저장이 조작 직후 반영된다.

**Constraints**: 신규 런타임 의존성 0개. 기존 CSS 변수만 사용. 서버·API 미추가.

**Scale/Scope**: 카드 목록·표현 훅·유틸·타입·카드 CSS와 page의 Cards 연결만 변경.
홈·학습방·음성·Feedback·복습과 카드 상단 복습 블록은 수정하지 않는다.

## Constitution Check

초기 평가(Phase 0 전)와 설계 후 재평가(Phase 1 후)를 요구사항·계약과 대조했다.

| 원칙 | 초기 | 설계 후 | 근거 |
|---|---|---|---|
| I 도메인·흐름 | PASS | PASS | spec의 표현 학습/Core·12단계, Expression·term·meaning 사용 |
| II Mock 경계 | PASS | PASS | 실제 쓰기 성공 후만 완료 표시, README 실제 편집 범위 명시 |
| III 모바일·접근성 | PASS | PASS | 네이티브 입력·버튼, label·펼침 속성·상태 알림, 포커스 복원 계약 |
| IV 최소 의존성 | PASS | PASS | 기존 React와 localStorage만 사용, 추가 의존성 없음 |
| V 상태 완결성 | PASS | PASS | loading/ready/unavailable, 빈 상태, 실패 시 입력 유지·재시도, 취소·삭제 확인 배타 처리 |
| 기술 제약 | PASS | PASS | App Router·strict 유지, 시맨틱 CSS·기존 변수, 브라우저 저장소만 |

위반과 미확정 항목 없음. 초기 읽기 실패와 편집 중 쓰기 실패를 구별해 렌더링한다.

## Project Structure

### Documentation (this feature)

```text
specs/005-expression-edit/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/use-expressions-update.md
├── contracts/expression-edit-ui.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── components/ExpressionList.tsx   # 단일 편집·검증·포커스·실패 표시
├── hooks/useExpressions.ts         # 기존 API 유지, update만 추가
├── lib/types.ts                    # ExpressionUpdate·UpdateFailure·UpdateResult
├── lib/expressions.ts              # 순수 변경 함수·실패 문구
├── globals.css                    # 카드 편집 클래스만 추가
└── page.tsx                       # 셸 → Cards → ExpressionList onUpdate 연결
README.md                         # 기능·현재 범위·구조 동기화
```

**Structure Decision**: 목록에 편집 상태 하나만 둔다. 별도 페이지·전역 상태·레이어 없이
기존 구조와 파일 경계를 따른다. 편집 변환은 순수 함수로 분리하고 훅은 저장소와 상태를
관리한다. 저장 실패 시 안내와 기존 목록·초안을 함께 표시한다.

## Complexity Tracking

헌법 위반 없음. 완전히 동시인 탭 쓰기의 원자성은 localStorage가 제공하지 않으므로
재읽기와 최신 대상 병합까지 보장한다. save·remove의 기존 읽기 정책은 변경하지 않는다.
