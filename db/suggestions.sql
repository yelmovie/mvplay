-- suggestions table + RLS policies
-- Run this in Supabase SQL Editor.

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  category text null,
  page text null,
  ua text null,
  status text not null default 'new', -- new/triaged/done
  admin_note text null
);

alter table public.suggestions enable row level security;

-- Anyone (including anon) can INSERT.
drop policy if exists "suggestions_insert_public" on public.suggestions;
create policy "suggestions_insert_public"
on public.suggestions
for insert
to public
with check (true);

-- Block read/update/delete for public users (admin will use service role on server).
drop policy if exists "suggestions_no_select" on public.suggestions;
create policy "suggestions_no_select"
on public.suggestions
for select
to public
using (false);

drop policy if exists "suggestions_no_update" on public.suggestions;
create policy "suggestions_no_update"
on public.suggestions
for update
to public
using (false);

drop policy if exists "suggestions_no_delete" on public.suggestions;
create policy "suggestions_no_delete"
on public.suggestions
for delete
to public
using (false);





