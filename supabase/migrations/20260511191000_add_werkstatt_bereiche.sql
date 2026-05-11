-- Petersen KI - WerkstattPilot Maschinen/Bereiche

create table if not exists werkstatt_bereiche (
  id         text primary key,
  user_id    uuid references auth.users not null default auth.uid(),
  name       text not null,
  typ        text default 'Bereich',
  aktiv      boolean default true,
  notiz      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table werkstatt_bereiche enable row level security;

drop policy if exists "werkstatt_bereiche_user" on werkstatt_bereiche;
create policy "werkstatt_bereiche_user" on werkstatt_bereiche
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

