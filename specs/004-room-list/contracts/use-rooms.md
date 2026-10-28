# Contract: useRooms와 학습방 저장소

**Feature**: [spec.md](../spec.md)

1. 셸에서 한 번 호출한다. status/rooms/create/remove/reload를 반환한다.
2. 첫 status는 loading이며 읽기는 effect에서 한다. rooms에는 항상 MOCK_ROOM이 포함된다.
3. create(draft)는 {ok:true, room} 또는 {ok:false, reason}이다. reason은 invalid-partner/invalid-language/storage-unavailable이다. 검증 실패는 저장하지 않는다.
4. remove(id)는 boolean, 예시 id는 항상 false다. 대상이 이미 없어도 최신 목록을 반영하고 성공할 수 있다.
5. 매 쓰기 직전 재읽기하며 읽기 실패 시 쓰지 않는다. 쓰기 실패 시 목록 유지·unavailable, 다음 성공 시 ready다.
6. readRooms/writeRooms는 모든 접근 try/catch, 깨진 JSON·항목·중복 id 제외, 외부로 예외를 던지지 않는다.
7. talklog.rooms 키의 배열에 사용자 학습방만 저장한다. 다른 키를 건드리지 않는다.
8. reload·storage 이벤트로 갱신하며 실패해도 마지막 정상 목록과 예시를 유지한다.
