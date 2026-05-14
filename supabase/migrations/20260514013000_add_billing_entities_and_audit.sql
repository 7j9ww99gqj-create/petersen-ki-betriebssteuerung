alter table buero_kunden
  add column if not exists auth_user_id uuid references auth.users,
  add column if not exists source text default 'manual',
  add column if not exists billing_subscription_id text unique,
  add column if not exists software_enabled boolean not null default false;

alter table buero_rechnungen
  add column if not exists billing_subscription_id text references billing_subscriptions(id),
  add column if not exists rechnungstyp text default 'standard',
  add column if not exists netto numeric default 0,
  add column if not exists steuer_satz numeric default 19,
  add column if not exists steuerbetrag numeric default 0,
  add column if not exists pdf_url text,
  add column if not exists payment_provider text,
  add column if not exists provider_ref text,
  add column if not exists auto_generated boolean not null default false,
  add column if not exists leistungszeitraum_von date,
  add column if not exists leistungszeitraum_bis date;

create table if not exists billing_payments (
  id                text primary key,
  user_id           uuid references auth.users not null default auth.uid(),
  customer_id       text references buero_kunden(id),
  billing_subscription_id text references billing_subscriptions(id),
  invoice_id        text references buero_rechnungen(id),
  provider          text not null default 'qonto',
  provider_ref      text,
  method            text default 'unknown',
  status            text not null default 'pending' check (status in ('pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled')),
  amount            numeric default 0,
  currency          text default 'EUR',
  booked_at         timestamptz,
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

alter table billing_payments enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "billing_payments_select" on billing_payments;
create policy "billing_payments_select" on billing_payments
  for select using (auth.uid() = user_id or pk_is_owner());

drop policy if exists "billing_payments_insert" on billing_payments;
create policy "billing_payments_insert" on billing_payments
  for insert with check (auth.uid() = user_id or pk_is_owner());

drop policy if exists "billing_payments_update" on billing_payments;
create policy "billing_payments_update" on billing_payments
  for update using (auth.uid() = user_id or pk_is_owner())
  with check (auth.uid() = user_id or pk_is_owner());

drop policy if exists "audit_logs_select" on audit_logs;
create policy "audit_logs_select" on audit_logs
  for select using (auth.uid() = actor_user_id or pk_is_owner());

drop policy if exists "audit_logs_insert" on audit_logs;
create policy "audit_logs_insert" on audit_logs
  for insert with check (auth.uid() = actor_user_id or pk_is_owner());

create index if not exists idx_buero_kunden_billing_subscription on buero_kunden(billing_subscription_id);
create index if not exists idx_buero_rechnungen_billing_subscription on buero_rechnungen(billing_subscription_id);
create index if not exists idx_billing_payments_subscription on billing_payments(billing_subscription_id, status);
create index if not exists idx_audit_logs_target on audit_logs(target_type, target_id, created_at desc);

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
