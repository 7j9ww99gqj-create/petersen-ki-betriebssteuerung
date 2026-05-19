-- User-scoped Audit-Log für kritische CRUD-Aktionen
-- (Löschen von Rechnungen, Kunden, Belegen, Artikeln, etc.)

create table if not exists public.user_audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  entity_label text,
  details     jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_user_audit_log_user_time
  on public.user_audit_log (user_id, created_at desc);

create index if not exists idx_user_audit_log_entity
  on public.user_audit_log (user_id, entity_type, entity_id);

alter table public.user_audit_log enable row level security;

drop policy if exists "user_only_select" on public.user_audit_log;
create policy "user_only_select" on public.user_audit_log
  for select using (auth.uid() = user_id);

drop policy if exists "user_only_insert" on public.user_audit_log;
create policy "user_only_insert" on public.user_audit_log
  for insert with check (auth.uid() = user_id);

-- Kein UPDATE/DELETE für User → Audit-Logs sind unveränderlich
