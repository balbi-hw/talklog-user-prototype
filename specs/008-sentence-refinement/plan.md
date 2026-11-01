# Implementation Plan: 실제 문장 다듬기

**Branch**: `008-sentence-refinement` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

## Summary
내 녹음의 준비된 스크립트에서 메시지 내 다듬기를 연다. 별도 화면 대신 MessageUnderstanding을 확장해 대화와 저장을 계속 가능하게 한다. 기존 Feedback은 예시로 유지한다.

## Technical Context
- TypeScript 5 strict, React 19, Next.js 15 App Router, 520px 모바일 셸.
- 추가 런타임 의존성 0. fetch와 AbortController 사용.
- 셸의 useMessageUnderstanding에 refinement 상태를 추가한다. 성공/변경 없음 결과는 메모리 보관하며 화면 이동에도 유지한다. 스크립트 재요청 시작 시 무효화·취소한다.
- 서버 30초, 클라이언트 40초. JSON 64KiB, 입력·다듬은 문장 8,000자, 한국어 이유 1,000자.
- 검증: 키 없는 build, API 계약 스모크, 브라우저 시나리오. 실제 키 검증은 범위 밖.

## Constitution Check
| 원칙 | 설계 전 | 설계 후 근거 |
| --- | --- | --- |
| I | PASS | 표현 학습 Core, 흐름 7·11, refinedSentence 사용 |
| II | PASS | 입력 mock 전파, 결과 표시, Feedback 예시 유지 |
| III | PASS | aria-expanded/controls, role=status, 기존 키보드 선택 재사용 |
| IV | PASS | 추가 의존성 0, fetch |
| V | PASS | 모든 상태·재시도, 원본 보존·기본 행동 비차단 |
| VI | PASS | understanding.ts 도메인 계약, 서버 config와 adapters 격리 |
| 기술 제약 | PASS | server-only, 키 서버 전용, 키 없는 build |

## Project Structure
- app/lib/understanding.ts: RefinementService/Input/Result/State 및 검증 함수.
- app/lib/server/understanding/adapters/refinement.ts: Claude·Mock 어댑터.
- app/lib/server/understanding/config.ts: refinementService 선택, REFINEMENT_PROVIDER claude|mock, REFINEMENT_MODEL 기본 claude-haiku-5-5, ANTHROPIC_API_KEY 재사용·없으면 Mock.
- app/lib/server/understanding/http.ts: 기존 공통 처리기를 제네릭으로 확장해 결과를 보존.
- app/api/refinement/route.ts: 크기 제한·검증·출처 전파.
- app/hooks/useMessageUnderstanding.ts: 메시지별 상태·중복 방지·취소·무효화 확장.
- app/components/MessageUnderstanding.tsx, TranscriptCapture.tsx: 인라인 진입과 선택 저장.
- README.md, docs/domain-model.md, docs/product-plan.md, .env.example 동기화.

## Complexity Tracking
위반 없음. http.ts의 기존 분당 20회·동시 4개 카운터를 공유한다. 비용 발생 작업 전체에 총 상한을 적용하고 별도 제한을 우회해 총량이 커지는 것을 막는다. 단일 프로세스 메모리이므로 재시작·다중 인스턴스 한계는 007과 같다. 세 요청이 서로 한도를 소모할 수 있다.
