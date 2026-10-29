# Validation: 008 실제 문장 다듬기

2026-10-29, branch `008-sentence-refinement`. 커밋하지 않음.

## 절차·일관성 검토

specify → 브리프 사전 답변으로 clarify → plan/research/data-model/contracts/quickstart → tasks → 구현·검증.
요구사항 체크리스트 8/8 통과, 작업 13/13 구현 완료. 확장 훅 파일 없음.
지정 common.md가 존재하지 않고 Temp/claude 아래 검색에서도 발견되지 않아 우선 브리프·저장소 절차를 적용했다.
PowerShell 실행 정책 때문에 초기 스크립트 실행이 거부되어 별도 PowerShell 프로세스에 ExecutionPolicy Bypass를 지정해 실행했다. 시스템 정책은 변경하지 않았다.

| 요구사항 | 구현·검증 연결 |
| --- | --- |
| FR-001 | 내 녹음·준비된 스크립트 가드, T007~008, 훅 검증 |
| FR-002 | 구조화 JSON·변경 여부·빈 값 검증, T004·008, 어댑터 검증 |
| FR-003 | 메모리 재사용·취소·이전 응답 버림, T007·009, 훅 검증 |
| FR-004 | 오류 매핑·타임아웃·재시도, T003·009~010, API·훅 검증 |
| FR-005 | AI 상태가 메시지·녹음기·저장을 잠그지 않는 구조, T008~011, 코드 검토 |
| FR-006 | 기존 TranscriptCapture→ExpressionSheet→useExpressions.save 재사용, T011, 코드 검토 |
| FR-007 | real/mock 전파·표시, 고정 Feedback 유지, T004~008, API 검증·코드 검토 |
| FR-008 | 외부 전송·앱 미보관 안내, T008·012, 코드 검토 |
| FR-009 | expanded/controls·status·기존 키보드 선택, T008·010~011, 코드 검토 |

## 실행 결과

- `npm.cmd run build`: OPENAI_API_KEY·ANTHROPIC_API_KEY를 비운 프로세스에서 성공, TypeScript 오류 0.
- `node tests/refinement.cjs`: 23 시나리오 통과. 모듈은 TypeScript로 변환해 격리 로드하며 훅 상태 저장과 통신을 대체하므로 실제 브라우저 React 수명·선택 동작 검증을 대체하지 않는다.
  중복 요청·3회 재열기·변경 없음, 오류 4종·재시도·offline, 삭제·스크립트 재요청 중 늦은 응답,
  클라이언트 시간 초과, 대상 가드, JSON schema 요청·잘못된 JSON/빈 문장/변경 모순/길이/추가 키/토큰 중단,
  동시 요청 상한, 입력 출처 전파, 모델 설정, 키 없는 Mock 전환을 검증했다.
- 로컬 production 서버 `/api/refinement` 스모크 15 시나리오 통과: en/ja/zh 결과와 변경 없음,
  빈 입력·지원하지 않는 언어·출처·초과 길이·깨진 JSON, 415·413, 기존 번역 응답 회귀,
  공유 분당 한도 429·Retry-After·no-store 확인.
- `git diff --check` 통과. package.json·package-lock.json 변경 없음. 새 런타임 의존성 0.
- 화면·훅·도메인 타입에서 제공자·모델 이름 검색 결과 없음.

## 미검증·한계

- 브라우저 연결 호스트가 unavailable이며 브라우저 목록이 비어 있어 quickstart의 화면 조작·전체/일부 선택·실제 저장·재생/답장 동시 조작·모바일 레이아웃은 실행하지 못했다. 기존 저장 경로 연결은 코드 검토만 수행했다.
- 실제 키 호출과 실제 제공자 모델 접근 가능성은 브리프 범위 밖이며 미검증이다.
- 기존 서버 메모리 한도는 재시작 시 초기화되고 다중 인스턴스에서 공유되지 않는다. 결과도 새로고침 시 사라진다.
