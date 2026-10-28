# Phase 1 Data Model: 카드 편집

**Feature**: [spec.md](./spec.md) | **Date**: 2026-10-27

## 1. SavedExpression — 기존 저장 표현

| 필드 | 타입 | 편집 | 불변식 |
|---|---|---|---|
| id | string | 불가 | 최신 대상 식별자 유지 |
| term | string | 가능 | 기존 isValidTerm 통과, trim 후 저장 |
| meaning | string | 가능 | trim 후 1자 이상, trim 후 저장 |
| example | string | 불가 | 최신 대상 예문 유지 |
| sourceRoom | string | 불가 | 최신 대상 출처 학습방 유지 |
| savedAt | number | 불가 | 값과 savedAt 내림차순 유지 |

추가 필드 없음. 기존 배열과 하위 호환이며 깨진 항목은 기존 readAll대로 버린다.

## 2. ExpressionUpdate

SavedExpression의 term·meaning만 가진다. UI 편집 상태에는 대상 id도 있다.
동시에 최대 하나. 입력에 다른 필드가 있어도 두 필드만 적용한다.
정규화 키는 term.trim().normalize("NFC"), 대상 id를 제외해 중복을 비교한다.

## 3. UpdateResult

| 결과 | 의미 | 상태 변경 |
|---|---|---|
| ok: true, saved | 저장된 표현 | 쓰기 성공 후 목록·ref 갱신, ready |
| invalid-term | 표현 규칙 위반 | 목록·입력 유지 |
| invalid-meaning | 뜻이 비어 있음 | 목록·입력 유지 |
| duplicate | 다른 id의 정규화 키와 같음 | 목록·입력 유지 |
| not-found | 최신 저장소에 대상 없음 | 목록·입력 유지, 재생성 없음 |
| storage-unavailable | 읽기·쓰기 실패 | unavailable, 목록·입력 유지 |

UpdateFailure는 기존 SaveFailure에 not-found를 더한 별도 타입이다.
순수 함수 성공에는 전체 next 배열과 saved가 있고 훅은 saved만 반환한다.

## 4. 상태 전이

| 상태 | 조작 | 다음 상태 | 포커스 |
|---|---|---|---|
| loading | effect 읽기 | ready / unavailable | 변경 없음 |
| ready + 빈 목록 | 표시 | 저장 방법 안내 | 변경 없음 |
| 일반 목록 | 편집 | 편집 중 하나 | 뜻 입력칸 |
| 편집 중 | 잘못된 입력 | 이유·저장 비활성 | 입력 유지 |
| 편집 중 | 저장 성공 | 완료 알림·일반 목록 | 해당 편집 버튼 |
| 편집 중 | 실패 | 실패 알림·편집 유지 | 입력 영역 유지 |
| 실패 | 복구 후 저장 | ready·일반 목록 | 해당 편집 버튼 |
| 편집 중 | 취소 / 화면 이동 | 초안 폐기·저장값 유지 | 취소는 편집 버튼 |
| 일반 목록 | 삭제 | 기존 삭제 확인 | 확인 취소 버튼 |
| 삭제 확인 | 취소 | 일반 목록 | 해당 삭제 버튼 |

편집과 삭제 확인은 상호 배타이며 다른 항목 편집은 종료 후에만 허용한다.
