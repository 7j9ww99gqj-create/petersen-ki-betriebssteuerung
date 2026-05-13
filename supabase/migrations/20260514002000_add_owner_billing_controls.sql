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

alter table billing_subscriptions
  add column if not exists software_enabled boolean not null default false;

drop policy if exists "billing_subscriptions_user" on billing_subscriptions;
drop policy if exists "billing_subscriptions_select" on billing_subscriptions;
drop policy if exists "billing_subscriptions_insert" on billing_subscriptions;
drop policy if exists "billing_subscriptions_update" on billing_subscriptions;

create policy "billing_subscriptions_select" on billing_subscriptions
  for select using (auth.uid() = user_id or pk_is_owner());

create policy "billing_subscriptions_insert" on billing_subscriptions
  for insert with check (auth.uid() = user_id or pk_is_owner());

create policy "billing_subscriptions_update" on billing_subscriptions
  for update using (auth.uid() = user_id or pk_is_owner())
  with check (auth.uid() = user_id or pk_is_owner());

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
    id, user_id, name, typ, ansprechpartner, email, umsatz, status, updated_at
  ) values (
    'BILL-' || new.id,
    owner_user_id,
    customer_name,
    'SaaS-Kunde',
    customer_name,
    new.user_email,
    coalesce(new.monthly_price::text, 'auf Anfrage'),
    customer_status,
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    ansprechpartner = excluded.ansprechpartner,
    email = excluded.email,
    umsatz = excluded.umsatz,
    status = excluded.status,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_billing_subscription_to_owner_customer on billing_subscriptions;
create trigger trg_sync_billing_subscription_to_owner_customer
after insert or update on billing_subscriptions
for each row execute function sync_billing_subscription_to_owner_customer();

update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"Inhaber"}'::jsonb,
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"Inhaber"}'::jsonb
where lower(email) = 'info@petersen-ki-pilot.de';
