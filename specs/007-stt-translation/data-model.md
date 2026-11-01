# Data Model: 이해 보조

| 타입 | 필드·제약 |
| --- | --- |
| LearningLanguage | ja / en / zh |
| ResultSource | real / mock; 제공자 이름 없음 |
| UnderstandingResult | text: string, source: ResultSource; 공백 text는 빈 결과 |
| TranscriptInput | voice: Blob, language: LearningLanguage |
| TranslationInput | transcript: trim 후 1~8,000자, language, source; 목적 언어 ko 고정 |
| TranscriptService | transcript(input, signal): Promise<UnderstandingResult> |
| TranslationService | translation(input, signal): Promise<UnderstandingResult> |

각 message.id 아래 transcript와 translation의 독립 상태를 가진다. 최초 idle → 명시 열기 pending →
success / empty / failed / timeout / limit / network. success만 재열기 시 재사용한다.
실패·빈 결과 → 재시도 버튼 → pending. 닫기·화면 이동은 요청 상태를 바꾸지 않는다.
스크립트 success일 때만 번역 요청 가능. 스크립트 재시도는 번역 캐시를 제거한다.
음성 blob URL을 읽기만 하고 삭제하지 않는다. 학습방 삭제 시 요청 취소·결과 제거.
새로고침 시 메시지와 결과 소멸, 사용자가 저장한 표현만 기존 저장소에 유지한다.
