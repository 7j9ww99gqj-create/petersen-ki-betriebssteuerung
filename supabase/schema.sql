-- ============================================================
-- Petersen KI – Supabase Schema
-- Einmal im Supabase SQL Editor ausführen
-- ============================================================

-- ── Rollenbasierte Hilfsfunktionen ──────────────────────────
-- pk_get_role(): liest app_metadata.role bzw. user_metadata.role aus dem JWT;
-- Fallback 'Mitarbeiter' für User ohne explizite Rollenzuweisung.
create or replace function pk_get_role()
returns text
language sql
stable security definer
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    'Mitarbeiter'
  );
$$;

-- pk_can_write(): Admin, Mitarbeiter und Büro dürfen schreiben/löschen.
create or replace function pk_can_write()
returns boolean
language sql
stable security definer
as $$
  select pk_get_role() in ('Admin', 'Mitarbeiter', 'Büro');
$$;

-- ── Mandant / Firmeneinstellungen ───────────────────────────

create table if not exists firma_einstellungen (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users not null default auth.uid(),
  firmenname            text not null,
  logo_url              text,
  adresse               text,
  plz                   text,
  ort                   text,
  land                  text default 'Deutschland',
  email                 text,
  telefon               text,
  website               text,
  ansprechpartner       text,
  slogan                text,
  branche               text,
  ust_id                text,
  steuernummer          text,
  handelsregister       text,
  geschaeftsfuehrer     text,
  bankname              text,
  iban                  text,
  bic                   text,
  zahlungsziel_tage     integer default 14,
  standard_mwst         numeric default 19,
  standard_waehrung     text default 'EUR',
  dokument_footer       text,
  briefpapier_layout    jsonb default '{}'::jsonb,
  onboarding_completed  boolean default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique(user_id)
);

alter table firma_einstellungen enable row level security;

create policy "firma_einstellungen_user" on firma_einstellungen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
  adresse         text,
  kundennummer    text,
  notizen         text,
  ort             text,
  umsatz          text,
  status          text default 'Aktiv',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists buero_angebote (
  id         text primary key,
  user_id    uuid references auth.users not null default auth.uid(),
  kunde_id   text references buero_kunden(id),
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
  kunde_id    text references buero_kunden(id),
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
  kunde_id    text references buero_kunden(id),
  kunde       text,
  nummer      text,
  betrag      text,
  summe       numeric default 0,
  datum       text,
  faellig     text,
  faellig_am  text,
  erstellt    text,
  status      text default 'Offen',
  bezahlt_am  text,
  notiz       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Eingangsrechnungen / Lieferantenrechnungen
-- WICHTIG: Nach Deployment im Supabase SQL-Editor ausführen, falls die Tabelle noch fehlt.
create table if not exists buero_eingangsrechnungen (
  id                text primary key,
  user_id           uuid references auth.users not null default auth.uid(),
  lieferant_id      text references einkauf_lieferanten(id),
  lieferant         text not null,
  rechnungsnummer   text,
  rechnungsdatum    date,
  faelligkeit       date,
  betrag_netto      numeric default 0,
  mwst              numeric default 0,
  betrag_brutto     numeric default 0,
  status            text default 'offen' check (status in ('offen', 'geprüft', 'freigegeben', 'bezahlt', 'überfällig', 'abgelehnt')),
  kategorie         text,
  iban              text,
  verwendungszweck  text,
  notiz             text,
  dokument_url      text,
  dokument_id       text,
  bezahlt_am        date,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
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
  status      text default 'erkannt',
  document_type text,
  confidence  numeric default 0,
  summary     text,
  extracted   jsonb default '{}',
  suggested_actions jsonb default '[]',
  search_text text,
  eingangsrechnung_id text references buero_eingangsrechnungen(id),
  rechnung_id text references buero_rechnungen(id),
  angebot_id text references buero_angebote(id),
  auftrag_id text references buero_auftraege(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'buero_eingangsrechnungen'
      and constraint_name = 'buero_eingangsrechnungen_dokument_id_fkey'
  ) then
    alter table buero_eingangsrechnungen
      add constraint buero_eingangsrechnungen_dokument_id_fkey
      foreign key (dokument_id) references buero_dokumente(id);
  end if;
end $$;

alter table buero_kunden    enable row level security;
alter table buero_angebote  enable row level security;
alter table buero_auftraege enable row level security;
alter table buero_rechnungen enable row level security;
alter table buero_eingangsrechnungen enable row level security;
alter table buero_dokumente enable row level security;

create policy "buero_kunden_user"    on buero_kunden    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_angebote_user"  on buero_angebote  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_auftraege_user" on buero_auftraege for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_rechnungen_user" on buero_rechnungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_eingangsrechnungen_user" on buero_eingangsrechnungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_dokumente_user" on buero_dokumente for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_buero_eingangsrechnungen_user_status on buero_eingangsrechnungen(user_id, status);
create index if not exists idx_buero_eingangsrechnungen_user_faelligkeit on buero_eingangsrechnungen(user_id, faelligkeit);
create index if not exists idx_buero_eingangsrechnungen_lieferant on buero_eingangsrechnungen(user_id, lieferant);
create index if not exists idx_buero_eingangsrechnungen_lieferant_id on buero_eingangsrechnungen(lieferant_id);
create index if not exists idx_buero_eingangsrechnungen_dokument_id on buero_eingangsrechnungen(dokument_id);
create index if not exists idx_buero_dokumente_eingangsrechnung_id on buero_dokumente(eingangsrechnung_id);
create index if not exists idx_buero_dokumente_rechnung_id on buero_dokumente(rechnung_id);
create index if not exists idx_buero_dokumente_angebot_id on buero_dokumente(angebot_id);
create index if not exists idx_buero_dokumente_auftrag_id on buero_dokumente(auftrag_id);
create index if not exists idx_buero_angebote_kunde_id on buero_angebote(kunde_id);
create index if not exists idx_buero_auftraege_kunde_id on buero_auftraege(kunde_id);
create index if not exists idx_buero_rechnungen_kunde_id on buero_rechnungen(kunde_id);

-- ── Einkauf / Lieferanten ───────────────────────────────────

create table if not exists einkauf_lieferanten (
  id            text primary key,
  user_id       uuid references auth.users not null default auth.uid(),
  name          text not null,
  kontakt       text,
  email         text,
  telefon       text,
  ort           text,
  kategorie     text,
  zahlungsziel  text,
  status        text default 'Aktiv',
  bewertung     integer default 4,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists einkauf_bestellungen (
  id               text primary key,
  user_id          uuid references auth.users not null default auth.uid(),
  lieferant_id     text references einkauf_lieferanten(id),
  lieferant        text,
  artikel          text,
  menge            numeric default 0,
  einheit          text default 'Stk',
  einkaufspreis    text,
  gesamt           text,
  status           text default 'Entwurf',
  bestellt_am      text,
  erwartet_am      text,
  geliefert_am     text,
  einzelpreis      numeric default 0,
  gesamtpreis      numeric default 0,
  bestelldatum     text,
  lieferdatum_soll text,
  notiz            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists einkauf_wareneingaenge (
  id              text primary key,
  user_id         uuid references auth.users not null default auth.uid(),
  bestellung_id   text references einkauf_bestellungen(id),
  lieferant       text,
  artikel         text,
  menge           numeric default 0,
  einheit         text default 'Stk',
  datum           text,
  qualitaet       text default 'OK',
  mitarbeiter     text,
  notiz           text,
  eingangsdatum   text,
  menge_bestellt  numeric default 0,
  menge_erhalten  numeric default 0,
  created_at      timestamptz default now()
);

alter table einkauf_lieferanten   enable row level security;
alter table einkauf_bestellungen  enable row level security;
alter table einkauf_wareneingaenge enable row level security;

create policy "einkauf_lieferanten_user"    on einkauf_lieferanten    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "einkauf_bestellungen_user"   on einkauf_bestellungen   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "einkauf_wareneingaenge_user" on einkauf_wareneingaenge for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- lager_artikel benötigt auch mindestbestand-Spalte (falls noch nicht vorhanden):
alter table lager_artikel add column if not exists mindestbestand integer default 0;
alter table lager_artikel add column if not exists artikelnummer text;
alter table lager_artikel add column if not exists beschreibung text;
alter table lager_artikel add column if not exists einkaufspreis numeric default 0;
alter table lager_artikel add column if not exists verkaufspreis numeric default 0;
alter table lager_artikel add column if not exists lagerort text;

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

alter table werkstatt_karten          enable row level security;
alter table werkstatt_mitarbeiter     enable row level security;
alter table werkstatt_bereiche        enable row level security;
alter table werkstatt_zeitbuchungen   enable row level security;
alter table werkstatt_material        enable row level security;
alter table werkstatt_pruefprotokolle enable row level security;
alter table werkstatt_wartungen       enable row level security;
alter table werkstatt_stoerungen      enable row level security;

create policy "werkstatt_karten_user"          on werkstatt_karten          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_mitarbeiter_user"     on werkstatt_mitarbeiter     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_bereiche_user"        on werkstatt_bereiche        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_zeitbuchungen_user"   on werkstatt_zeitbuchungen   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_material_user"        on werkstatt_material        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_pruefprotokolle_user" on werkstatt_pruefprotokolle for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_wartungen_user"       on werkstatt_wartungen       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "werkstatt_stoerungen_user"      on werkstatt_stoerungen      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_werkstatt_wartungen_user_faellig on werkstatt_wartungen(user_id, faellig_am);
create index if not exists idx_werkstatt_stoerungen_user_status on werkstatt_stoerungen(user_id, status);

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

create table if not exists marketing_seo_keywords (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  keyword        text not null,
  zielseite      text,
  intent         text default 'Transaktional',
  suchvolumen    integer default 0,
  schwierigkeit  integer default 0,
  ranking        integer default 0,
  klicks         integer default 0,
  status         text default 'Neu',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists marketing_content_ideas (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  titel          text not null,
  kanal          text default 'LinkedIn',
  ziel           text,
  keyword        text,
  hook           text,
  cta            text,
  status         text default 'Idee',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists marketing_posting_plans (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  titel          text not null,
  kanal          text default 'LinkedIn',
  datum          text,
  status         text default 'Entwurf',
  owner          text,
  quelle         text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists marketing_automation_rules (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  name           text not null,
  trigger        text,
  aktion         text,
  kanal          text default 'CRM',
  owner          text,
  status         text default 'Entwurf',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists marketing_integration_items (
  id                text primary key,
  user_id           uuid references auth.users not null default auth.uid(),
  name              text not null,
  status            text default 'Nicht gestartet',
  datenbasis        text,
  letzterSync       text,
  naechsterSchritt  text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table marketing_kampagnen  enable row level security;
alter table marketing_leads      enable row level security;
alter table marketing_newsletter enable row level security;
alter table marketing_seo_keywords enable row level security;
alter table marketing_content_ideas enable row level security;
alter table marketing_posting_plans enable row level security;
alter table marketing_automation_rules enable row level security;
alter table marketing_integration_items enable row level security;

create policy "marketing_kampagnen_user"  on marketing_kampagnen  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_leads_user"      on marketing_leads      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_newsletter_user" on marketing_newsletter for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_seo_keywords_user" on marketing_seo_keywords for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_content_ideas_user" on marketing_content_ideas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_posting_plans_user" on marketing_posting_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_automation_rules_user" on marketing_automation_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "marketing_integration_items_user" on marketing_integration_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

-- ── STEUERPILOT ──────────────────────────────────────────────────────────────

create table if not exists steuer_belege (
  id text primary key,
  user_id uuid references auth.users default auth.uid(),
  lieferant text not null,
  betrag numeric not null default 0,
  steuerbetrag numeric not null default 0,
  steuersatz numeric not null default 19,
  datum date not null,
  status text not null default 'offen',
  datei_url text,
  belegnummer text,
  kategorie text,
  notiz text,
  erstellt_am timestamp default now()
);

alter table steuer_belege enable row level security;

create policy "steuer_belege_all" on steuer_belege
  for all using (auth.uid() = user_id);

create table if not exists steuer_ustva (
  id text primary key,
  user_id uuid references auth.users default auth.uid(),
  monat text not null,
  umsatzsteuer numeric not null default 0,
  vorsteuer numeric not null default 0,
  zahllast numeric not null default 0,
  status text not null default 'offen',
  erstellt_am timestamp default now()
);

alter table steuer_ustva enable row level security;

create policy "steuer_ustva_all" on steuer_ustva
  for all using (auth.uid() = user_id);

-- ── IMPORT PROTOKOLLE ─────────────────────────────────────────────────────────

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

create policy "import_protokolle_select" on import_protokolle
  for select using (auth.uid() = user_id);

create policy "import_protokolle_insert" on import_protokolle
  for insert with check (auth.uid() = user_id);

-- ── STEUER BUCHUNGEN ──────────────────────────────────────────────────────────

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

create policy "steuer_buchungen_all" on steuer_buchungen
  for all using (auth.uid() = user_id);

-- ── STEUER KONTEN ─────────────────────────────────────────────────────────────

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

create policy "steuer_konten_all" on steuer_konten
  for all using (auth.uid() = user_id);

-- ── LAGER STELLPLÄTZE ─────────────────────────────────────────────────────────

create table if not exists lager_stellplaetze (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users default auth.uid(),
  code            text not null,
  name            text,
  bereich         text,
  zone            text,
  gang            text,
  regal           text,
  ebene           text,
  fach            text,
  typ             text default 'Standard',
  warengruppe     text,
  warenobergruppe text,
  temperaturzone  text,
  max_gewicht     numeric,
  max_volumen     numeric,
  aktiv           boolean default true,
  notiz           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table lager_stellplaetze enable row level security;

create policy "lager_stellplaetze_all" on lager_stellplaetze
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── LAGER STELLPLATZ-BESTAND ──────────────────────────────────────────────────

create table if not exists lager_stellplatz_bestand (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users default auth.uid(),
  stellplatz_id   uuid references lager_stellplaetze(id) on delete cascade,
  artikel_id      text references lager_artikel(id) on delete set null,
  artikelnummer   text,
  artikelname     text,
  charge          text,
  mhd             date,
  menge           integer not null default 0,
  einheit         text default 'Stk',
  status          text default 'Verfügbar',
  eingelagert_am  date default current_date,
  notiz           text,
  created_at      timestamptz default now()
);

alter table lager_stellplatz_bestand enable row level security;

create policy "lager_stellplatz_bestand_all" on lager_stellplatz_bestand
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── LAGER UMLAGERUNGEN ────────────────────────────────────────────────────────

create table if not exists lager_umlagerungen (
  id                  text primary key,
  user_id             uuid references auth.users default auth.uid(),
  artikel_id          text references lager_artikel(id),
  artikelnummer       text,
  artikelname         text,
  von_stellplatz_id   uuid references lager_stellplaetze(id),
  nach_stellplatz_id  uuid references lager_stellplaetze(id),
  charge              text,
  mhd                 date,
  menge               integer not null,
  grund               text,
  datum               timestamptz default now(),
  notiz               text
);

alter table lager_umlagerungen enable row level security;

create policy "lager_umlagerungen_all" on lager_umlagerungen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
