# Contract: 서버 함수·저장소 (011)

모든 함수는 `authenticated` 만 실행할 수 있다. `anon`·`public` 실행 권한은 거둔다. `security definer`, `set search_path = ''`. `auth.uid()` 가 없으면 `{ok:false, reason:"failed"}` 이다.

| 함수 | 인자 | 성공 | 실패 reason |
| --- | --- | --- | --- |
| `ensure_shared_room` | `p_room_id text, p_language text` | `{ok, shared_room_id}`. 이미 있으면 그대로 | `invalid`, `closed` |
| `create_invite` | `p_room_id text, p_language text` | `{ok, code, expires_at}`. 공유 정보가 없으면 만들고, 이전 유효 코드는 취소한다 | `invalid`, `has-partner`, `closed` |
| `revoke_invite` | `p_room_id text` | `{ok}` | — |
| `current_invite` | `p_room_id text` | `{ok, code, expires_at}`. 만든 사람의, 학습 짝이 없고 열린 학습방의 유효 코드. 없으면 `{ok:true, code:null}` (검증 후 보완 D2) | `failed`(로그인 없음) |
| `preview_invite` | `p_code text` | `{ok, owner_name, language}` | `invalid-format`, `not-found`, `expired`, `used`, `own-room`, `has-partner`, `too-many` |
| `accept_invite` | `p_code text` | `{ok, shared_room_id, owner_name, language, joined: true \| false}`. 이미 내 학습방이면 `joined:false` 로 그 학습방을 준다 | preview 와 같다 |
| `leave_shared_room` | `p_shared_room_id uuid` | `{ok, deleted}` | `not-member` |

- **코드 정규화**: 앞뒤 공백을 지우고 대문자로 바꾼다. 6자가 아니거나 허용 글자 밖이면 `invalid-format` 이다. `invalid-format` 은 시도 횟수에 세지 않는다.
- **시도 횟수**: `not-found`·`expired`·`used` 만 `invite_attempts` 에 남긴다. 10분에 10번이면 다른 검사보다 먼저 `too-many` 를 돌려준다.
- **동시성**: `accept_invite` 는 코드 행과 학습방 행을 `for update` 로 잠근다.
- **조회**: `shared_rooms` select 와 `voice_messages` select(`shared_room_id`, `created_at` 순, 500개)는 PostgREST 를 그대로 쓴다.
- **메시지 넣기**: `voice_messages` insert. 같은 id 가 이미 있으면(23505) 성공으로 본다.
- **Storage**: `voice-messages` 버킷의 `upload(path, blob, {contentType, upsert:false})`, `createSignedUrls(paths, 3600)`, `list(prefix)` + `remove(paths)`.
- **Realtime**: 채널 `partner:<uid>` 에서 `postgres_changes`. `INSERT public.voice_messages`, `UPDATE public.shared_rooms`.
