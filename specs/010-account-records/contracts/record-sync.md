# Contract: 기록 범위와 동기화

## record-scope.ts

| 함수 | 약속 |
| --- | --- |
| `recordKey(collection)` | 지금 범위의 키. `pending` 또는 계정 미수신이면 `null` (그리고 받아 오기를 재촉한다) |
| `readRaw(collection)` | 키가 없거나 저장소 예외면 `{ ok: false }`. 예외를 던지지 않는다 |
| `writeRecords(collection, items)` | 성공 여부를 돌려준다. 계정 범위면 저장돼 있던 값과 비교해 대기열에 남긴다 |
| `subscribeRecordScope(fn)` | 범위가 바뀌거나 서버에서 새 기록을 받으면 호출. 훅은 다시 읽는다 |

`readAll`(expressions)·`readRooms`·`readReviews` 와 각 쓰기 함수는 이 모듈을 거친다. 기기 키 이름은 바뀌지 않는다.

## record-sync.ts

| 함수 | 약속 |
| --- | --- |
| `startAccountRecords(userId)` | 범위를 계정으로 바꾸고 받아 온다. 사본이 있으면 바로 보인다 |
| `switchToDeviceRecords()` | 범위를 기기로 바꾸고 타이머를 멈춘다 |
| `retrySync()` | 미수신이면 받아 오기, 대기열이 있으면 보내기, 아니면 받아 오기 |
| `importDeviceRecords(userId)` | 계정 수신 후에만. 중복을 건너뛰고 `{ rooms, expressions, skipped }`. 처리 표시를 남긴다 |
| `clearAccountCopy(userId)` | `talklog.account.<id>.*` 삭제. 처리 표시는 남긴다 |

서버 요청은 모두 15초 상한이 있다. 실패는 예외로 새지 않고 `SyncStatus` 로만 드러난다.

## Supabase 요청

- 받기: `GET /rest/v1/<table>?select=...` (RLS 가 주인 행만 돌려준다)
- 갱신: `POST /rest/v1/<table>?on_conflict=user_id,<id열>` (upsert, 행마다 `user_id` 포함)
- 삭제: `DELETE /rest/v1/<table>?user_id=eq.<id>&<id열>=in.(...)`

## 검증 후 보완 (F1~F4)

- 받아 오기와 보내기는 겹치지 않는다. 한쪽이 진행 중이면 다른 쪽은 끝난 뒤로 미룬다. 받아 온 값 위에는 응답을 기다리는 동안 쌓인 변경까지 다시 얹는다.
- 묶음이 제약 위반(Postgres 22xxx·23xxx)으로 거부되면 하나씩 다시 보내 받아 주지 않는 변경만 `talklog.account.<id>.rejected` 로 옮긴다. 나머지 변경은 계속 보낸다. 거부된 변경은 이 기기 사본에 남고, 같은 항목을 다시 고치면 새 변경으로 다시 보낸다. 상태 `SyncStatus.rejected` 로 알리고, 로그아웃 경고 개수에 포함한다.
- 보내는 중에 로그아웃하면 응답이 와도 그 사용자의 사본 키를 다시 만들지 않는다.
- 계정 기록을 받아 오기 전(`account`, `loaded: false`)에는 훅이 이전 범위의 목록을 지우고 loading 으로 둔다 (`isRecordScopeReady`).
- 표현·뜻 입력은 2000자 상한(테이블 제약과 같음)을 둔다.
