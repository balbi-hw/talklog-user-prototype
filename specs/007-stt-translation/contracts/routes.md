# Route Handler 계약

POST만 지원, Node 런타임, Cache-Control: no-store.
성공 `{ok:true,result:{text,source}}`, 실패 `{ok:false,error:{code}}`.
키·모델·제공자 이름·외부 오류 본문 없음.

## POST /api/transcript

multipart/form-data: voice(File, 1~8MiB), language(ja/en/zh).
MIME audio/webm, audio/mp4, audio/ogg, audio/mpeg, audio/wav, audio/x-wav,
video/webm, video/mp4, application/ogg. 매개변수 제거 후 검사.
전체 요청 8MiB+64KiB 스트림 상한. 외부 전송 전에 검증한다.

## POST /api/translation

application/json `{transcript,language,source}`. trim 후 1~8,000자, 전체 64KiB.
언어 ja/en/zh, source real/mock. 목적 언어는 한국어 고정.
입력이 mock이거나 어댑터가 mock이면 결과도 mock.

## 오류 매핑

| code | HTTP | 화면 |
| --- | --- | --- |
| invalid-input | 400 | failed |
| too-large | 413 | failed |
| unsupported-format | 415 | failed |
| failed | 502 | failed |
| timeout | 504 | timeout |
| limit | 429 | limit |
| network | 503 | network |

빈 text는 200, 화면 empty. 전역 분당 20회·동시 4개 초과는 limit.
클라이언트 통신 실패는 network, 40초 취소는 timeout. 자동 재시도 없음.
