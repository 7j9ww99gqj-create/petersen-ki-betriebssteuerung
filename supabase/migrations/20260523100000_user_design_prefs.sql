-- DP12 — Multi-Device-Sync für Design-Prefs
-- Speichert das User-Design-Pref-JSON pro User → Cross-Device-Sync.
-- Lokales localStorage bleibt primärer Cache (Offline-Fähigkeit).

create table if not exists public.user_design_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_design_prefs enable row level security;

-- Policies
drop policy if exists "user_design_prefs_select_own" on public.user_design_prefs;
create policy "user_design_prefs_select_own"
  on public.user_design_prefs for select
  using (auth.uid() = user_id);

drop policy if exists "user_design_prefs_insert_own" on public.user_design_prefs;
create policy "user_design_prefs_insert_own"
  on public.user_design_prefs for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_design_prefs_update_own" on public.user_design_prefs;
create policy "user_design_prefs_update_own"
  on public.user_design_prefs for update
  using (auth.uid() = user_id);

drop policy if exists "user_design_prefs_delete_own" on public.user_design_prefs;
create policy "user_design_prefs_delete_own"
  on public.user_design_prefs for delete
  using (auth.uid() = user_id);

-- updated_at automatisch pflegen
create or replace function public.tg_user_design_prefs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tg_user_design_prefs_updated_at on public.user_design_prefs;
create trigger tg_user_design_prefs_updated_at
  before update on public.user_design_prefs
  for each row execute function public.tg_user_design_prefs_set_updated_at();
