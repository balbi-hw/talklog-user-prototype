# Phase 0 Research: 카드 편집

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-27

## R-001: 편집 범위와 저장 형식

**Decision**: ExpressionUpdate는 SavedExpression의 term·meaning만 받는다.
최신 저장 항목을 펼친 뒤 두 필드만 trim하여 덮는다. updatedAt은 추가하지 않는다.

**Rationale**: 예문과 출처는 실제 대화 기록이며 저장 시각은 정렬 기준이다.
기존 데이터를 그대로 읽으며 변환 작업이 없다.

**Alternatives considered**: 전체 객체 전달(불변 필드 덮어쓰기 위험), 수정 시각 추가
(현재 흐름에서 필요 없음), 삭제 후 재생성(식별자·기록 손실).

## R-002: 검증과 중복

**Decision**: 기존 isValidTerm·isValidMeaning·normalizeTerm을 재사용한다.
중복은 id가 다른 항목만 비교한다. UI에서 즉시 안내하고 저장 직전에도 검사한다.

**Rationale**: 뜻만 고칠 때 자신과 중복되지 않으며 NFC 동등 문자열을 기존 기준대로
처리한다. 저장 직전 다른 곳에서 추가된 항목도 확인한다.

**Alternatives considered**: UI만 검증(다른 호출자와 저장소 변경 누락), findDuplicate의
공개 시그니처 변경(003 소비자 영향). 기존 API는 유지한다.

## R-003: 매번 재읽기와 실패 복구

**Decision**: update는 매번 readAll을 호출한다. 실패·대상 없음·검증 실패는 쓰지 않는다.
writeAll 성공 전에는 목록 상태와 ref를 갱신하지 않는다.

**Rationale**: 기존 readBaseForWrite는 이미 읽은 뒤에는 ref를 쓴다. 새 update의 최신
저장소 보존을 위해 이 경로만 별도로 읽고 save·remove는 브리프대로 유지한다.
대상 소실은 not-found로 구분해 재생성을 막는다.

**Alternatives considered**: ref만 수정(외부 추가 손실), 훅 전체 재설계(범위 밖),
트랜잭션 저장소 도입(브리프 위반). 완전히 동시인 탭 쓰기의 원자성은 보장하지 않는다.
동일 대상의 두 필드는 마지막 저장이 이기며 최신 예문·출처는 보존한다.

## R-004: 단일 편집과 포커스

**Decision**: 목록에 편집 중 id·term·meaning 하나만 둔다. 편집 중 다른 편집·삭제 비활성,
삭제 확인 중 편집 비활성. 이유를 표시한다. 시작은 뜻 입력칸 autoFocus,
종료는 effect에서 편집 버튼 ref로 복귀한다. 실패는 폼을 유지한다.

**Rationale**: 다른 항목을 누르다 입력을 잃지 않는다. 기존 unavailable 전체 반환은
입력 DOM을 없애므로 기존 목록이 있으면 실패 안내와 함께 계속 렌더링한다.
복구 후 다시 저장할 수 있어야 한다.

**Alternatives considered**: 별도 화면(연결 변경 확대), 여러 폼(상태 복잡),
실패 시 목록 숨김(입력 손실·재시도 불가). 포커스는 React 커밋 후 복원한다.

## R-005: 입력 경로와 검증 경계

**Decision**: briefs$f.md는 존재하지 않아 같은 디렉터리의 005-expression-edit.md를
현재 브랜치와 대조해 적용했다. 브라우저 수동 검증은 별도 검증자가 수행한다.

**Rationale**: 브랜치·기능 번호·소유 경계가 일치하며 질문 없이 진행하라는 지시를 따른다.
외부 자료나 의존성 없이 002 계약과 현재 코드를 기준으로 결정할 수 있다.

**Alternatives considered**: 다른 브리프 적용(범위 불일치), 질문 대기(사용자 지시 불일치).
미확정 항목 없음.
