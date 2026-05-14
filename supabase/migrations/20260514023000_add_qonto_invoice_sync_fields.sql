alter table if exists buero_rechnungen
  add column if not exists payment_link_id text,
  add column if not exists payment_link_url text,
  add column if not exists payment_link_reference text,
  add column if not exists payment_link_status text default 'not_requested',
  add column if not exists payment_link_created_at timestamptz,
  add column if not exists payment_link_error text;

alter table if exists buero_rechnungen
  drop constraint if exists buero_rechnungen_payment_link_status_check;

alter table if exists buero_rechnungen
  add constraint buero_rechnungen_payment_link_status_check
  check (payment_link_status in ('not_requested', 'pending', 'ready', 'processing', 'paid', 'expired', 'cancelled', 'missing_config', 'failed'));

alter table if exists billing_payments
  add column if not exists last_synced_at timestamptz,
  add column if not exists status_source text default 'unknown',
  add column if not exists external_reference text,
  add column if not exists provider_event_id text;

alter table if exists billing_payments
  drop constraint if exists billing_payments_status_source_check;

alter table if exists billing_payments
  add constraint billing_payments_status_source_check
  check (status_source in ('unknown', 'payment_link', 'webhook', 'polling', 'manual', 'system'));

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
  normalized_source text := case when p_source in ('billing', 'qonto', 'buero_pilot', 'system') then p_source else 'system' end;
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

alter table if exists billing_payments enable row level security;

drop policy if exists "buero_rechnungen_owner_select" on buero_rechnungen;
create policy "buero_rechnungen_owner_select" on buero_rechnungen
  for select using (pk_is_owner());

drop policy if exists "buero_rechnungen_owner_update" on buero_rechnungen;
create policy "buero_rechnungen_owner_update" on buero_rechnungen
  for update using (pk_is_owner())
  with check (pk_is_owner());

drop policy if exists "billing_payments_user" on billing_payments;
create policy "billing_payments_user" on billing_payments
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "billing_payments_owner_select" on billing_payments;
create policy "billing_payments_owner_select" on billing_payments
  for select using (pk_is_owner());

drop policy if exists "billing_payments_owner_update" on billing_payments;
create policy "billing_payments_owner_update" on billing_payments
  for update using (pk_is_owner())
  with check (pk_is_owner());

create index if not exists idx_buero_rechnungen_payment_link_id on buero_rechnungen(payment_link_id);
create index if not exists idx_buero_rechnungen_payment_link_reference on buero_rechnungen(payment_link_reference);
create index if not exists idx_billing_payments_invoice_provider on billing_payments(invoice_id, provider);
