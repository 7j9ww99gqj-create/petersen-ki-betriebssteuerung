alter table buero_auftraege
  add column if not exists billing_subscription_id text references billing_subscriptions(id);

create index if not exists idx_buero_auftraege_billing_subscription_id
  on buero_auftraege(billing_subscription_id);

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
  customer_id text;
  order_id text;
  order_label text;
begin
  select id into owner_user_id
  from auth.users
  where lower(email) = 'info@petersen-ki-pilot.de'
  limit 1;

  if owner_user_id is null then
    return new;
  end if;

  customer_id := 'BILL-' || new.id;
  order_id := 'AUF-' || new.id;
  order_label := coalesce(nullif(new.package_id, ''), array_to_string(new.pilot_ids, ', '), 'Abo-Buchung');

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
    customer_id,
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

  insert into public.buero_auftraege (
    id, user_id, kunde_id, billing_subscription_id, kunde, beschreibung, wert, start, status, fortschritt, updated_at
  ) values (
    order_id,
    owner_user_id,
    customer_id,
    new.id,
    customer_name,
    'Abo-Buchung ' || order_label,
    coalesce(new.monthly_price::text || ' € / Monat', 'auf Anfrage'),
    to_char(coalesce(new.created_at, now()), 'DD.MM.YYYY'),
    case when coalesce(new.software_enabled, false) then 'In Bearbeitung' else 'Geplant' end,
    case when coalesce(new.software_enabled, false) then 25 else 0 end,
    now()
  )
  on conflict (id) do update set
    kunde_id = excluded.kunde_id,
    billing_subscription_id = excluded.billing_subscription_id,
    kunde = excluded.kunde,
    beschreibung = excluded.beschreibung,
    wert = excluded.wert,
    status = excluded.status,
    fortschritt = excluded.fortschritt,
    updated_at = now();

  return new;
end;
$$;
