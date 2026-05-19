-- BüroPilot Erweiterung: Neue Felder + Tabellen

-- 1. buero_kunden: neue Felder für Website, Adresse, Lieferadresse, Rechnungsadresse
alter table buero_kunden add column if not exists website            text;
alter table buero_kunden add column if not exists strasse            text;
alter table buero_kunden add column if not exists plz                text;
alter table buero_kunden add column if not exists lieferadresse      text;
alter table buero_kunden add column if not exists rechnungsadresse   text;

-- 2. buero_kunden_ansprechpartner: Weitere Kontaktpersonen je Kunde
create table if not exists buero_kunden_ansprechpartner (
  id          text primary key,
  user_id     uuid references auth.users default auth.uid(),
  kunde_id    text references buero_kunden(id) on delete cascade,
  name        text not null,
  email       text,
  telefon     text,
  position    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table buero_kunden_ansprechpartner enable row level security;
create policy "buero_ansprechpartner_user" on buero_kunden_ansprechpartner
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. buero_zeiterfassung: Zeiterfassung je Kunde
create table if not exists buero_zeiterfassung (
  id           text primary key,
  user_id      uuid references auth.users default auth.uid(),
  kunde_id     text references buero_kunden(id) on delete set null,
  kunde        text,
  datum        text not null,
  von          text not null,
  bis          text not null,
  stundensatz  numeric(10,2) not null default 0,
  beschreibung text,
  erstellt_am  timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table buero_zeiterfassung enable row level security;
create policy "buero_zeiterfassung_user" on buero_zeiterfassung
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. buero_artikel: Artikelstammdaten für Angebote/Rechnungen
create table if not exists buero_artikel (
  id             text primary key,
  user_id        uuid references auth.users default auth.uid(),
  artikelnummer  text,
  name           text not null,
  kategorie      text,
  einheit        text not null default 'Stk',
  einkaufspreis  numeric(10,2),
  verkaufspreis  numeric(10,2),
  mwst           integer default 19,
  beschreibung   text,
  aktiv          boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
alter table buero_artikel enable row level security;
create policy "buero_artikel_user" on buero_artikel
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Performance Indizes
create index if not exists idx_buero_ansprechpartner_kunde on buero_kunden_ansprechpartner(kunde_id);
create index if not exists idx_buero_zeiterfassung_kunde on buero_zeiterfassung(kunde_id);
create index if not exists idx_buero_zeiterfassung_datum on buero_zeiterfassung(datum);
create index if not exists idx_buero_artikel_aktiv on buero_artikel(aktiv);
