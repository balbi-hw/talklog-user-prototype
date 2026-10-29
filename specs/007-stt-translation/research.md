# Research: 실제 스크립트·번역

## R-001 서버·경계

Next.js Route Handler를 사용한다. 로그인·DB가 필요 없는 요청을 위해 Supabase를 먼저 도입하지 않는다.
도메인 TranscriptService / TranslationService를 서버 어댑터가 구현한다. 화면 직접 호출은 비밀 노출,
SDK는 불필요한 의존성을 만들므로 표준 fetch를 택한다.

## R-002 외부 계약

스크립트는 multipart file/model/language를 보내 JSON text를 읽는다.
[OpenAI transcription reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)
번역은 system 지시와 user 입력을 분리하고 text 블록만 추출한다.
[Claude Messages reference](https://platform.claude.com/docs/en/api/messages/create)
모델 기본값은 브리프대로 whisper-1, claude-haiku-5-5. 환경변수로 변경한다.
429/402는 limit, 408/504는 timeout, 통신 실패는 network로 정규화한다.
오류 본문·키·제공자 이름은 밖으로 전달하지 않는다. 토큰 상한으로 잘린 번역은 실패로 처리한다.

## R-003 방어 기본값

60초 압축 녹음에 여유 있는 8MiB를 허용한다. audio/webm, audio/mp4, audio/ogg, audio/mpeg,
audio/wav, audio/x-wav 및 컨테이너 별칭을 허용한다. codecs 매개변수는 제거 후 검사한다.
MIME은 클라이언트 주장이므로 실제 유효성은 외부 서비스도 검증한다. 디코더 추가 대신 기존 60초 제한과 바이트 상한을 택한다.
Content-Length만 믿지 않고 스트림 읽기에도 상한을 둔다. 번역은 8,000 UTF-16 코드 단위, JSON은 64KiB.
분당 전역 20회·동시 4개로 비용을 완화한다. 재시작 시 초기화·다중 인스턴스 미보장 한계를 plan에 기록했다.

## R-004 수명·상태

성공 결과와 진행 요청은 셸에서 메시지별 소유한다. 컴포넌트를 닫아도 요청은 계속된다.
pending 맵으로 중복 요청을 즉시 차단한다. 실패·빈 결과는 재시도 버튼으로만 다시 요청한다.
서버 30초, 브라우저 40초 취소. 삭제 시 요청 취소·결과 제거로 늦은 응답의 부활을 막는다.

## R-005 Mock·데이터

키가 없거나 mock을 선택하면 음성을 분석하지 않는 고정 예시를 반환한다. 실제 호출 실패를 Mock 성공으로 숨기지 않는다.
예시 스크립트 기반 번역도 예시로 표시한다. 앱은 학습·평가 데이터를 보관하지 않으며 제공자의 보관 정책은 단정하지 않는다.
음성·텍스트의 외부 전송 가능성을 최초 요청 자리에서 알린다.

## R-006 표현 저장

002 useTranscriptSelection·ExpressionSheet·useExpressions 재사용. 예문은 해당 스크립트 전체, 출처는 해당 학습방.
스크립트별 TranscriptCapture를 만들고 ExpressionSheet 입력 id를 useId로 고유화한다.
