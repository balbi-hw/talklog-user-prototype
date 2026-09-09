# Implementation Plan: 스크립트에서 표현 선택·저장

**Branch**: `002-expression-capture` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-expression-capture/spec.md`

**서브도메인**: 표현 학습 (**Core**) — [docs/domain-model.md](../../docs/domain-model.md) §2

## Summary

스크립트에서 사용자가 고른 범위를 표현으로 저장하고, 카드 화면의 하드코딩을 실제 저장한
표현으로 대체한다. 저장은 브라우저 저장소를 쓰며 새로고침 이후에도 남는다.

기술 접근은 브라우저 표준 API만 사용한다. 범위 고르기는 `window.getSelection()`으로
읽고, 스크립트 요소 안에서 일어난 선택만 받아들인다(Phase 0 연구 결과 R-001). 키보드
사용자도 `Shift`+방향키로 같은 선택을 만들 수 있으므로 스크립트 요소를 포커스 가능하게
두면 FR-028을 별도 UI 없이 충족한다(R-002). 저장소는 `localStorage`를 쓰고 읽기·쓰기를
모두 `try`/`catch`로 감싼다(R-003). 서버 렌더링 중에는 저장소를 읽을 수 없으므로 "아직
읽지 않음" 상태를 "저장한 것이 없음"과 구분해야 한다(R-004).

신규 런타임 의존성은 추가하지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`, target ES2017), React 19.1.0

**Primary Dependencies**: 신규 추가 없음. 브라우저 표준 API: `window.getSelection`,
`Range`, `Node.contains`, `document.selectionchange`, `localStorage`,
`String.prototype.normalize`

**Storage**: `localStorage` 단일 키. 표현 수십~수백 개의 짧은 문자열이므로 5MB 한도
안에서 충분하다. Constitution 기술 제약("영속성이 필요하면 브라우저 저장소를 사용한다")이
허용하는 범위이며 서버·DB를 추가하지 않는다.

**Testing**: 자동화 테스트 없음 (Constitution 개발 워크플로 — 현재 필수 아님).
검증은 `npm run build` 통과 + [quickstart.md](./quickstart.md)의 수동 시나리오.

**Target Platform**: 모바일 우선 최신 브라우저 (Chrome/Edge, Safari 15+, Firefox).
`getSelection`과 `localStorage`는 secure context를 요구하지 않으므로 001과 달리
`localhost` 제약이 없다.

**Project Type**: Web application (Next.js App Router, 프론트엔드 전용)

**Performance Goals**: 선택 후 저장 수단이 나타나기까지 체감 지연 없음. 표현 200개까지
카드 목록 렌더링이 즉시. 저장 후 목록 반영은 같은 렌더 주기 안에서.

**Constraints**: 신규 런타임 의존성 0개(원칙 IV). 형태소 분석기·텍스트 처리 라이브러리
금지 — 단어 경계는 사용자가 정한다(FR-002). 레이아웃은 520px `.phone-frame` 기준.

**Scale/Scope**: 5개 화면 중 `Room` · `Feedback` · `Cards` 3개 화면 수정. 신규 파일 5개
(훅 2개, 컴포넌트 2개, 저장소 유틸 1개), 기존 파일 4개 수정, 예상 신규 코드 400~500줄.
`Home` · `Review` 화면은 FR-027의 식별자 이름 변경 외에는 손대지 않는다.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### 초기 평가 (Phase 0 이전)

| 원칙 | 판정 | 근거 |
|------|------|------|
| I. 도메인 경계와 흐름 검증 | PASS | spec.md 머리에 서브도메인(표현 학습 / Core)과 검증 단계(`draft.md` §4 10·11·12)를 명시했다. 용어집 준수는 설계 단계에서 식별자 이름까지 확장한다 — `Expression`, `expression-*`, `Card`. FR-027이 기존 위반(`word-*`, "플래시카드")의 정리를 요구한다. |
| II. Mock 경계 명시 | **초기 FAIL → 요구사항으로 해소** | 현재 카드 화면과 Feedback 화면이 거의 전부 가짜다. FR-024(가짜 저장) · FR-025(하드코딩 표현·개수) · FR-026(동작하지 않는 복습 표시) · FR-015(저장 실패를 성공처럼 표시 금지)로 명세에 반영했다. 이 기능은 원칙 II 위반을 만드는 쪽이 아니라 갚는 쪽이다. |
| III. 모바일 우선·접근성 | **게이트 실패 발견 → 명세 보강으로 해소** | FR-002의 끌어서 고르기는 마우스·터치 전용이므로 "모든 인터랙티브 요소는 키보드로 도달·조작 가능해야 한다"(MUST)를 위반했다. 원칙이 MUST 이므로 희석하지 않고 FR-028 · FR-029 · SC-010을 명세에 추가했다. 해소 방법은 R-002 참조. |
| IV. 최소 의존성 | PASS | 형태소 분석기(kuromoji 등)와 저장소 래퍼 라이브러리를 도입하지 않는다. 단어 경계는 사용자가 정하고(FR-002), 저장은 `localStorage`를 직접 쓴다. |
| V. 상태 전이 완결성 | PASS | 저장소 사용 불가(FR-015) · 빈 상태(FR-019) · 중복(FR-021) · 삭제 확인(FR-023)이 명세에 있다. 여기에 R-004가 발견한 "아직 읽지 않음" 상태를 [data-model.md](./data-model.md)에 추가해 빈 상태와 구분한다. |
| 기술 제약 | PASS | App Router 유지, `strict` 유지, 색상은 `globals.css` CSS 변수, 서버·DB 미추가, 브라우저 저장소만 사용. |

**게이트 결과**: 원칙 III 위반을 명세 보강으로 해소한 뒤 통과. Phase 0 진행 가능.

### 재평가 (Phase 1 설계 이후)

| 원칙 | 판정 | 설계 반영 내용 |
|------|------|----------------|
| I | PASS | 신규 식별자를 용어집에서만 뽑았다 — `Expression`, `SavedExpression`, `useExpressions`, `.expression-card`. FR-027의 이름 변경 목록을 data-model.md §5에 표로 고정했다. |
| II | PASS | `Cards` 화면이 실제 저장 데이터만 렌더링하도록 설계했고, 복습 관련 표시는 `contracts/expression-list-ui.md`에서 "아직 구현되지 않음"을 명시적으로 표시하도록 계약화했다. |
| III | PASS | 스크립트 요소에 `tabIndex={0}`를 주면 키보드 사용자가 `Shift`+방향키로 선택할 수 있고, `getSelection()`이 그 선택도 똑같이 읽는다(R-002). 별도 UI 경로를 만들지 않고 FR-028을 충족한다. |
| IV | PASS | 최종 신규 의존성 0개. 중복 판정은 `trim()` + `normalize("NFC")` + 문자열 비교로 끝낸다(R-005). |
| V | PASS | `useExpressions`의 상태를 `loading` / `ready` / `unavailable` 3가지로 두어, 저장소를 아직 읽지 않은 순간에 빈 상태가 잘못 보이는 것을 막았다(R-004). |
| 기술 제약 | PASS | 신규 스타일은 `globals.css`에 시맨틱 클래스로 추가하고 기존 CSS 변수만 사용한다. |

**재평가 결과**: 위반 없음. Complexity Tracking 항목 없음.

## Project Structure

### Documentation (this feature)

```text
specs/002-expression-capture/
├── plan.md                        # 이 파일 (/speckit-plan 출력)
├── spec.md                        # /speckit-specify 출력
├── research.md                    # Phase 0 출력
├── data-model.md                  # Phase 1 출력
├── quickstart.md                  # Phase 1 출력
├── contracts/                     # Phase 1 출력
│   ├── use-transcript-selection.md
│   ├── use-expressions.md
│   ├── expression-sheet-ui.md
│   └── expression-list-ui.md
├── checklists/
│   └── requirements.md            # /speckit-specify 출력
└── tasks.md                       # Phase 2 (/speckit-tasks 가 생성)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                     # 변경 없음
├── globals.css                    # 신규 클래스 추가 + FR-027 식별자 이름 변경
├── page.tsx                       # Room · Feedback · Cards 수정, 셸에서 표현 모음 소유
├── lib/
│   ├── types.ts                   # SavedExpression · ExpressionDraft · StorageStatus 추가
│   ├── audio.ts                   # 변경 없음
│   └── expressions.ts             # 신규: localStorage 읽기·쓰기·삭제, 중복 판정, 정규화
├── hooks/
│   ├── useVoiceRecorder.ts        # 변경 없음
│   ├── useVoicePlayback.ts        # 변경 없음
│   ├── useExpressions.ts          # 신규: 표현 모음 상태 + 저장소 동기화 + 3상태
│   └── useTranscriptSelection.ts  # 신규: 스크립트 영역 안의 선택만 읽기
└── components/
    ├── Recorder.tsx               # 변경 없음
    ├── VoiceBubble.tsx            # 변경 없음
    ├── ExpressionSheet.tsx        # 신규: 표현 다듬기 + 뜻 입력 + 저장·취소
    └── ExpressionList.tsx         # 신규: 카드 목록, 빈 상태, 삭제
```

**Structure Decision**: 001이 세운 구조(`app/lib` · `app/hooks` · `app/components`)를 그대로
따른다. 새 레이어를 만들지 않는다.

**표현 모음의 소유자는 `TalklogApp` 셸이다.** 저장은 `Room`(스크립트에서 고르기)과
`Feedback`(FR-024)에서 일어나고 조회는 `Cards`에서 일어나므로, 세 화면의 공통 조상이
가져야 한다. 001에서 음성 메시지 목록을 셸로 올린 것과 같은 이유다 — 화면이 조건부
렌더링이라 `Room`이 언마운트되면 상태가 사라진다.

**`useTranscriptSelection`을 별도 훅으로 뺀 이유**: 선택 감지는 DOM 이벤트와 `Range`
검사를 다루고, 저장은 저장소를 다룬다. 한 훅에 넣으면 `Room`의 스크립트 토글 상태까지
얽혀 세 가지 관심사가 섞인다.

`Home` · `Review` 화면과 001의 음성 관련 파일은 FR-027의 CSS 클래스 이름 변경 외에는
손대지 않는다.

## Complexity Tracking

> Constitution Check에서 정당화할 위반이 남지 않았다. 원칙 III 위반은 명세를 보강해
> 해소했고(FR-028 · FR-029), 원칙 II 위반은 이 기능이 갚는 대상이다.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | — | — |
