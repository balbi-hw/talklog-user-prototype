# Tasks: 학습 짝 초대와 음성 메시지 주고받기

설계: [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md). 자동화 테스트 작성은 요구하지 않는다(헌법). 확인은 quickstart 항목으로 한다.

## Phase 1: Setup
- [X] T001 사용자 결정(초대 코드, 앱 안 알림만, 011/012 분리)을 반영해 specs/011-partner-messages/ 명세·설계·계약을 쓰고 docs/domain-model.md §4 에 "초대 코드(`inviteCode`)"를 더한다.

## Phase 2: Foundation (모든 이야기의 선행)
- [X] T002 [P] supabase/migrations/20261103010000_partner_messages.sql 을 data-model.md §1 그대로 작성한다.
  - 테이블 `shared_rooms`·`invite_codes`·`invite_attempts`·`voice_messages`. 열 check 를 그대로 둔다: `owner_room_id` 1~100자, `language in ('일본어','영어','중국어')`, `owner_name`·`partner_name` 1~20자, `partner_id <> owner_id`, `duration_ms between 1 and 61000`, `mime_type in ('audio/webm','audio/mp4','audio/ogg','audio/mpeg')`, `storage_path = shared_room_id || '/' || sender_id || '/' || id`.
  - `unique (owner_id, owner_room_id)`. `invite_codes` 에는 `used_at is null and revoked_at is null` 부분 유일 인덱스(`shared_room_id`). `voice_messages (shared_room_id, created_at)` 인덱스.
  - 함수 `is_shared_room_member(uuid)` 와 contracts/partner-server.md 의 6개. 모두 `security definer`, `set search_path = ''`, `jsonb` 반환이고 실패는 예외가 아닌 `{ok:false, reason}` 이다. 코드 생성은 `extensions.gen_random_bytes` 와 31자 목록으로 하고 충돌하면 다시 만든다. 표시 이름은 `auth.jwt()->'user_metadata'->>'display_name'` 을 trim 해 20자로 자르고, 없으면 이메일 앞부분이다. `accept_invite` 는 `for update` 로 잠근다.
  - RLS: 4테이블 on. `shared_rooms`·`voice_messages` select 는 멤버만. `voice_messages` insert 는 `sender_id = (select auth.uid())`, 멤버, 학습방이 닫히지 않음.
  - Storage: 버킷 `voice-messages`(비공개, `file_size_limit` 5242880, 허용 형식 4종)를 insert … on conflict do nothing. `storage.objects` 정책 select·insert·delete(버킷 한정, `(storage.foldername(name))[1]::uuid` 멤버, insert 는 `[2] = auth.uid()::text` 이고 학습방이 열려 있을 때).
  - `alter publication supabase_realtime add table public.voice_messages, public.shared_rooms`.
  - 권한: anon 은 모두 revoke. authenticated 에는 `shared_rooms` select, `voice_messages` select·insert, 함수 execute 만 grant. `invite_codes`·`invite_attempts` 권한은 없다. 함수는 `public` 에서 execute 를 revoke 한다.
- [X] T003 [P] app/lib/partner.ts 에 data-model.md §2 의 타입을 둔다.
  - `normalizeInviteCode`·`isInviteCode`(6자, 허용 31자).
  - 실패 문구 `JOIN_FAILURE_MESSAGE`(10개 이유별)·`INVITE_FAILURE_MESSAGE`.
  - 서버 행 → `VoiceMessage` 변환(`sender`, `sentAtLabel` 시:분, `source:"recorded"`).
  - `mergeMessages`(id 로 하나, `created_at` 순, 보내는 중인 메시지는 끝).
  - app/lib/types.ts 의 `VoiceMessage` 에 `delivery?: "sent" | "sending" | "failed"` 를 더한다.
- [X] T004 app/lib/partner-client.ts 에 contracts/partner-server.md 의 호출을 둔다.
  - rpc 6개, `shared_rooms` 조회, 학습방별 메시지 조회(500개), 메시지 넣기(23505 는 성공), 올리기(409·Duplicate 는 성공), `createSignedUrls(paths, 3600)`, 폴더 지우기, 채널 열기·닫기.
  - 시간 상한은 15초, 올리기는 30초다. 오프라인은 `network`, 시간 초과는 `timeout` 으로 돌려준다.
  - `createClient()` 가 null 이면 모두 비활성이다. 010 의 `app/lib/record-sync.ts` 시간 상한 방식을 따른다.
- [X] T005 app/hooks/usePartnerRooms.ts 의 뼈대를 만든다.
  - `enabled` 판정(로그인 + 010 범위가 account 이고 loaded + 클라이언트 있음), 공유 정보 받아 오기(`status`), 사용자 바뀜 때 초기화(contracts 조항 6), `retry`, `shared(roomId)`.
  - app/page.tsx 에서 한 번 만들고 학습방 이름을 `shared(roomId)?.partnerName ?? room.partner` 로 바꾼다.

## Phase 3: US1 (P1) 초대 코드로 들이기
독립 확인: quickstart P1~P5, P18 일부.
- [X] T006 [US1] app/hooks/usePartnerRooms.ts 에 `invite.state/create/revoke`, `preview`, `join` 을 구현한다.
  - `join` 이 성공하고 `joined:true` 이면 010 쓰기 경로(`useRooms` 의 쓰기 또는 `app/lib/rooms.ts`)로 `rooms` 행 `{id: shared_room_id, partner: owner_name, language, createdAt: Date.now()}` 을 만든다.
  - 공유 정보를 받을 때 research R1 의 복구 규칙(학습 짝 역할이고 나가지 않았는데 `rooms` 행이 없으면 만든다)을 적용한다.
- [X] T007 [P] [US1] app/components/RoomInvite.tsx 를 만든다. 학습방 머리 아래에 둔다.
  - 상태: 로그인 안내(로그아웃·키 없음) / 받아 오는 중 / 초대 코드 만들기 / 코드·남은 시간·복사·취소·새로 만들기 / 학습 짝 표시 이름 / 실패 문구와 다시 시도.
  - 예시 학습방과 학습 짝 쪽(역할 partner)에서는 초대 버튼이 없다.
  - 복사 결과는 `role="status"`.
- [X] T008 [P] [US1] app/components/InviteJoin.tsx 를 만든다.
  - 학습방 목록의 "초대 코드 입력" 버튼 → 입력란(`autocomplete="off"`, 대문자 표시) → `preview` → 확인 대화상자(만든 사람 이름·학습 언어, 들어가기·취소, 포커스 이동·Escape·돌아갈 포커스) → `join` → 학습방 열기.
  - 이유별 문구를 보이고, 로그아웃 상태면 로그인 안내를 보인다.
- [X] T009 [US1] app/components/RoomList.tsx 와 app/page.tsx 에 T007·T008 을 연결하고 app/globals.css 에 시맨틱 클래스(`room-invite`, `invite-code`, `invite-join`)를 더한다. 색은 `:root` 변수만 쓴다.

## Phase 4: US2 (P1) 보내기
독립 확인: P6, P8, P9, P11, P19.
- [X] T010 [US2] app/hooks/usePartnerRooms.ts 에 `messages`, `messagesStatus`, `openRoom`, `send`, `resend`, `discard`, `hasSending` 을 구현한다.
  - research R5 순서: id 먼저 → `fetch(recording.url).blob()` 올리기 → 행 넣기. 처음 보낼 때는 `ensure_shared_room` 을 부른다. 닫힌 학습방이면 보내지 않는다.
  - 보낸 내 메시지는 그 화면 동안 녹음의 blob 주소를 쓴다(data-model §2). 학습방을 지우거나 사용자가 바뀌면 revoke 한다.
- [X] T011 [US2] app/page.tsx 의 학습방에서 `partner.messages(roomId)` 가 null 이 아니면 그것을 쓰고, 아니면 지금의 `messagesByRoom` 을 쓴다.
  - `addRecordedMessage` 는 서버 경로일 때 `partner.send` 를 부른다.
  - 학습방을 열 때 `openRoom` 을 부른다. `messagesStatus` 가 `loading` 이면 빈 상태 안내 대신 받아 오는 중, `error` 면 실패 문구와 다시 시도를 보인다.
  - 홈·목록의 메시지 수·마지막 시각(`overviews`)도 같은 원천을 쓴다.
  - 떠나기 확인(001 `pendingRef`)에 `hasSending` 을 더한다.
- [X] T012 [P] [US2] app/components/VoiceBubble.tsx 에 `delivery` 표시를 더한다. 보내는 중 `role="status"`, 실패 시 "보내지 못했어요"와 다시 보내기·지우기(각 `aria-label`) 버튼을 두고, 보낸 시각은 `sent` 일 때만 보인다.

## Phase 5: US3 (P1) 받아 듣고 이해하기
독립 확인: P6, P7, P10.
- [X] T013 [US3] app/hooks/usePartnerRooms.ts 에 Realtime 채널(`partner:<uid>`, `voice_messages` INSERT·`shared_rooms` UPDATE)과 `connection` 상태를 둔다.
  - `SUBSCRIBED`·`online`·`focus` 때 열린 학습방 메시지를 다시 받는다. `lost` 면 15초 뒤 다시 연결한다.
  - 받은 행은 서명 주소를 받아 합친다(조항 5). 서명 주소가 50분 지났으면 갱신한다.
- [X] T014 [US3] app/page.tsx 의 학습 짝 메시지 렌더를 고친다.
  - 서버 메시지(`source:"recorded"`, `sender:"partner"`)는 VoiceBubble 재생과 `MessageUnderstanding`(스크립트·번역·표현 저장, 다듬기 없음)을 쓴다. 지금의 예시 학습 짝 메시지 블록은 `source:"mock"` 일 때만 쓴다.
  - 재생 실패 시 다시 시도를 둔다(001 `useVoicePlayback` 오류 상태 활용).
- [X] T015 [US3] app/page.tsx 학습방에 연결 안내를 둔다. `connection === "lost"` 면 "새 메시지를 바로 받지 못하고 있어요"와 다시 시도(`role="status"`)를 보인다. 재생·녹음은 막지 않는다.

## Phase 6: US5 (P1) 로그인 없이·예시 학습방
독립 확인: P15, P16, P17.
- [X] T016 [US5] app/components/AccountScreen.tsx 의 `SIGNED_IN_NOTICE` 를 "로그인한 동안 학습방·표현·카드·복습 기록과 학습 짝과 주고받은 음성 메시지는 계정에 저장돼요."로 바꾸고, 주석을 고친다(FR-015).
- [X] T017 [US5] 키 없는 build 와 로그아웃 상태에서 `enabled` 가 false 이고, 초대 자리가 로그인 안내이며, 외부 요청이 없는지 확인한다. 로그아웃 때 채널이 닫히고 localStorage 에 새 키가 없는지 확인한다.

## Phase 7: US4 (P2) 나가기
독립 확인: P12~P14.
- [X] T018 [US4] app/hooks/usePartnerRooms.ts 에 `leave` 를 research R8 순서대로 구현한다.
  - 마지막 사람이면 폴더를 지우고 `leave_shared_room` 을 부른다.
  - 성공하면 `{ok:true}` 를 돌려주고, 실패하면 이유를 돌려준다.
- [X] T019 [US4] app/page.tsx 의 `removeRoom` 과 app/components/RoomList.tsx 의 삭제 확인을 고친다.
  - 공유 정보가 있으면 확인 문구를 "나가면 이 학습방의 메시지를 더 볼 수 없어요"로 바꾸고, `leave` 성공 뒤 `rooms.remove` 를 부른다. 실패하면 이유를 보이고 지우지 않는다.
  - 닫힌 학습방은 녹음 영역 대신 "학습 짝이 나갔어요" 안내를 보이고 초대를 숨긴다.

## Phase 8: Polish
- [X] T020 README.md "현재 구현 범위"에서 학습 짝 초대·수신을 미구현 목록에서 빼고, docs/product-plan.md 흐름 표 4·5·6·9 와 로드맵(011 구현, 012 남음), docs/domain-model.md 서브도메인 상태를 맞춘다.
- [X] T021 `npm run build` 를 키 있음·없음 둘 다 성공시키고 TypeScript 오류 0 을 확인한다. `tests/refinement.cjs` 도 통과시킨다.
- [X] T022 quickstart 자동 항목 P1~P19 를 가짜 서버(page.route + routeWebSocket, 두 문맥)로 실행한다.
- [X] T023 마이그레이션을 실제 프로젝트에 적용하고 R1~R5 를 확인한다(사용자 적용·계정 필요).

## Dependencies
- T002·T003 → T004 → T005 → 각 이야기.
- US1(T006~T009)과 US2(T010~T012)는 T005 뒤 병렬로 할 수 있다. 단 `usePartnerRooms.ts`·`page.tsx` 를 함께 고치므로 같은 사람이 이어서 하거나 순서대로 병합한다.
- US3 은 US2 의 `messages` 위에 선다. US4 는 US1 의 공유 정보 위에 선다. US5 는 어느 때든 된다.
- Polish 는 마지막이다.

## Parallel Examples
- Foundation: T002(SQL) ∥ T003(순수 함수).
- US1: T007(RoomInvite) ∥ T008(InviteJoin) — T006 의 훅 계약만 맞추면 된다.
- US2: T012(VoiceBubble) ∥ T010(훅).

## Implementation Strategy
- MVP: Foundation + US1 + US2 + US3. 초대하고 주고받는 것이 이 기능의 주장이다.
- 그다음 US5 확인과 US4 나가기, 마지막으로 Polish.
