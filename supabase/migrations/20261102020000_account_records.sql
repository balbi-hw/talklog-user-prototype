-- 010 계정 기록: 학습방·표현·복습 기록 (specs/010-account-records/data-model.md §2)
-- 모든 행은 주인(user_id)만 읽고 쓴다. id 는 클라이언트가 만든 문자열이며 사용자 안에서만 유일하다.

create table public.rooms (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  partner text not null check (char_length(partner) between 1 and 40),
  language text not null check (language in ('일본어', '영어', '중국어')),
  created_at_ms bigint not null check (created_at_ms >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.expressions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  term text not null check (char_length(term) between 1 and 2000),
  meaning text not null check (char_length(meaning) between 1 and 2000),
  example text not null check (char_length(example) <= 10000),
  source_room text not null check (char_length(source_room) <= 200),
  saved_at_ms bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 표현이 지워져도 복습 기록은 남을 수 있다 (클라이언트가 읽을 때 거른다). 보내는 순서에 묶이지 않도록 외래 키를 두지 않는다.
create table public.review_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expression_id text not null check (char_length(expression_id) between 1 and 100),
  due_date date not null,
  interval_days integer not null check (interval_days between 1 and 30),
  known_count integer not null check (known_count >= 0),
  answer_count integer not null check (answer_count >= 1 and answer_count >= known_count),
  updated_at timestamptz not null default now(),
  primary key (user_id, expression_id)
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();
create trigger expressions_touch before update on public.expressions
  for each row execute function public.touch_updated_at();
create trigger review_records_touch before update on public.review_records
  for each row execute function public.touch_updated_at();

alter table public.rooms enable row level security;
alter table public.expressions enable row level security;
alter table public.review_records enable row level security;

-- 로그인 사용자만, 자기 행만. 익명(anon)에는 아무 권한도 주지 않는다.
create policy "rooms: owner select" on public.rooms for select to authenticated using ((select auth.uid()) = user_id);
create policy "rooms: owner insert" on public.rooms for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "rooms: owner update" on public.rooms for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rooms: owner delete" on public.rooms for delete to authenticated using ((select auth.uid()) = user_id);

create policy "expressions: owner select" on public.expressions for select to authenticated using ((select auth.uid()) = user_id);
create policy "expressions: owner insert" on public.expressions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expressions: owner update" on public.expressions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expressions: owner delete" on public.expressions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "review_records: owner select" on public.review_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "review_records: owner insert" on public.review_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "review_records: owner update" on public.review_records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "review_records: owner delete" on public.review_records for delete to authenticated using ((select auth.uid()) = user_id);

-- Data API 설정에 따라 새 테이블이 자동으로 열리지 않을 수 있다. 로그인 사용자에게만 명시적으로 연다.
revoke all on public.rooms, public.expressions, public.review_records from anon;
grant select, insert, update, delete on public.rooms, public.expressions, public.review_records to authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
