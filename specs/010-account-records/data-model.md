# Data Model: 학습 기록을 계정에 저장하기

## 1. 클라이언트

| 이름 | 위치 | 내용 |
| --- | --- | --- |
| RecordScope | `app/lib/record-scope.ts` | `pending` · `device` · `account { userId, loaded }` |
| 기기 키 | localStorage | `talklog.rooms` · `talklog.expressions` · `talklog.reviews` (002~004 그대로) |
| 계정 사본 | localStorage | `talklog.account.<id>.rooms` · `.expressions` · `.reviews` · `.outbox` · `.loaded` |
| 가져오기 처리 | localStorage | `talklog.import-handled.<id>` — 로그아웃해도 남는다 |
| Op | `.outbox` 배열 | `{ seq, collection, kind: "upsert" \| "delete", id, item? }` — 항목마다 하나 |
| SyncStatus | `app/lib/record-sync.ts` | `state: idle \| loading \| syncing \| offline \| error`, `pending: number` |

### 범위 전이

```text
pending ─(키 없음 · 로그아웃)→ device
pending ─(로그인)→ account(loaded = 사본 있음) ─(받아 오기 성공)→ account(loaded)
account ─(로그아웃 확정)→ 사본·대기열 삭제 → device
```

## 2. 서버 (public 스키마, 모두 RLS)

| 테이블 | 기본 키 | 열 | 클라이언트 필드 |
| --- | --- | --- | --- |
| rooms | (user_id, id) | partner, language(일본어·영어·중국어), created_at_ms, updated_at | Room |
| expressions | (user_id, id) | term, meaning, example, source_room, saved_at_ms, updated_at | SavedExpression |
| review_records | (user_id, expression_id) | due_date, interval_days(1~30), known_count, answer_count, updated_at | ReviewRecord |

- `user_id uuid default auth.uid() references auth.users on delete cascade`.
- `updated_at` 은 트리거가 갱신한다 (진단용, 클라이언트는 읽지 않는다).
- 정책: select/insert/update/delete 각각 `to authenticated`, `(select auth.uid()) = user_id`. update 는 `with check` 도 같다.
