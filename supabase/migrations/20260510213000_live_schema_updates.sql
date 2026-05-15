-- ============================================================
-- Petersen KI – Live Schema Updates
-- Für Supabase SQL Editor / Supabase CLI geeignet.
-- Idempotent: kann mehrfach ausgeführt werden, ohne bestehende Daten zu löschen.
-- ============================================================

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
  ai_enabled            boolean default true,
  ai_chat_enabled       boolean default true,
  ai_document_enabled   boolean default true,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique(user_id)
);

alter table firma_einstellungen enable row level security;
drop policy if exists "firma_einstellungen_user" on firma_einstellungen;
create policy "firma_einstellungen_user" on firma_einstellungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table if exists firma_einstellungen add column if not exists ai_enabled boolean default true;
alter table if exists firma_einstellungen add column if not exists ai_chat_enabled boolean default true;
alter table if exists firma_einstellungen add column if not exists ai_document_enabled boolean default true;

create or replace function pk_get_ai_settings()
returns table (
  ai_enabled boolean,
  ai_chat_enabled boolean,
  ai_document_enabled boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(f.ai_enabled, true) as ai_enabled,
    coalesce(f.ai_chat_enabled, true) as ai_chat_enabled,
    coalesce(f.ai_document_enabled, true) as ai_document_enabled
  from (
    select ai_enabled, ai_chat_enabled, ai_document_enabled
    from firma_einstellungen
    order by updated_at desc nulls last
    limit 1
  ) f
  union all
  select true, true, true
  where not exists (select 1 from firma_einstellungen);
$$;

insert into storage.buckets (id, name, public)
values ('dokumente', 'dokumente', false)
on conflict do nothing;

drop policy if exists "dokumente_upload" on storage.objects;
create policy "dokumente_upload" on storage.objects
  for insert with check (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "dokumente_select" on storage.objects;
create policy "dokumente_select" on storage.objects
  for select using (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "dokumente_update" on storage.objects;
create policy "dokumente_update" on storage.objects
  for update using (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "dokumente_delete" on storage.objects;
create policy "dokumente_delete" on storage.objects
  for delete using (bucket_id = 'dokumente' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── LagerPilot: Mindestbestand ──────────────────────────────
alter table if exists lager_artikel
  add column if not exists mindestbestand integer default 0;

-- ── Einkauf / Lieferanten ───────────────────────────────────
create table if not exists einkauf_lieferanten (
  id            text primary key,
  user_id       uuid references auth.users not null default auth.uid(),
  name          text not null,
  kategorie     text,
  ansprechpartner text,
  email         text,
  telefon       text,
  zahlungsziel  text,
  bewertung     integer default 3,
  notiz         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists einkauf_bestellungen (
  id              text primary key,
  user_id         uuid references auth.users not null default auth.uid(),
  lieferant_id    text references einkauf_lieferanten(id),
  status          text default 'Entwurf',
  artikel         text,
  menge           integer default 0,
  einzelpreis     numeric default 0,
  gesamtpreis     numeric default 0,
  bestelldatum    text,
  lieferdatum_soll text,
  notiz           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists einkauf_wareneingaenge (
  id              bigserial primary key,
  user_id         uuid references auth.users not null default auth.uid(),
  bestellung_id   text references einkauf_bestellungen(id),
  eingangsdatum   text,
  menge_bestellt  integer default 0,
  menge_erhalten  integer default 0,
  qualitaet       text default 'OK',
  notiz           text,
  created_at      timestamptz default now()
);

alter table einkauf_lieferanten enable row level security;
alter table einkauf_bestellungen enable row level security;
alter table einkauf_wareneingaenge enable row level security;

drop policy if exists "einkauf_lieferanten_user" on einkauf_lieferanten;
drop policy if exists "einkauf_bestellungen_user" on einkauf_bestellungen;
drop policy if exists "einkauf_wareneingaenge_user" on einkauf_wareneingaenge;
create policy "einkauf_lieferanten_user" on einkauf_lieferanten for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "einkauf_bestellungen_user" on einkauf_bestellungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "einkauf_wareneingaenge_user" on einkauf_wareneingaenge for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── BüroPilot: Eingangsrechnungen ───────────────────────────
create table if not exists buero_eingangsrechnungen (
  id                text primary key,
  user_id           uuid references auth.users not null default auth.uid(),
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

alter table buero_eingangsrechnungen enable row level security;
drop policy if exists "buero_eingangsrechnungen_user" on buero_eingangsrechnungen;
create policy "buero_eingangsrechnungen_user" on buero_eingangsrechnungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_buero_eingangsrechnungen_user_status on buero_eingangsrechnungen(user_id, status);
create index if not exists idx_buero_eingangsrechnungen_user_faelligkeit on buero_eingangsrechnungen(user_id, faelligkeit);
create index if not exists idx_buero_eingangsrechnungen_lieferant on buero_eingangsrechnungen(user_id, lieferant);

-- ── LagerPilot: Stellplätze / Belegung / Umlagerungen ───────
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

alter table lager_stellplaetze enable row level security;
alter table lager_stellplatz_bestand enable row level security;
alter table lager_umlagerungen enable row level security;

drop policy if exists "lager_stellplaetze_all" on lager_stellplaetze;
drop policy if exists "lager_stellplatz_bestand_all" on lager_stellplatz_bestand;
drop policy if exists "lager_umlagerungen_all" on lager_umlagerungen;
create policy "lager_stellplaetze_all" on lager_stellplaetze for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lager_stellplatz_bestand_all" on lager_stellplatz_bestand for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lager_umlagerungen_all" on lager_umlagerungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_lager_stellplaetze_user_code on lager_stellplaetze(user_id, code);
create index if not exists idx_lager_stellplatz_bestand_user_stellplatz on lager_stellplatz_bestand(user_id, stellplatz_id);
create index if not exists idx_lager_stellplatz_bestand_artikel on lager_stellplatz_bestand(user_id, artikelnummer);
create index if not exists idx_lager_umlagerungen_user_datum on lager_umlagerungen(user_id, datum desc);
