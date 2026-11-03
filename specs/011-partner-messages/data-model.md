# Data Model: 학습 짝 초대와 음성 메시지 주고받기

## 1. 서버 (마이그레이션 `supabase/migrations/20261103010000_partner_messages.sql`)

### shared_rooms — 함께 쓰는 학습방
| 열 | 형 | 규칙 |
| --- | --- | --- |
| id | uuid pk | `gen_random_uuid()`. 학습 짝 쪽 `rooms.id` 로도 쓴다 |
| owner_id | uuid | `auth.users` 참조, cascade |
| owner_room_id | text | 만든 사람의 010 `rooms.id`. 1~100자. `(owner_id, owner_room_id)` 유일 |
| language | text | `일본어`·`영어`·`중국어` |
| owner_name | text | 1~20자. 함수가 JWT 에서 채운다 |
| partner_id | uuid null | 한 번 정해지면 바뀌지 않는다. `owner_id` 와 달라야 한다 |
| partner_name | text null | `partner_id` 와 함께 채워진다 |
| owner_left_at · partner_left_at | timestamptz null | 나간 시각 |
| created_at | timestamptz | `now()` |

- 상태: **열림**(학습 짝 없음) → **함께**(학습 짝 있음) → **닫힘**(한 명이 나감) → 삭제(둘 다 나감, 또는 학습 짝 없이 만든 사람이 나감).
- 닫힌 학습방에는 보낼 수 없고 초대할 수 없다.
- RLS select: `owner_id = uid` 이거나 `partner_id = uid`. 쓰기 정책은 없다(함수로만 바꾼다).

### invite_codes — 초대 코드
| 열 | 형 | 규칙 |
| --- | --- | --- |
| code | text pk | 6자, `23456789ABCDEFGHJKMNPQRSTUVWXYZ` |
| shared_room_id | uuid | cascade |
| expires_at | timestamptz | 만든 시각 + 24시간 |
| used_at · revoked_at | timestamptz null | |

- 유효 = `used_at`·`revoked_at` 이 없고 `expires_at > now()`. 학습방당 유효 코드는 최대 1개다(부분 유일 인덱스).
- RLS on, 정책 없음. 클라이언트 권한 없음.

### invite_attempts — 실패한 코드 입력
`user_id`, `at`. 10분 안에 10개면 막는다. RLS on, 정책 없음.

### voice_messages — 음성 메시지
| 열 | 형 | 규칙 |
| --- | --- | --- |
| id | uuid pk | 클라이언트가 만든다(다시 보내도 같다) |
| shared_room_id | uuid | cascade |
| sender_id | uuid | 기본값 `auth.uid()` |
| duration_ms | integer | 1~61000 |
| storage_path | text | `<shared_room_id>/<sender_id>/<id>` 와 같아야 한다 |
| mime_type | text | 허용 4종 |
| created_at | timestamptz | `now()`. 정렬 기준 |

- RLS select: 학습방 멤버.
- RLS insert: `sender_id = uid`, 멤버, 학습방이 닫히지 않음, 경로가 규칙과 같음.
- update·delete 정책 없음(보낸 뒤 고치거나 지우지 않는다).

### Storage 버킷 `voice-messages`
- 비공개, 5MB, 허용 형식 4종.
- 정책은 research R4 와 같다. 멤버 판정은 `public.is_shared_room_member(uuid)`(security definer, stable)로 한다.

### Realtime
- `voice_messages`, `shared_rooms` 를 `supabase_realtime` publication 에 넣는다.

## 2. 클라이언트 (메모리 상태, `app/lib/partner.ts`)

```ts
type SharedRoom = {
  id: string; role: "owner" | "partner"; roomId: string;   // roomId = 내 rooms.id
  language: RoomLanguage; partnerName: string | null;       // 내 기준 상대 표시 이름
  closed: boolean; partnerLeft: boolean;                    // closed = 누군가 나감
};
type InviteState =
  | { status: "none" } | { status: "creating" }
  | { status: "active"; code: string; expiresAt: number }
  | { status: "failed"; reason: InviteFailure };
type JoinFailure = "invalid-format" | "not-found" | "expired" | "used" | "own-room"
  | "has-partner" | "too-many" | "network" | "timeout" | "failed";
type Delivery = "sent" | "sending" | "failed";
type ConnectionState = "connecting" | "live" | "lost";
```

- `VoiceMessage` 에 `delivery?: Delivery` 를 더한다. 없으면 `"sent"` 다. 서버 메시지는 `source: "recorded"`, `url` 은 서명 주소, `sender` 는 `sender_id === 내 id ? "me" : "partner"`, `sentAtLabel` 은 `created_at` 의 시:분이다.
- **합치기**: 서버 메시지 id → 하나. 보내는 중인 메시지가 서버에 도착하면(같은 id) 서버 메시지로 바뀐다. 정렬은 `created_at` 순, 보내는 중인 메시지는 끝에 붙인다.
- **소리 보관**: 보내는 중·실패 메시지는 녹음의 blob 주소를 쓴다. 성공하면 서명 주소로 바꾸지 않고 그 화면 동안 blob 주소를 그대로 쓴다. 학습방을 지우거나 사용자가 바뀌면 revoke 한다.

## 3. 010 과의 연결

- 학습 짝 쪽 `rooms` 행: `{ id: shared.id, partner: owner_name, language, createdAt: 들어온 시각 }`. 010 의 쓰기 경로로 만든다.
- 화면의 학습방 이름: `partnerName ?? room.partner`.
- 공유 정보가 있는 학습방의 삭제는 R8 의 나가기다.
