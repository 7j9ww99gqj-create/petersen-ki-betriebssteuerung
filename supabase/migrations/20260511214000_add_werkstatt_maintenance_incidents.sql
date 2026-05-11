-- WerkstattPilot Phase 3: Wartungsplanung und Störungsmeldungen

create table if not exists werkstatt_wartungen (
  id              text primary key,
  user_id         uuid references auth.users not null default auth.uid(),
  maschine        text not null,
  intervall       text,
  faellig_am      date not null,
  letzte_wartung  date,
  verantwortlich  text,
  status          text default 'geplant',
  notiz           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists werkstatt_stoerungen (
  id            text primary key,
  user_id       uuid references auth.users not null default auth.uid(),
  maschine      text not null,
  titel         text not null,
  beschreibung  text,
  prioritaet    text default 'Mittel',
  status        text default 'offen',
  gemeldet_von  text,
  gemeldet_am   date default current_date,
  behoben_am    date,
  notiz         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table werkstatt_wartungen enable row level security;
alter table werkstatt_stoerungen enable row level security;

do $$ begin
  create policy "werkstatt_wartungen_user" on werkstatt_wartungen
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "werkstatt_stoerungen_user" on werkstatt_stoerungen
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists idx_werkstatt_wartungen_user_faellig on werkstatt_wartungen(user_id, faellig_am);
create index if not exists idx_werkstatt_stoerungen_user_status on werkstatt_stoerungen(user_id, status);
