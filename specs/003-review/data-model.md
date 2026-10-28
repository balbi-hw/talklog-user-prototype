# Phase 1 Data Model: 저장한 표현 복습

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## ReviewRecord

`talklog.reviews` 배열. 한 표현 id당 하나, 표현 자체는 변경하지 않는다.

| 필드 | 타입 | 검증 |
|---|---|---|
| expressionId | string | 비어 있지 않고 현재 표현에 존재 |
| dueDate | string | 실제 로컬 달력 날짜 YYYY-MM-DD |
| intervalDays | number | 정수 1~30 |
| knownCount | number | 안전한 정수 0 이상 |
| answerCount | number | 안전한 정수 1 이상, knownCount 이상 |

손상·고아 항목을 제외하고 중복 id는 마지막 유효 항목을 쓴다. JSON 전체 손상은 빈 배열로
복구하고 접근 자체 실패는 unavailable이다. 정답률은 round(known 합/answer 합×100), 응답 0이면 null.

## Card와 세션

Card는 SavedExpression과 파생 예정일이다. 기록 없으면 savedAt 로컬 날짜(비정상이면 오늘).
dueDate <= today를 예정일→savedAt→id 순으로 최대 20개 선택한다.
세션은 `{expressionId, repeated}` 큐, 현재 위치, 원래 고유 카드 수, id별 최종 응답 Map이다.
최대 40회 응답, 완료 두 응답 수의 합은 고유 응답 카드 수다.

## 전이

| 현재 | 사건 | 다음/영속 효과 |
|---|---|---|
| loading | effect 읽기 | ready 또는 unavailable |
| ready | 시작 | 최신 저장소로 최대 20개 큐 확정 |
| 앞면 | 뜻 보기 | 뒤집힘, 뜻·예문·출처와 응답 표시 |
| 뒤집힘 | know | 최초 간격1/이후 min(간격×2,30), 오늘+간격. 두 카운터 +1 |
| 뒤집힘 | again | 간격1, 예정 오늘. answerCount +1. 첫 순회만 재추가 |
| 뒤집힘 | 쓰기 실패 | unavailable, 큐·통계·카드 유지 |
| 세션 | 표현 삭제 | 해당 항목 건너뜀, 고아 기록 무시 |
| 마지막 응답 | 저장 성공 | 완료, 카드별 최종 응답 집계 |
| 세션 | 이탈 | 세션 폐기, 영속 응답 유지 |
| unavailable | 재시도 성공 | ready, 실패 카드 응답 재시도 가능 |
