-- Sprint-Migration: Aufgaben 18, 22, 25, 26, 30
-- Alle Spalten/Tabellen die im 30-Aufgaben-Sprint in schema.sql ergänzt wurden

-- ── Aufgabe 18: PlanungPilot Zeiterfassung ────────────────────────────────────
alter table planung_aufgaben
  add column if not exists stunden_soll numeric default 0,
  add column if not exists stunden_ist  numeric default 0;

-- ── Aufgabe 22: LagerPilot lieferant_id FK ───────────────────────────────────
alter table lager_artikel
  add column if not exists lieferant_id text references einkauf_lieferanten(id) on delete set null;

-- ── Aufgabe 25: Bestandstrend-Snapshots ──────────────────────────────────────
create table if not exists lager_bestand_snapshots (
  id          text primary key,
  user_id     uuid references auth.users default auth.uid(),
  datum       date not null default current_date,
  artikel_ges integer not null default 0,
  niedrig     integer not null default 0,
  leer        integer not null default 0,
  lagerwert   numeric not null default 0,
  notiz       text,
  erstellt_am timestamptz default now()
);

alter table lager_bestand_snapshots enable row level security;

drop policy if exists "lager_bestand_snapshots_all" on lager_bestand_snapshots;
create policy "lager_bestand_snapshots_all" on lager_bestand_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Aufgabe 26: BüroPilot Angebote + Rechnungen Positionen ───────────────────
alter table buero_angebote
  add column if not exists positionen jsonb default '[]'::jsonb;

alter table buero_rechnungen
  add column if not exists positionen jsonb default '[]'::jsonb;

-- ── Aufgabe 30: PlanungPilot auftrag_id FK ────────────────────────────────────
alter table planung_projekte
  add column if not exists auftrag_id text references buero_auftraege(id) on delete set null;
