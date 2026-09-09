# Implementation Plan: 실제 음성 녹음·재생

**Branch**: `001-voice-recording` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-voice-recording/spec.md`

## Summary

학습방의 가짜 녹음 타이머를 실제 녹음으로 대체하고, 전송 전 확인 단계(미리 듣기 · 다시
녹음 · 전송 · 취소)를 도입하며, 대화의 음성 메시지를 실제로 재생한다.

기술 접근은 브라우저 표준 API만 사용한다. `getUserMedia` + `MediaRecorder`로 녹음하고,
`HTMLAudioElement`로 재생한다. 신규 런타임 의존성은 추가하지 않는다. 녹음 길이는
`MediaRecorder`가 만든 Blob의 메타데이터를 믿지 않고 자체 타이머로 측정한다(Phase 0
연구 결과 R-003). 상태는 React 내장 훅으로 관리하며, 녹음·재생 로직은 커스텀 훅 2개로
분리해 `app/page.tsx`의 화면 코드와 섞지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`, target ES2017), React 19.1.0

**Primary Dependencies**: 신규 추가 없음. 기존 next 15.3.5 / react / react-dom 만 사용.
브라우저 표준 API: `navigator.mediaDevices.getUserMedia`, `MediaRecorder`,
`HTMLAudioElement`, `URL.createObjectURL`

**Storage**: N/A. 녹음 결과는 메모리 내 `Blob`으로만 보관하며 새로고침 시 소실된다
(Constitution 기술 제약: 백엔드·DB 없음).

**Testing**: 자동화 테스트 없음 (Constitution 개발 워크플로 — 현재 필수 아님).
검증은 `npm run build` 통과 + [quickstart.md](./quickstart.md)의 수동 시나리오.

**Target Platform**: 모바일 우선 최신 브라우저 (Chrome/Edge 109+, Safari 15+, Firefox
115+). `getUserMedia`는 secure context를 요구하므로 `https` 또는 `http://localhost`
에서만 동작한다.

**Project Type**: Web application (Next.js App Router, 프론트엔드 전용, 서버 라우트 없음)

**Performance Goals**: 권한이 이미 허용된 상태에서 마이크 버튼 누름 → 녹음 시작까지 체감
지연 200ms 이내. 경과 시간 표시는 1초 단위. 표시 길이와 실제 길이 오차 1초 이내
(SC-003).

**Constraints**: 최대 녹음 60초(FR-009). 신규 런타임 의존성 0개(원칙 IV). 레이아웃은
520px `.phone-frame` 기준(원칙 III). 새로고침 시 데이터 소실 허용.

**Scale/Scope**: 5개 화면 중 학습방(`room`) 화면 1개를 수정. 신규 파일 6개(훅 2개,
컴포넌트 2개, 유틸·타입 2개), 예상 신규 코드 350~450줄. 기존 화면 4개는 변경하지 않는다.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### 초기 평가 (Phase 0 이전)

| 원칙 | 판정 | 근거 |
|------|------|------|
| I. 흐름 검증 우선 | PASS | `draft.md` §4 5단계(음성 재생) · 8단계(답장 녹음) · 9단계(전송)를 직접 검증한다. spec.md의 각 User Story가 해당 단계를 명시한다. |
| II. Mock 경계 명시 | PASS (조치 필요) | FR-016이 소리 없는 기존 Mock 메시지를 실제 녹음과 구분하도록 요구한다. SC-007이 `README.md` 미구현 목록 갱신을 완료 조건으로 둔다. 두 항목 모두 tasks에 반영해야 한다. |
| III. 모바일 우선·접근성 | PASS | FR-023이 키보드 조작과 아이콘 컨트롤의 텍스트 대체를 요구한다. 신규 컨트롤(미리 듣기·다시 녹음·전송·취소)은 모두 `<button>` + `aria-label`로 구현하고, 녹음 상태는 `aria-live`로 알린다. |
| IV. 최소 의존성 | PASS | 파형 라이브러리(wavesurfer.js 등)와 상태 관리 라이브러리를 도입하지 않는다. 기존 `<Wave>` 컴포넌트의 고정 막대를 재사용하고 진행 표시만 CSS로 얹는다. |
| V. 상태 전이 완결성 | PASS | 마이크 상태 6종(미확인·요청중·허용·거부·장치없음·미지원)과 녹음 상태 머신 5종을 [data-model.md](./data-model.md)에 정의한다. FR-010(빈 녹음 차단), FR-021(오류 복구), FR-022(화면 이동 시 확인)이 예외 경로를 덮는다. |
| 기술 제약 | PASS | App Router 유지, Pages Router 미추가, `strict` 유지, 색상은 `globals.css` CSS 변수, 백엔드 미추가. |

**게이트 결과**: 위반 없음. Phase 0 진행 가능.

### 재평가 (Phase 1 설계 이후)

| 원칙 | 판정 | 설계 반영 내용 |
|------|------|----------------|
| I | PASS | 설계가 US1(P1) 단독으로도 동작하도록 훅을 분리했다. `useVoicePlayback`을 붙이지 않아도 `useVoiceRecorder`의 미리 듣기만으로 US1 검증이 끝난다. |
| II | PASS | `VoiceMessage.source`를 `"mock" \| "recorded"` 로 명시적 필드로 두고, `mock` 메시지의 재생 버튼은 `disabled` + 안내 `title`로 처리한다 (contracts/voice-message-ui.md). |
| III | PASS | 신규 UI 상태별 접근성 계약을 contracts/recorder-ui.md에 상태-속성 표로 고정했다. |
| IV | PASS | 최종 신규 의존성 0개. `MediaRecorder` mimeType은 `isTypeSupported`로 런타임 선택하며 폴리필을 넣지 않는다 (research.md R-001). |
| V | PASS | 녹음 상태 머신의 모든 전이와 종료 조건을 data-model.md에 표로 정의했고, 정의되지 않은 전이는 없다. `stream.getTracks().stop()` 정리 시점도 명시했다 (R-005). |
| 기술 제약 | PASS | 신규 스타일은 `globals.css`에 시맨틱 클래스로 추가하고 JSX에 Tailwind 유틸리티를 흩뿌리지 않는다. |

**재평가 결과**: 위반 없음. Complexity Tracking 항목 없음.

## Project Structure

### Documentation (this feature)

```text
specs/001-voice-recording/
├── plan.md                      # 이 파일 (/speckit-plan 출력)
├── spec.md                      # /speckit-specify 출력
├── research.md                  # Phase 0 출력
├── data-model.md                # Phase 1 출력
├── quickstart.md                # Phase 1 출력
├── contracts/                   # Phase 1 출력
│   ├── use-voice-recorder.md
│   ├── use-voice-playback.md
│   ├── recorder-ui.md
│   └── voice-message-ui.md
├── checklists/
│   └── requirements.md          # /speckit-specify 출력
└── tasks.md                     # Phase 2 (/speckit-tasks 가 생성, 이 명령은 생성하지 않음)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                   # 변경 없음
├── globals.css                  # 신규 시맨틱 클래스 추가 (녹음 확인 단계, 재생 진행, 안내 배너)
├── page.tsx                     # Room 화면만 수정 — 훅 연결과 신규 컴포넌트 배치
├── lib/
│   ├── types.ts                 # 신규: VoiceMessage · MicrophoneStatus · RecordingState 등 공유 타입
│   └── audio.ts                 # 신규: mimeType 선택, 지원 여부 판별, getUserMedia 오류 분류, 시간 포맷
├── hooks/
│   ├── useVoiceRecorder.ts      # 신규: 마이크 권한 + 녹음 상태 머신 + Blob·길이 생성
│   └── useVoicePlayback.ts      # 신규: 대화 전체에서 단일 재생 보장 + 진행 위치
└── components/
    ├── Recorder.tsx             # 신규: 녹음 영역 UI (idle / requesting / recording / review / error)
    └── VoiceBubble.tsx          # 신규: 음성 메시지 버블 (재생 버튼 + 파형 + 진행 + 길이)
```

**Structure Decision**: 기존 단일 파일 구조(`app/page.tsx` 160줄)를 전면 분해하지 않는다.
README의 "화면별 컴포넌트·라우트 분리"는 별도 기능이며 이 기능의 범위가 아니다. 대신 이
기능이 새로 만드는 코드만 `app/lib`, `app/hooks`, `app/components`로 내보내
`page.tsx`에는 훅 호출과 컴포넌트 배치만 남긴다.

근거: 녹음 상태 머신과 재생 조율 로직을 `page.tsx`에 인라인하면 파일이 500줄을 넘고
`Room` 컴포넌트가 UI와 장치 제어를 동시에 맡게 된다. 훅으로 분리하면 US1과 US2를
독립적으로 구현·검증할 수 있어 spec의 우선순위 구조와도 맞는다.

기존 화면 4개(`Home`, `Feedback`, `Cards`, `Review`)와 `Wave` · `Icon` · `NavButton`은
그대로 둔다. `Wave`는 `VoiceBubble` 내부에서 재사용한다.

## Complexity Tracking

> Constitution Check에서 위반이 발견되지 않았으므로 정당화할 항목이 없다.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | — | — |
