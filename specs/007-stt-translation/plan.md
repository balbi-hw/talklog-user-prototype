# Implementation Plan: 실제 스크립트·번역

**Branch**: `007-stt-translation` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: `specs/007-stt-translation/spec.md`

## Summary

최초 스크립트 열기에 음성을 전송하고, 준비된 스크립트의 번역을 별도 열기로 요청한다.
도메인 계약 뒤에 서버 어댑터를 격리하고 키가 없으면 명시된 Mock을 쓴다. 002 표현 저장 경로를 재사용한다.

## Technical Context

**Language/Version**: TypeScript 5 strict, React 19, Next.js 15 App Router.
**Primary Dependencies**: 추가 0개. fetch, FormData, Blob, AbortController, ReadableStream.
**Storage**: 셸 메모리의 메시지별 결과. 서버는 제한 카운터만 보관하며 음성·텍스트를 저장·로그하지 않는다.
**Testing**: 키 없는 build와 API 계약 스모크 검사. quickstart 브라우저 검증은 별도 검증자가 수행한다.
**Target Platform**: 520px 모바일 셸, 최신 브라우저, Node.js.
**Project Type**: Next.js 웹 앱. Supabase는 로그인 기능에서 도입하므로 기존 Route Handler를 쓴다.
**Performance Goals**: 처리 중 기본 행동 유지, 성공 결과 재열기에 추가 요청 0회.
**Constraints**: 서버 30초/클라이언트 40초. 음성 8MiB, multipart 전체 8MiB+64KiB. 번역 8,000자/JSON 64KiB.
**Scale/Scope**: 로그인 전 프로토타입. 전역 분당 20회·동시 처리 4개 제한.

## Constitution Check

| 원칙 | 설계 전 | 설계 후 근거 |
| --- | --- | --- |
| I 도메인·흐름 | PASS | 이해 보조 Supporting, 6·7·10단계, transcript/translation |
| II Mock 경계 | PASS | real/mock 출처만 응답, 예시 입력 번역도 mock 전파, 피드백 예시 유지 |
| III 접근성 | PASS | aria-expanded/controls, 상태 알림, 002 선택·포커스 복귀 재사용 |
| IV 최소 의존성 | PASS | SDK 없이 fetch, 새 런타임 의존성 0개 |
| V 상태 완결성 | PASS | 독립 상태·재시도·원본 보존·재생과 답장 비차단 |
| VI AI 경계 | PASS | 도메인 인터페이스, 서버 config 단일 선택, adapters에 제공자 형식 격리 |
| 기술 제약 | PASS | server-only 방어, 서버 환경변수, .env* 차단, 키 없는 build |

설계 전·후 게이트 모두 통과. 자체 모델은 인터페이스를 구현한 어댑터 추가와 config 등록·설정 변경으로 교체한다. 화면·도메인은 수정하지 않는다.

## Project Structure

```text
specs/007-stt-translation/
  spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
  checklists/requirements.md
  contracts/adapters.md, routes.md, message-ui.md
app/
  api/transcript/route.ts
  api/translation/route.ts
  lib/understanding.ts
  lib/server/understanding/config.ts, http.ts
  lib/server/understanding/adapters/openai.ts, claude.ts, mock.ts
  hooks/useMessageUnderstanding.ts
  components/MessageUnderstanding.tsx, TranscriptCapture.tsx
  page.tsx, globals.css, components/ExpressionSheet.tsx
.env.example, .gitignore, README.md
```

**Structure Decision**: 기존 lib/hooks/components 구조 유지. import "server-only"로 서버 코드의 클라이언트 유입 차단.
기존 blob URL을 읽어 MIME을 유지하므로 녹음 기능 변경 없음. 요청·결과는 셸에서 소유하고 삭제 시 취소·제거한다.
ExpressionSheet 입력 id는 여러 스크립트 동시 사용에 맞게 고유화한다.

## Complexity Tracking

위반 없음. 메모리 제한은 서버 재시작 시 초기화되며 다중 인스턴스에서 공유되지 않는다.
전역 제한이므로 특정 사용자의 요청이 다른 사용자를 잠시 막을 수 있다. 인증 없는 강한 남용 방어는 범위 밖이다.
