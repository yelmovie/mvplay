-- 0) extensions (필요 시)
create extension if not exists pgcrypto;

-- 1) 교사 프로필(최소 정보)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher','admin')),
  created_at timestamptz not null default now()
);

-- 2) 시대별 주제 목록 (관리자/시드 데이터)
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  era text not null,                 -- ex) '조선후기', '일제강점기'
  title text not null,               -- ex) '서희의 외교 담판'
  tags text[] not null default '{}', -- ex) {'사회','토의','외교'}
  created_at timestamptz not null default now()
);

-- 3) 생성된 대본 저장
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id),
  topic_title text not null,         -- topic_id가 없어도 저장 가능(추후 자유주제 대비)
  grade_band text not null default 'ALL',
  duration_min int not null check (duration_min between 3 and 20),
  group_size int not null check (group_size between 3 and 12),
  script_json jsonb not null,        -- LLM 결과(JSON)
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_topics_era on public.topics(era);
create index if not exists idx_scripts_created_by on public.scripts(created_by);

-- 4) RLS 활성화
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.scripts enable row level security;

-- 5) RLS 정책
-- profiles: 본인 조회/수정
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- topics: 인증된 교사는 읽기 가능(시대별 주제 카드)
create policy "topics_select_all_authenticated"
on public.topics
for select
to authenticated
using (true);

-- topics: 쓰기는 admin만(초기에는 서버/관리자가 seed)
create policy "topics_write_admin_only"
on public.topics
for all
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- scripts: 본인 것만 CRUD
create policy "scripts_select_own"
on public.scripts
for select
to authenticated
using (created_by = auth.uid());

create policy "scripts_insert_own"
on public.scripts
for insert
to authenticated
with check (created_by = auth.uid());

create policy "scripts_update_own"
on public.scripts
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "scripts_delete_own"
on public.scripts
for delete
to authenticated
using (created_by = auth.uid());
