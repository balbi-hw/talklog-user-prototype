-- 011 학습 짝 초대와 음성 메시지 주고받기 (specs/011-partner-messages/data-model.md §1, contracts/partner-server.md)
-- 함께 쓰는 학습방·초대 코드·실패한 코드 입력·음성 메시지. 학습방·코드는 함수로만 바꾸고, 클라이언트는 읽기와 메시지 넣기만 한다.

-- ───────────────────────── 테이블 ─────────────────────────

-- 한 행이 "만든 사람의 학습방 하나"에 대응한다 (research R1). 학습 짝 쪽 rooms.id 로 id 를 쓴다.
create table public.shared_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_room_id text not null check (char_length(owner_room_id) between 1 and 100),
  language text not null check (language in ('일본어', '영어', '중국어')),
  owner_name text not null check (char_length(owner_name) between 1 and 20),
  -- 한 번 정해지면 함수가 바꾸지 않는다. 학습 짝 계정이 지워지면 비운다 (만든 사람의 학습방은 남긴다).
  partner_id uuid references auth.users (id) on delete set null check (partner_id <> owner_id),
  partner_name text check (char_length(partner_name) between 1 and 20),
  owner_left_at timestamptz,
  partner_left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, owner_room_id)
);

create index shared_rooms_partner_idx on public.shared_rooms (partner_id);

create table public.invite_codes (
  code text primary key check (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),
  shared_room_id uuid not null references public.shared_rooms (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 학습방당 유효(쓰이지도 취소되지도 않은) 코드는 최대 1개다. 만료된 코드는 create_invite 가 취소한 뒤 새로 만든다.
create unique index invite_codes_one_active_idx on public.invite_codes (shared_room_id)
  where used_at is null and revoked_at is null;

-- 실패한 코드 입력 (research R3). 10분 안에 10번이면 막는다.
create table public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);

create index invite_attempts_user_at_idx on public.invite_attempts (user_id, at);

-- id 는 클라이언트가 만든다 (다시 보내도 같다, research R5).
create table public.voice_messages (
  id uuid primary key,
  shared_room_id uuid not null references public.shared_rooms (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  duration_ms integer not null check (duration_ms between 1 and 61000),
  storage_path text not null,
  mime_type text not null check (mime_type in ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg')),
  created_at timestamptz not null default now(),
  check (storage_path = shared_room_id::text || '/' || sender_id::text || '/' || id::text)
);

create index voice_messages_room_created_idx on public.voice_messages (shared_room_id, created_at);

-- ───────────────────────── 보조 함수 ─────────────────────────

-- 학습방 멤버인가 (만든 사람이거나 학습 짝). RLS·Storage 정책에서 쓴다. 나간 사람도 행이 남아 있는 동안은 멤버다.
create or replace function public.is_shared_room_member(p_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_rooms r
    where r.id = p_id
      and (select auth.uid()) is not null
      and (r.owner_id = (select auth.uid()) or r.partner_id = (select auth.uid()))
  );
$$;

-- 학습방이 닫히지 않았는가 (아무도 나가지 않음). 닫힌 학습방에는 보낼 수 없다.
create or replace function public.is_shared_room_open(p_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_rooms r
    where r.id = p_id and r.owner_left_at is null and r.partner_left_at is null
  );
$$;

-- Storage 경로의 폴더 이름을 uuid 로. 형식이 틀리면 오류 대신 null 을 돌려준다 (정책이 예외를 내지 않도록).
create or replace function public.try_uuid(p_text text) returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_text::uuid
    else null
  end;
$$;

-- 표시 이름: JWT 의 display_name 을 trim 해 20자로, 없으면 이메일 앞부분, 그것도 없으면 '학습자' (009 toAccountUser 와 같은 규칙).
-- 클라이언트가 보낸 이름은 믿지 않는다 (research R2).
create or replace function public.partner_display_name() returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(left(btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', '')), 20));
  if v_name = '' then
    v_name := btrim(left(btrim(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)), 20));
  end if;
  if v_name = '' then
    v_name := '학습자';
  end if;
  return v_name;
end;
$$;

-- 31자(0·O·1·I·L 제외)에서 6자. 256 을 31 로 나눈 나머지 쏠림을 피하려고 248 이상인 바이트는 버린다.
create or replace function public.new_invite_code() returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text := '';
  v_bytes bytea;
  v_byte integer;
  i integer;
begin
  while char_length(v_code) < 6 loop
    v_bytes := extensions.gen_random_bytes(12);
    for i in 0 .. 11 loop
      v_byte := get_byte(v_bytes, i);
      if v_byte < 248 and char_length(v_code) < 6 then
        v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
      end if;
    end loop;
  end loop;
  return v_code;
end;
$$;

-- 코드 검사 (preview_invite·accept_invite 공통). 실패는 예외가 아닌 {ok:false, reason} 이라 시도 기록이 남는다 (research R2).
-- 순서: too-many → invalid-format → not-found(없음·취소됨) → own-room → 이미 내 학습방(ok, already) → used → expired → has-partner.
-- 닫힌 학습방(누군가 나감)은 has-partner 로 돌려준다. 닫힌 학습방에는 언제나 학습 짝이 있었기 때문이다
-- (학습 짝 없이 만든 사람이 나가면 학습방이 지워지므로 그 코드는 not-found 가 된다).
-- p_lock 이면 코드 행과 학습방 행을 for update 로 잠근다 (accept_invite).
create or replace function public.check_invite(p_code text, p_lock boolean) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_invite public.invite_codes%rowtype;
  v_room public.shared_rooms%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'failed');
  end if;

  if (select count(*) from public.invite_attempts a
      where a.user_id = v_uid and a.at > now() - interval '10 minutes') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too-many');
  end if;

  v_code := upper(btrim(coalesce(p_code, '')));
  if v_code !~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid-format');
  end if;

  if p_lock then
    select * into v_invite from public.invite_codes c where c.code = v_code for update;
  else
    select * into v_invite from public.invite_codes c where c.code = v_code;
  end if;

  if not found or v_invite.revoked_at is not null then
    insert into public.invite_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'not-found');
  end if;

  if p_lock then
    select * into v_room from public.shared_rooms r where r.id = v_invite.shared_room_id for update;
  else
    select * into v_room from public.shared_rooms r where r.id = v_invite.shared_room_id;
  end if;

  if not found then
    insert into public.invite_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'not-found');
  end if;

  if v_room.owner_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'own-room');
  end if;

  if v_room.partner_id = v_uid and v_room.owner_left_at is null and v_room.partner_left_at is null then
    return jsonb_build_object('ok', true, 'already', true, 'shared_room_id', v_room.id,
      'owner_name', v_room.owner_name, 'language', v_room.language);
  end if;

  if v_invite.used_at is not null then
    insert into public.invite_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  if v_invite.expires_at <= now() then
    insert into public.invite_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_room.partner_id is not null or v_room.owner_left_at is not null or v_room.partner_left_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'has-partner');
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'shared_room_id', v_room.id,
    'owner_name', v_room.owner_name, 'language', v_room.language, 'code', v_invite.code);
end;
$$;

-- ───────────────────────── RPC ─────────────────────────

-- 만든 사람의 학습방 공유 정보를 만들거나 그대로 돌려준다. 010 rooms 를 참조하지 않고 학습 언어를 인자로 받는다 (research R7).
-- 학습 짝이 자기 rooms.id(= shared_rooms.id)로 부르면 새로 만들지 않고 그 학습방을 돌려준다.
create or replace function public.ensure_shared_room(p_room_id text, p_language text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.shared_rooms%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'failed');
  end if;
  if p_room_id is null or char_length(p_room_id) not between 1 and 100
     or p_language is null or p_language not in ('일본어', '영어', '중국어') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_room from public.shared_rooms r
  where r.partner_id = v_uid and r.id = public.try_uuid(p_room_id);

  if not found then
    insert into public.shared_rooms (owner_id, owner_room_id, language, owner_name)
    values (v_uid, p_room_id, p_language, public.partner_display_name())
    on conflict (owner_id, owner_room_id) do nothing;

    select * into v_room from public.shared_rooms r
    where r.owner_id = v_uid and r.owner_room_id = p_room_id;
  end if;

  if v_room.owner_left_at is not null or v_room.partner_left_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  return jsonb_build_object('ok', true, 'shared_room_id', v_room.id);
end;
$$;

-- 초대 코드를 만든다. 공유 정보가 없으면 만들고, 이전 유효 코드(만료된 것 포함)는 취소한다. 24시간 유효.
create or replace function public.create_invite(p_room_id text, p_language text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ensured jsonb;
  v_room public.shared_rooms%rowtype;
  v_code text;
  v_expires timestamptz := now() + interval '24 hours';
  v_try integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'failed');
  end if;
  if p_room_id is null or char_length(p_room_id) not between 1 and 100
     or p_language is null or p_language not in ('일본어', '영어', '중국어') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- 학습 짝은 초대할 수 없다.
  if exists (select 1 from public.shared_rooms r
             where r.partner_id = v_uid and r.id = public.try_uuid(p_room_id)) then
    return jsonb_build_object('ok', false, 'reason', 'has-partner');
  end if;

  v_ensured := public.ensure_shared_room(p_room_id, p_language);
  if not (v_ensured ->> 'ok')::boolean then
    return v_ensured;
  end if;

  -- 같은 학습방에 동시에 코드를 만들지 않도록 잠근다.
  select * into v_room from public.shared_rooms r
  where r.id = (v_ensured ->> 'shared_room_id')::uuid
  for update;

  if v_room.owner_left_at is not null or v_room.partner_left_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_room.partner_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'has-partner');
  end if;

  update public.invite_codes c set revoked_at = now()
  where c.shared_room_id = v_room.id and c.used_at is null and c.revoked_at is null;

  loop
    v_try := v_try + 1;
    v_code := public.new_invite_code();
    exit when not exists (select 1 from public.invite_codes c where c.code = v_code);
    if v_try >= 20 then
      return jsonb_build_object('ok', false, 'reason', 'failed');
    end if;
  end loop;

  insert into public.invite_codes (code, shared_room_id, expires_at)
  values (v_code, v_room.id, v_expires);

  return jsonb_build_object('ok', true, 'code', v_code, 'expires_at', v_expires);
end;
$$;

-- 내 학습방의 유효 코드를 취소한다. 공유 정보나 코드가 없어도 성공이다.
create or replace function public.revoke_invite(p_room_id text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'failed');
  end if;

  update public.invite_codes c set revoked_at = now()
  where c.used_at is null and c.revoked_at is null
    and c.shared_room_id in (
      select r.id from public.shared_rooms r
      where r.owner_id = v_uid and r.owner_room_id = p_room_id
    );

  return jsonb_build_object('ok', true);
end;
$$;

-- 내 학습방의 유효 코드를 돌려준다 (검증 후 보완 D2). 새로고침·다른 기기에서도 코드를 다시 보고 취소할 수 있다.
-- 만든 사람만 볼 수 있다. 코드가 없거나 학습방이 닫혔으면 code 가 null 이다.
create or replace function public.current_invite(p_room_id text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.invite_codes%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'failed');
  end if;

  select c.* into v_code
  from public.invite_codes c
  join public.shared_rooms r on r.id = c.shared_room_id
  where r.owner_id = v_uid and r.owner_room_id = p_room_id
    and r.partner_id is null and r.owner_left_at is null and r.partner_left_at is null
    and c.used_at is null and c.revoked_at is null and c.expires_at > now()
  order by c.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'code', null);
  end if;
  return jsonb_build_object('ok', true, 'code', v_code.code, 'expires_at', v_code.expires_at);
end;
$$;

-- 들어가기 전 확인: 만든 사람 표시 이름과 학습 언어. 코드를 쓰지 않는다.
create or replace function public.preview_invite(p_code text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_check jsonb;
begin
  v_check := public.check_invite(p_code, false);
  if not (v_check ->> 'ok')::boolean then
    return v_check;
  end if;
  return jsonb_build_object('ok', true, 'owner_name', v_check ->> 'owner_name', 'language', v_check ->> 'language');
end;
$$;

-- 코드로 들어간다. 코드 행과 학습방 행을 for update 로 잠가 같은 코드로는 한 명만 들어온다.
-- 이미 내 학습방(내가 학습 짝)이면 joined:false 로 그 학습방을 준다.
create or replace function public.accept_invite(p_code text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_check jsonb;
  v_room_id uuid;
begin
  v_check := public.check_invite(p_code, true);
  if not (v_check ->> 'ok')::boolean then
    return v_check;
  end if;

  v_room_id := (v_check ->> 'shared_room_id')::uuid;

  if (v_check ->> 'already')::boolean then
    return jsonb_build_object('ok', true, 'shared_room_id', v_room_id,
      'owner_name', v_check ->> 'owner_name', 'language', v_check ->> 'language', 'joined', false);
  end if;

  update public.invite_codes c set used_at = now() where c.code = v_check ->> 'code';
  update public.shared_rooms r
  set partner_id = v_uid, partner_name = public.partner_display_name()
  where r.id = v_room_id;

  return jsonb_build_object('ok', true, 'shared_room_id', v_room_id,
    'owner_name', v_check ->> 'owner_name', 'language', v_check ->> 'language', 'joined', true);
end;
$$;

-- 나가기 (research R8). 내 나간 시각을 남기고, 둘 다 나갔거나 학습 짝 없이 만든 사람이 나가면 학습방을 지운다
-- (메시지·코드는 cascade). Storage 객체는 SQL 로 지울 수 없어 클라이언트가 먼저 지운다 (research R4).
create or replace function public.leave_shared_room(p_shared_room_id uuid) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.shared_rooms%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'failed');
  end if;

  select * into v_room from public.shared_rooms r
  where r.id = p_shared_room_id and (r.owner_id = v_uid or r.partner_id = v_uid)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not-member');
  end if;

  if v_room.owner_id = v_uid then
    if v_room.partner_id is null or v_room.partner_left_at is not null then
      delete from public.shared_rooms r where r.id = v_room.id;
      return jsonb_build_object('ok', true, 'deleted', true);
    end if;
    update public.shared_rooms r set owner_left_at = coalesce(r.owner_left_at, now()) where r.id = v_room.id;
    update public.invite_codes c set revoked_at = now()
    where c.shared_room_id = v_room.id and c.used_at is null and c.revoked_at is null;
  else
    if v_room.owner_left_at is not null then
      delete from public.shared_rooms r where r.id = v_room.id;
      return jsonb_build_object('ok', true, 'deleted', true);
    end if;
    update public.shared_rooms r set partner_left_at = coalesce(r.partner_left_at, now()) where r.id = v_room.id;
  end if;

  return jsonb_build_object('ok', true, 'deleted', false);
end;
$$;

-- ───────────────────────── RLS ─────────────────────────

alter table public.shared_rooms enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.voice_messages enable row level security;

-- 학습방은 멤버만 읽는다. 쓰기 정책은 없다 (함수로만 바꾼다).
create policy "shared_rooms: member select" on public.shared_rooms for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = partner_id);

-- 메시지는 멤버만 읽고, 멤버가 열린 학습방에 자기 이름으로만 넣는다. 보낸 뒤 고치거나 지우지 않는다 (update·delete 정책 없음).
create policy "voice_messages: member select" on public.voice_messages for select to authenticated
  using (public.is_shared_room_member(shared_room_id));
create policy "voice_messages: member insert" on public.voice_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_shared_room_member(shared_room_id)
    and public.is_shared_room_open(shared_room_id)
    and storage_path = shared_room_id::text || '/' || sender_id::text || '/' || id::text
  );

-- invite_codes·invite_attempts: RLS on, 정책 없음 (함수로만 다룬다).

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-messages', 'voice-messages', false, 5242880,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'])
on conflict (id) do nothing;

-- 경로 <shared_room_id>/<sender_id>/<message_id>. 첫 폴더가 uuid 가 아니면 try_uuid 가 null 이라 멤버가 아니다.
create policy "voice-messages: member select" on storage.objects for select to authenticated
  using (
    bucket_id = 'voice-messages'
    and public.is_shared_room_member(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "voice-messages: member insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-messages'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_shared_room_member(public.try_uuid((storage.foldername(name))[1]))
    and public.is_shared_room_open(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "voice-messages: member delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'voice-messages'
    and public.is_shared_room_member(public.try_uuid((storage.foldername(name))[1]))
  );

-- ───────────────────────── Realtime ─────────────────────────

alter publication supabase_realtime add table public.voice_messages, public.shared_rooms;

-- ───────────────────────── 권한 ─────────────────────────

-- Supabase 기본 권한이 새 테이블·함수를 anon·authenticated 에 열 수 있어 먼저 모두 거둔 뒤 필요한 것만 연다.
revoke all on public.shared_rooms, public.invite_codes, public.invite_attempts, public.voice_messages
  from public, anon, authenticated;
grant select on public.shared_rooms to authenticated;
-- created_at 은 서버 시각만 쓰도록 넣을 수 있는 열을 정한다 (정렬 기준을 클라이언트가 바꾸지 못하게).
grant select on public.voice_messages to authenticated;
grant insert (id, shared_room_id, sender_id, duration_ms, storage_path, mime_type)
  on public.voice_messages to authenticated;

revoke execute on function
  public.is_shared_room_member(uuid),
  public.is_shared_room_open(uuid),
  public.try_uuid(text),
  public.partner_display_name(),
  public.new_invite_code(),
  public.check_invite(text, boolean),
  public.ensure_shared_room(text, text),
  public.create_invite(text, text),
  public.revoke_invite(text),
  public.current_invite(text),
  public.preview_invite(text),
  public.accept_invite(text),
  public.leave_shared_room(uuid)
  from public, anon, authenticated;

-- RPC 7개와 정책에서 쓰는 판정 함수만 로그인 사용자에게 연다. 내부 함수(이름·코드 만들기·코드 검사)는 열지 않는다.
grant execute on function
  public.is_shared_room_member(uuid),
  public.is_shared_room_open(uuid),
  public.try_uuid(text),
  public.ensure_shared_room(text, text),
  public.create_invite(text, text),
  public.revoke_invite(text),
  public.current_invite(text),
  public.preview_invite(text),
  public.accept_invite(text),
  public.leave_shared_room(uuid)
  to authenticated;
