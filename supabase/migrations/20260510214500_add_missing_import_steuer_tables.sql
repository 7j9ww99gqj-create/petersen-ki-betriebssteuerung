-- ============================================================
-- Petersen KI – fehlende Import-/SteuerPilot Tabellen
-- Idempotent: kann mehrfach ausgeführt werden.
-- ============================================================

create table if not exists import_protokolle (
  id text primary key,
  user_id uuid references auth.users default auth.uid(),
  quelle text,
  datentyp text,
  dateiname text,
  status text,
  anzahl_gesamt integer default 0,
  anzahl_erfolgreich integer default 0,
  anzahl_fehlerhaft integer default 0,
  fehler jsonb,
  erstellt_am timestamp default now()
);

alter table import_protokolle enable row level security;
drop policy if exists "import_protokolle_select" on import_protokolle;
create policy "import_protokolle_select" on import_protokolle
  for select using (auth.uid() = user_id);

drop policy if exists "import_protokolle_insert" on import_protokolle;
create policy "import_protokolle_insert" on import_protokolle
  for insert with check (auth.uid() = user_id);

create table if not exists steuer_buchungen (
  id text primary key,
  user_id uuid references auth.users default auth.uid(),
  datum date not null,
  buchungstext text not null,
  betrag numeric not null default 0,
  soll_konto text,
  haben_konto text,
  steuerkonto text,
  steuersatz numeric,
  beleg_id text,
  status text default 'offen',
  erstellt_am timestamp default now()
);

alter table steuer_buchungen enable row level security;
drop policy if exists "steuer_buchungen_all" on steuer_buchungen;
create policy "steuer_buchungen_all" on steuer_buchungen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists steuer_konten (
  id text primary key,
  user_id uuid references auth.users default auth.uid(),
  kontonummer text not null,
  name text not null,
  typ text,
  steuersatz numeric,
  aktiv boolean default true,
  erstellt_am timestamp default now()
);

alter table steuer_konten enable row level security;
drop policy if exists "steuer_konten_all" on steuer_konten;
create policy "steuer_konten_all" on steuer_konten
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
