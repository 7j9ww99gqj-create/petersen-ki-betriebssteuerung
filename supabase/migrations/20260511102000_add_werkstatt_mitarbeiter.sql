-- ============================================================
-- Petersen KI – WerkstattPilot Mitarbeiterverwaltung
-- ============================================================

create table if not exists werkstatt_mitarbeiter (
  id         text primary key,
  user_id    uuid references auth.users not null default auth.uid(),
  name       text not null,
  rolle      text,
  email      text,
  telefon    text,
  aktiv      boolean default true,
  notiz      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table werkstatt_mitarbeiter enable row level security;
drop policy if exists "werkstatt_mitarbeiter_user" on werkstatt_mitarbeiter;
create policy "werkstatt_mitarbeiter_user" on werkstatt_mitarbeiter
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
