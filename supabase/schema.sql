create table if not exists public.app_state (
  id text primary key,
  owner_uid uuid not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_read_all" on public.app_state;
create policy "app_state_read_all"
on public.app_state
for select
to public
using (true);

drop policy if exists "app_state_owner_insert" on public.app_state;
create policy "app_state_owner_insert"
on public.app_state
for insert
to authenticated
with check (auth.uid() = owner_uid);

drop policy if exists "app_state_owner_update" on public.app_state;
create policy "app_state_owner_update"
on public.app_state
for update
to authenticated
using (auth.uid() = owner_uid)
with check (auth.uid() = owner_uid);

drop policy if exists "app_state_owner_delete" on public.app_state;
create policy "app_state_owner_delete"
on public.app_state
for delete
to authenticated
using (auth.uid() = owner_uid);

-- No default row is inserted here.
-- The first owner save should insert id='primary' with owner_uid=auth.uid().
