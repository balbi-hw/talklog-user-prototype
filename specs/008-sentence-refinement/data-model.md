# Data Model

## RefinementInput
transcript: trim 후 1~8,000 UTF-16 코드 단위. language: ja|en|zh. source: real|mock.

## RefinementResult
refinedSentence: trim 후 1~8,000자. reason: trim 후 1~1,000자 한국어 설명. changed: boolean. source: real|mock.
changed=false면 refinedSentence는 입력 스크립트와 같아야 한다. changed=true면 달라야 한다.

## RefinementState
idle → pending → success|unchanged|failed|timeout|limit|network.
실패 계열 → 명시적 다시 시도 → pending. success/unchanged는 재열기 시 재사용.
스크립트 재요청 → 요청 취소 + idle. 메시지 삭제 → 요청·상태 제거. 화면 접기는 요청 취소하지 않는다.

## 표현 연결
선택한 전체/일부 → term, 수동 입력 → meaning, 전체 refinedSentence → example, roomName → sourceRoom.
기존 useExpressions.save를 사용한다. 다듬기 결과는 영속화하지 않지만 사용자가 저장한 표현은 기존 저장소에 남는다.
