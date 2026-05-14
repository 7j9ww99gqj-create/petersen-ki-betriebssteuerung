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
  select pk_get_role() in ('Inhaber', 'Admin', 'Mitarbeiter', 'Büro');
$$;

create or replace function pk_is_owner()
returns boolean
language sql
stable security definer
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'info@petersen-ki-pilot.de';
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

-- ── Billing / Abonnement ───────────────────────────────────

create table if not exists billing_subscriptions (
  id             text primary key,
  user_id        uuid references auth.users not null default auth.uid(),
  user_key       text,
  user_email     text,
  package_id     text,
  pilot_ids      text[] not null default '{}'::text[],
  employee_tier  text not null default '1-3',
  monthly_price  numeric,
  status         text not null default 'pending_payment' check (status in ('no_subscription', 'pending_payment', 'proof_sent', 'active', 'rejected', 'cancelled')),
  software_enabled boolean not null default false,
  next_payment   date,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(user_id)
);

alter table billing_subscriptions enable row level security;

create policy "billing_subscriptions_select" on billing_subscriptions
  for select using (auth.uid() = user_id or pk_is_owner());

create policy "billing_subscriptions_insert" on billing_subscriptions
  for insert with check (auth.uid() = user_id or pk_is_owner());

create policy "billing_subscriptions_update" on billing_subscriptions
  for update using (auth.uid() = user_id or pk_is_owner())
  with check (auth.uid() = user_id or pk_is_owner());

create index if not exists idx_billing_subscriptions_user_status on billing_subscriptions(user_id, status);

create or replace function sync_billing_subscription_to_owner_customer()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_user_id uuid;
  customer_name text;
  customer_status text;
begin
  select id into owner_user_id
  from auth.users
  where lower(email) = 'info@petersen-ki-pilot.de'
  limit 1;

  if owner_user_id is null then
    return new;
  end if;

  customer_name := coalesce(
    nullif(split_part(coalesce(new.user_email, ''), '@', 1), ''),
    nullif(new.user_key, ''),
    'Kunde'
  );

  customer_status := case
    when coalesce(new.software_enabled, false) then 'Aktiv'
    when new.status in ('cancelled', 'rejected') then 'Inaktiv'
    else 'In Prüfung'
  end;

  insert into public.buero_kunden (
    id, user_id, auth_user_id, source, billing_subscription_id, name, typ, ansprechpartner, email, umsatz, status, software_enabled, updated_at
  ) values (
    'BILL-' || new.id,
    owner_user_id,
    new.user_id,
    'billing',
    new.id,
    customer_name,
    'SaaS-Kunde',
    customer_name,
    new.user_email,
    coalesce(new.monthly_price::text, 'auf Anfrage'),
    customer_status,
    coalesce(new.software_enabled, false),
    now()
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    source = excluded.source,
    billing_subscription_id = excluded.billing_subscription_id,
    name = excluded.name,
    ansprechpartner = excluded.ansprechpartner,
    email = excluded.email,
    umsatz = excluded.umsatz,
    status = excluded.status,
    software_enabled = excluded.software_enabled,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_billing_subscription_to_owner_customer on billing_subscriptions;
create trigger trg_sync_billing_subscription_to_owner_customer
after insert or update on billing_subscriptions
for each row execute function sync_billing_subscription_to_owner_customer();

create table if not exists owner_event_inbox (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid references auth.users not null,
  source         text not null check (source in ('billing', 'qonto', 'stripe', 'buero_pilot', 'system')),
  event_type     text not null,
  severity       text not null default 'info' check (severity in ('info', 'warn', 'error', 'success')),
  status         text not null default 'new' check (status in ('new', 'processed', 'failed', 'ignored')),
  entity_type    text,
  entity_id      text,
  dedupe_key     text not null,
  payload        jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now(),
  processed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique(owner_user_id, dedupe_key)
);

create table if not exists owner_notifications (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid references auth.users not null,
  inbox_event_id uuid references owner_event_inbox(id) on delete set null,
  source         text not null check (source in ('billing', 'qonto', 'stripe', 'buero_pilot', 'system')),
  severity       text not null default 'info' check (severity in ('info', 'warn', 'error', 'success')),
  type           text not null,
  title          text not null,
  message        text,
  link_url       text,
  entity_type    text,
  entity_id      text,
  dedupe_key     text not null,
  seen_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(owner_user_id, dedupe_key)
);

alter table owner_event_inbox enable row level security;
alter table owner_notifications enable row level security;

create policy "owner_event_inbox_select" on owner_event_inbox
  for select using (pk_is_owner());

create policy "owner_notifications_select" on owner_notifications
  for select using (pk_is_owner());

create policy "owner_notifications_update" on owner_notifications
  for update using (pk_is_owner())
  with check (pk_is_owner());

create index if not exists idx_owner_event_inbox_owner_created on owner_event_inbox(owner_user_id, created_at desc);
create index if not exists idx_owner_notifications_owner_seen on owner_notifications(owner_user_id, seen_at, created_at desc);

create or replace function sync_billing_subscription_to_owner_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_user_id uuid;
  dedupe_suffix text;
  event_dedupe text;
  notif_dedupe text;
  event_kind text;
  event_severity text;
  event_title text;
  event_message text;
  event_link text := '/dashboard/einstellungen';
  inbox_id uuid;
begin
  select id into owner_user_id
  from auth.users
  where lower(email) = 'info@petersen-ki-pilot.de'
  limit 1;

  if owner_user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    event_kind := 'booking.created';
    event_severity := 'success';
    event_title := 'Neue Buchung eingegangen';
    event_message := coalesce(new.user_email, new.user_key, 'Unbekannter Kunde') || ' hat ein neues Abo gestartet.';
    dedupe_suffix := coalesce(new.created_at::text, now()::text);
  elsif old.status is distinct from new.status then
    event_kind := 'billing.status_changed';
    event_severity := case
      when new.status = 'active' then 'success'
      when new.status in ('rejected', 'cancelled') then 'warn'
      else 'info'
    end;
    event_title := 'Abo-Status aktualisiert';
    event_message := coalesce(new.user_email, new.user_key, 'Kunde') || ' ist jetzt "' || new.status || '".';
    dedupe_suffix := coalesce(new.updated_at::text, now()::text);
  elsif old.software_enabled is distinct from new.software_enabled then
    event_kind := 'billing.software_toggled';
    event_severity := case when new.software_enabled then 'success' else 'warn' end;
    event_title := case when new.software_enabled then 'Software freigeschaltet' else 'Software gesperrt' end;
    event_message := coalesce(new.user_email, new.user_key, 'Kunde') || case when new.software_enabled then ' wurde aktiviert.' else ' wurde gesperrt.' end;
    dedupe_suffix := coalesce(new.updated_at::text, now()::text);
  else
    return new;
  end if;

  event_dedupe := 'billing:' || new.id || ':' || event_kind || ':' || dedupe_suffix;
  notif_dedupe := 'notif:' || event_dedupe;

  insert into public.owner_event_inbox (
    owner_user_id, source, event_type, severity, status, entity_type, entity_id, dedupe_key, payload, occurred_at, processed_at
  ) values (
    owner_user_id, 'billing', event_kind, event_severity, 'processed', 'billing_subscription', new.id, event_dedupe,
    jsonb_build_object(
      'subscription_id', new.id,
      'user_email', new.user_email,
      'user_key', new.user_key,
      'status', new.status,
      'software_enabled', new.software_enabled,
      'monthly_price', new.monthly_price
    ),
    now(),
    now()
  )
  on conflict (owner_user_id, dedupe_key) do update set
    severity = excluded.severity,
    status = excluded.status,
    payload = excluded.payload,
    processed_at = excluded.processed_at
  returning id into inbox_id;

  insert into public.owner_notifications (
    owner_user_id, inbox_event_id, source, severity, type, title, message, link_url, entity_type, entity_id, dedupe_key, updated_at
  ) values (
    owner_user_id, inbox_id, 'billing', event_severity, event_kind, event_title, event_message, event_link, 'billing_subscription', new.id, notif_dedupe, now()
  )
  on conflict (owner_user_id, dedupe_key) do update set
    severity = excluded.severity,
    title = excluded.title,
    message = excluded.message,
    link_url = excluded.link_url,
    updated_at = now();

  return new;
end;
$$;

create or replace function pk_register_owner_event(
  p_source text,
  p_event_type text,
  p_severity text default 'info',
  p_entity_type text default null,
  p_entity_id text default null,
  p_dedupe_key text default null,
  p_title text default null,
  p_message text default null,
  p_link_url text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_user_id uuid;
  normalized_source text := case when p_source in ('billing', 'qonto', 'stripe', 'buero_pilot', 'system') then p_source else 'system' end;
  normalized_severity text := case when p_severity in ('info', 'warn', 'error', 'success') then p_severity else 'info' end;
  final_dedupe text := coalesce(nullif(p_dedupe_key, ''), normalized_source || ':' || coalesce(p_event_type, 'event') || ':' || coalesce(p_entity_id, gen_random_uuid()::text));
  inbox_id uuid;
begin
  select id into owner_user_id
  from auth.users
  where lower(email) = 'info@petersen-ki-pilot.de'
  limit 1;

  if owner_user_id is null then
    return null;
  end if;

  insert into public.owner_event_inbox (
    owner_user_id, source, event_type, severity, status, entity_type, entity_id, dedupe_key, payload, occurred_at, processed_at
  ) values (
    owner_user_id, normalized_source, coalesce(p_event_type, 'system.notice'), normalized_severity, 'processed', p_entity_type, p_entity_id, final_dedupe, coalesce(p_payload, '{}'::jsonb), now(), now()
  )
  on conflict (owner_user_id, dedupe_key) do update set
    severity = excluded.severity,
    status = excluded.status,
    payload = excluded.payload,
    processed_at = excluded.processed_at
  returning id into inbox_id;

  insert into public.owner_notifications (
    owner_user_id, inbox_event_id, source, severity, type, title, message, link_url, entity_type, entity_id, dedupe_key, updated_at
  ) values (
    owner_user_id,
    inbox_id,
    normalized_source,
    normalized_severity,
    coalesce(p_event_type, 'system.notice'),
    coalesce(p_title, 'Hinweis'),
    p_message,
    p_link_url,
    p_entity_type,
    p_entity_id,
    'notif:' || final_dedupe,
    now()
  )
  on conflict (owner_user_id, dedupe_key) do update set
    severity = excluded.severity,
    title = excluded.title,
    message = excluded.message,
    link_url = excluded.link_url,
    updated_at = now();

  return inbox_id;
end;
$$;

drop trigger if exists trg_sync_billing_subscription_to_owner_notifications on billing_subscriptions;
create trigger trg_sync_billing_subscription_to_owner_notifications
after insert or update on billing_subscriptions
for each row execute function sync_billing_subscription_to_owner_notifications();

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
  auth_user_id    uuid references auth.users,
  source          text default 'manual',
  billing_subscription_id text unique,
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
  software_enabled boolean not null default false,
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
  billing_subscription_id text references billing_subscriptions(id),
  kunde       text,
  nummer      text,
  rechnungstyp text default 'standard',
  betrag      text,
  summe       numeric default 0,
  netto       numeric default 0,
  steuer_satz numeric default 19,
  steuerbetrag numeric default 0,
  pdf_url     text,
  payment_provider text,
  provider_ref text,
  payment_link_id text,
  payment_link_url text,
  payment_link_reference text,
  payment_link_status text default 'not_requested' check (payment_link_status in ('not_requested', 'pending', 'ready', 'processing', 'paid', 'expired', 'cancelled', 'missing_config', 'failed')),
  payment_link_created_at timestamptz,
  payment_link_error text,
  auto_generated boolean not null default false,
  leistungszeitraum_von date,
  leistungszeitraum_bis date,
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

create table if not exists billing_payments (
  id                text primary key,
  user_id           uuid references auth.users not null default auth.uid(),
  customer_id       text references buero_kunden(id),
  billing_subscription_id text references billing_subscriptions(id),
  invoice_id        text references buero_rechnungen(id),
  provider          text not null default 'stripe',
  provider_ref      text,
  method            text default 'unknown',
  status            text not null default 'pending' check (status in ('pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled')),
  amount            numeric default 0,
  currency          text default 'EUR',
  booked_at         timestamptz,
  last_synced_at    timestamptz,
  status_source     text default 'unknown' check (status_source in ('unknown', 'payment_link', 'webhook', 'polling', 'manual', 'system')),
  external_reference text,
  provider_event_id text,
  failure_reason    text,
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists audit_logs (
  id                text primary key,
  owner_user_id     uuid references auth.users,
  actor_user_id     uuid references auth.users not null default auth.uid(),
  action            text not null,
  target_type       text not null,
  target_id         text,
  payload           jsonb default '{}'::jsonb,
  created_at        timestamptz default now()
);

create table if not exists billing_sequences (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function pk_next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
  current_year text := to_char(now(), 'YYYY');
begin
  insert into billing_sequences (key, value, updated_at)
  values ('invoice:' || current_year, 1, now())
  on conflict (key) do update set
    value = billing_sequences.value + 1,
    updated_at = now()
  returning value into next_value;

  return 'RE-' || current_year || '-' || lpad(next_value::text, 5, '0');
end;
$$;

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
alter table billing_payments enable row level security;
alter table buero_eingangsrechnungen enable row level security;
alter table buero_dokumente enable row level security;

create policy "buero_kunden_user"    on buero_kunden    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_angebote_user"  on buero_angebote  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_auftraege_user" on buero_auftraege for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_rechnungen_user" on buero_rechnungen for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "buero_rechnungen_owner_select" on buero_rechnungen for select using (pk_is_owner());
create policy "buero_rechnungen_owner_update" on buero_rechnungen for update using (pk_is_owner()) with check (pk_is_owner());
create policy "billing_payments_user" on billing_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "billing_payments_owner_select" on billing_payments for select using (pk_is_owner());
create policy "billing_payments_owner_update" on billing_payments for update using (pk_is_owner()) with check (pk_is_owner());
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
create index if not exists idx_buero_rechnungen_payment_link_id on buero_rechnungen(payment_link_id);
create index if not exists idx_buero_rechnungen_payment_link_reference on buero_rechnungen(payment_link_reference);
create index if not exists idx_billing_payments_invoice_provider on billing_payments(invoice_id, provider);

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
