# 도메인·HTTP·화면 계약

## Interface
RefinementService.refinement(input: RefinementInput, signal: AbortSignal): Promise<RefinementResult>.
도메인 입력·출력은 data-model.md 참조. 제공자 형식은 서버 어댑터에만 있다.

## POST /api/refinement
Content-Type: application/json. 본문 전체 64KiB 상한.
요청: {"transcript":"I go yesterday.","language":"en","source":"real"}.
응답: {"ok":true,"result":{"refinedSentence":"I went yesterday.","reason":"지난 일이라 과거형을 썼어요.","changed":true,"source":"real"}}.
변경 없음: changed=false, 문장은 입력과 같고 reason은 그대로도 자연스러움을 설명.
실패: {"ok":false,"error":{"code":"failed"}}.
Cache-Control: no-store. 429에는 Retry-After: 60. 오류 본문에 제공자·키·입력 없음.

| 코드 | HTTP | 화면 |
| --- | --- | --- |
| invalid-input | 400 | failed |
| too-large | 413 | failed |
| unsupported-format | 415 | failed |
| failed | 502 | failed |
| timeout | 504 | timeout |
| limit | 429 | limit |
| network | 503 | network |

## UI
내 녹음에만 표시. 스크립트 준비 전 비활성·이유 안내. 최초 열기 요청, 성공·unchanged 재사용.
대기·처리·성공·바꿀 것 없음·오류는 role=status, 오류에 다시 시도. 기본 행동 비차단.
Mock 입력이나 Mock 어댑터면 실제 분석이 아님을 표시. 요청 전 외부 전송·미보관 안내.
결과 선택 영역은 기존 TranscriptCapture와 useExpressions.save 계약을 따른다.
