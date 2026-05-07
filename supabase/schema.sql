-- ============================================================
-- Petersen KI – Supabase Schema
-- Einmal im Supabase SQL Editor ausführen
-- ============================================================

-- ── LagerPilot ──────────────────────────────────────────────

create table if not exists lager_artikel (
  id          text primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  name        text not null,
  kategorie   text,
  bestand     integer default 0,
  einheit     text default 'Stk',
  lagerplatz  text,
  status      text default 'ok',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists lager_bewegungen (
  id          bigserial primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  typ         text not null,
  artikel     text not null,
  menge       integer not null,
  datum       text,
  mitarbeiter text,
  status      text default 'Gebucht',
  created_at  timestamptz default now()
);

alter table lager_artikel  enable row level security;
alter table lager_bewegungen enable row level security;

create policy "lager_artikel_user"   on lager_artikel   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lager_bewegungen_user" on lager_bewegungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── BüroPilot ───────────────────────────────────────────────

create table if not exists buero_kunden (
  id              text primary key,
  user_id         uuid references auth.users not null default auth.uid(),
  name            text not null,
  typ             text default 'Firma',
  ansprechpartner text,
  email           text,
  telefon         text,
  ort             text,
  umsatz          text,
  status          text default 'Aktiv',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists buero_angebote (
  id         text primary key,
  user_id    uuid references auth.users not null default auth.uid(),
  kunde      text,
  titel      text,
  betrag     text,
  datum      text,
  gueltig    text,
  status     text default 'Entwurf',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists buero_auftraege (
  id          text primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  kunde       text,
  beschreibung text,
  wert        text,
  start       text,
  ende        text,
  status      text default 'Geplant',
  fortschritt integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists buero_rechnungen (
  id          text primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  kunde       text,
  betrag      text,
  faellig     text,
  erstellt    text,
  status      text default 'Offen',
  bezahlt_am  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists buero_dokumente (
  id          text primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  name        text not null,
  typ         text,
  groesse     text,
  datum       text,
  kategorie   text,
  bezug       text,
  storage_path text,
  created_at  timestamptz default now()
);

alter table buero_kunden    enable row level security;
alter table buero_angebote  enable row level security;
alter table buero_auftraege enable row level security;
alter table buero_rechnungen enable row level security;
alter table buero_dokumente enable row level security;

create policy "buero_kunden_user"    on buero_kunden    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_angebote_user"  on buero_angebote  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_auftraege_user" on buero_auftraege for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_rechnungen_user" on buero_rechnungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_dokumente_user" on buero_dokumente for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── WerkstattPilot ──────────────────────────────────────────

create table if not exists werkstatt_karten (
  id           text primary key,
  user_id      uuid references auth.users not null default auth.uid(),
  auftragsnr   text,
  beschreibung text,
  mitarbeiter  text,
  prioritaet   text default 'Mittel',
  status       text default 'Offen',
  erstellt     text,
  geplant      text,
  stunden      numeric default 0,
  fortschritt  integer default 0,
  maschine     text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists werkstatt_zeitbuchungen (
  id           bigserial primary key,
  user_id      uuid references auth.users not null default auth.uid(),
  mitarbeiter  text,
  auftragsnr   text,
  stunden      numeric,
  datum        text,
  taetigkeit   text,
  created_at   timestamptz default now()
);

create table if not exists werkstatt_material (
  id           bigserial primary key,
  user_id      uuid references auth.users not null default auth.uid(),
  artikel      text,
  menge        numeric,
  einheit      text,
  auftragsnr   text,
  datum        text,
  mitarbeiter  text,
  created_at   timestamptz default now()
);

create table if not exists werkstatt_pruefprotokolle (
  id           bigserial primary key,
  user_id      uuid references auth.users not null default auth.uid(),
  auftragsnr   text,
  pruefpunkt   text,
  ergebnis     text default 'Offen',
  pruefer      text,
  datum        text,
  created_at   timestamptz default now()
);

alter table werkstatt_karten          enable row level security;
alter table werkstatt_zeitbuchungen   enable row level security;
alter table werkstatt_material        enable row level security;
alter table werkstatt_pruefprotokolle enable row level security;

create policy "werkstatt_karten_user"          on werkstatt_karten          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_zeitbuchungen_user"   on werkstatt_zeitbuchungen   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_material_user"        on werkstatt_material        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_pruefprotokolle_user" on werkstatt_pruefprotokolle for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── MarketingPilot ──────────────────────────────────────────

create table if not exists marketing_kampagnen (
  id            text primary key,
  user_id       uuid references auth.users not null default auth.uid(),
  name          text not null,
  typ           text,
  status        text default 'Entwurf',
  zielgruppe    text,
  start         text,
  ende          text,
  empfaenger    integer default 0,
  geoeffnet     integer default 0,
  geklickt      integer default 0,
  konversionen  integer default 0,
  budget        text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists marketing_leads (
  id          text primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  name        text not null,
  firma       text,
  email       text,
  telefon     text,
  quelle      text,
  status      text default 'Neu',
  wert        text,
  erstellt    text,
  betreuer    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists marketing_newsletter (
  id            text primary key,
  user_id       uuid references auth.users not null default auth.uid(),
  betreff       text not null,
  vorschau      text,
  empfaenger    integer default 0,
  datum         text,
  status        text default 'Entwurf',
  oeffnungsrate numeric default 0,
  klickrate     numeric default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table marketing_kampagnen  enable row level security;
alter table marketing_leads      enable row level security;
alter table marketing_newsletter enable row level security;

create policy "marketing_kampagnen_user"  on marketing_kampagnen  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_leads_user"      on marketing_leads      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_newsletter_user" on marketing_newsletter for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── PlanungPilot ────────────────────────────────────────────

create table if not exists planung_projekte (
  id              text primary key,
  user_id         uuid references auth.users not null default auth.uid(),
  name            text not null,
  kunde           text,
  status          text default 'Planung',
  start           text,
  ende            text,
  budget          text,
  fortschritt     integer default 0,
  beschreibung    text,
  verantwortlich  text,
  meilensteine    jsonb default '[]',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists planung_aufgaben (
  id              text primary key,
  user_id         uuid references auth.users not null default auth.uid(),
  titel           text not null,
  projekt         text,
  verantwortlich  text,
  prioritaet      text default 'Mittel',
  status          text default 'Offen',
  faellig         text,
  erstellt        text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists planung_termine (
  id          text primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  titel       text not null,
  datum       text,
  uhrzeit     text,
  typ         text,
  projekt     text,
  teilnehmer  text,
  created_at  timestamptz default now()
);

create table if not exists planung_ressourcen (
  id          text primary key,
  user_id     uuid references auth.users not null default auth.uid(),
  name        text not null,
  typ         text,
  kapazitaet  integer default 100,
  genutzt     integer default 0,
  projekt     text,
  status      text default 'Verfügbar',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table planung_projekte   enable row level security;
alter table planung_aufgaben   enable row level security;
alter table planung_termine    enable row level security;
alter table planung_ressourcen enable row level security;

create policy "planung_projekte_user"   on planung_projekte   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planung_aufgaben_user"   on planung_aufgaben   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planung_termine_user"    on planung_termine    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planung_ressourcen_user" on planung_ressourcen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Storage Bucket für Dokumente ────────────────────────────

insert into storage.buckets (id, name, public)
values ('dokumente', 'dokumente', false)
on conflict do nothing;

create policy "dokumente_upload" on storage.objects
  for insert with check (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "dokumente_select" on storage.objects
  for select using (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "dokumente_delete" on storage.objects
  for delete using (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1]);
