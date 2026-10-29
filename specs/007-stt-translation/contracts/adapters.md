# 어댑터 계약

app/lib/understanding.ts의 TranscriptService / TranslationService를 구현한다.
입출력은 data-model.md의 도메인 타입과 AbortSignal뿐이다. 제공자 응답·모델·SDK는 노출하지 않는다.
스크립트는 힌트 언어, 번역은 한국어. source는 real/mock만 반환한다.

서버 config.ts가 선택하는 변수:

| 변수 | 허용값·역할 |
| --- | --- |
| TRANSCRIPT_PROVIDER | openai / mock; 미지정 시 키 유무 판단 |
| TRANSLATION_PROVIDER | claude / mock; 미지정 시 키 유무 판단 |
| OPENAI_API_KEY | 스크립트 서버 키 |
| ANTHROPIC_API_KEY | 번역 서버 키 |
| TRANSCRIPT_MODEL | 스크립트 모델; 기본값은 우선 브리프 |
| TRANSLATION_MODEL | 번역 모델; 기본값은 우선 브리프 |

키가 없으면 Mock. 잘못된 제공자 값은 실패. 실제 호출 실패를 Mock으로 바꾸지 않는다.
자체 모델은 어댑터 추가와 서버 config 등록·설정 변경만 수행한다.
