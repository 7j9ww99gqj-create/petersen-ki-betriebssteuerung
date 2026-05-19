-- Owner-Audit-Log: protokolliert kritische Inhaber-Aktionen
-- (Kundenfreischaltung, Sperren, Pondruff-Flag-Toggles, Rechnungserstellung)

create table if not exists public.owner_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  action text not null,
  target_user_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists owner_audit_log_created_at_idx
  on public.owner_audit_log (created_at desc);
create index if not exists owner_audit_log_action_idx
  on public.owner_audit_log (action);
create index if not exists owner_audit_log_actor_idx
  on public.owner_audit_log (actor_user_id);

alter table public.owner_audit_log enable row level security;

-- Kein Public-Select-Policy: nur Service-Role-Zugriff.
-- (RLS aktiv aber ohne Policies = niemand außer Service-Role darf lesen/schreiben.)

drop policy if exists owner_audit_log_no_public_select on public.owner_audit_log;
drop policy if exists owner_audit_log_no_public_insert on public.owner_audit_log;
