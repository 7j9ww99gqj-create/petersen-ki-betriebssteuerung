alter table if exists owner_event_inbox
  drop constraint if exists owner_event_inbox_source_check;

alter table if exists owner_event_inbox
  add constraint owner_event_inbox_source_check
  check (source in ('billing', 'qonto', 'stripe', 'buero_pilot', 'system'));

alter table if exists owner_notifications
  drop constraint if exists owner_notifications_source_check;

alter table if exists owner_notifications
  add constraint owner_notifications_source_check
  check (source in ('billing', 'qonto', 'stripe', 'buero_pilot', 'system'));

alter table if exists billing_payments
  alter column provider set default 'stripe';

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
