# Phase 1 Data Model: 학습방 목록·개설

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-27

## 1. Room

| 필드 | 타입 | 검증·설명 |
|---|---|---|
| id | string | 고유·비어 있지 않음, 예시 id와 충돌 금지 |
| partner | string | trim/NFC 후 코드 포인트 1~20자 |
| language | 일본어 또는 영어 또는 중국어 | 허용 목록 |
| createdAt | number | 유한·0 이상·날짜로 표시 가능 epoch ms |

표시 이름은 roomName으로 파생하며 저장하지 않는다. MOCK_ROOM은 id mock-yuki, 유키, 일본어이며 사용자 배열에 넣지 않는다.

## 2. 메모리 상태

| 값 | 설명 |
|---|---|
| selectedRoomId | 선택 학습방, 초기 예시 id |
| messagesByRoom | id별 VoiceMessage 배열, 예시만 초기 2개 |
| activityByRoom | 실제 마지막 전송 시각. 없으면 createdAt 정렬 |
| RoomDraft | partner/language, 실패하면 유지 |
| pendingId | 삭제 확인 대상, 취소·성공 시 null |

메시지 수는 배열 길이, 마지막 시각은 실제 전송 시각 또는 명확한 예시 시각이다. 읽지 않은 수는 만들지 않는다. 표현 출처는 표시 이름 문자열이며 학습방 삭제로 표현을 삭제하지 않는다.

## 3. 저장소 상태와 전이

| 전이 | 결과 |
|---|---|
| 초기 → effect 읽기 | loading → ready/unavailable |
| 사용자 항목 0개 | 예시는 유지, 개설 안내 |
| 개설·삭제 | 최신 저장소 재읽기, 실패하면 쓰지 않음 |
| 쓰기 성공 | 목록 갱신·ready·입장 또는 삭제 알림 |
| 쓰기 실패 | unavailable·목록·폼·확인 유지 |
| 재시도·다음 쓰기 성공 | ready 복구 |
| 손상 JSON·비배열 | 사용자 항목 0개·ready |
| 일부 손상 | 정상 항목만 사용 |
| 삭제 성공 | 해당 메시지 URL 해제·목록 제목 포커스 |

같은 이름 학습방도 별도 id로 허용한다. 저장소 동시 쓰기의 완전한 트랜잭션은 범위 밖이다.
