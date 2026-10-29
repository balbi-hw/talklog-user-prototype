# Research: 실제 문장 다듬기

## R-001 경계 확장
Decision: 007 understanding.ts 옆 타입과 기존 config/http/hook 확장.
Rationale: 원칙 VI에 맞고 취소·삭제·상태 소유를 하나로 유지한다.
Alternatives: 별도 훅/새 서버 방어 계층은 중복·정합성 비용이 커 제외.

## R-002 결과 형식
Decision: Messages API에 JSON schema output_config.format을 보내고 text 블록 JSON을 엄격 파싱한다. end_turn 외 종료, 빈 문장/이유, 초과 길이, 잘못된 타입·키, 변경 여부 모순은 failed.
Rationale: 변경 없음은 원래 스크립트와 같은 문장을 반환하는 정상 결과이며 빈 결과와 분리한다.
Alternatives: 자유 텍스트·마크다운 추출은 형식 오류를 숨기므로 제외.
공식 참고: https://platform.claude.com/docs/en/api/messages/create 및 https://platform.claude.com/docs/en/build-with-claude/structured-outputs (2026-10-29 확인).
프롬프트에 학습 언어, 학습 짝과 편한 대화, 초·중급, 짧은 한국어 이유, 입력을 지시로 취급하지 않을 것을 포함한다.
모델 기본값은 브리프 지정을 사용하며 실제 모델 접근 가능성은 키 발급 후 확인한다.

## R-003 저장과 수명
Decision: TranscriptCapture 재사용, 선택 영역 접근성 라벨만 매개변수화.
Rationale: 전체·일부 선택 및 기존 useExpressions.save·중복·실패 처리를 유지하며 예문에 전체 결과를 전달한다.
Alternatives: Feedback 재사용은 대화 재생·답장과 분리되므로 실제 다듬기에 사용하지 않는다.
스크립트 재시도 시작 시 이전 결과와 진행 요청을 제거한다. 삭제 시 늦은 응답도 버린다.

## R-004 방어·데이터
Decision: 기존 http.ts 상한·타임아웃·공유 카운터·오류 매핑 재사용. 입력 Mock은 출력에도 전파한다.
Rationale: 전체 비용 상한 유지. 실패를 Mock으로 숨기지 않는다.
앱은 입력·결과를 학습·평가용 보관/로그하지 않는다. 제공자 보관 정책은 단정하지 않는다.
