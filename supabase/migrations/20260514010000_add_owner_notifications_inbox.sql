create table if not exists owner_event_inbox (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid references auth.users not null,
  source         text not null check (source in ('billing', 'qonto', 'buero_pilot', 'system')),
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
  source         text not null check (source in ('billing', 'qonto', 'buero_pilot', 'system')),
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

drop policy if exists "owner_event_inbox_select" on owner_event_inbox;
create policy "owner_event_inbox_select" on owner_event_inbox
  for select using (pk_is_owner());

drop policy if exists "owner_notifications_select" on owner_notifications;
create policy "owner_notifications_select" on owner_notifications
  for select using (pk_is_owner());

drop policy if exists "owner_notifications_update" on owner_notifications;
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

drop trigger if exists trg_sync_billing_subscription_to_owner_notifications on billing_subscriptions;
create trigger trg_sync_billing_subscription_to_owner_notifications
after insert or update on billing_subscriptions
for each row execute function sync_billing_subscription_to_owner_notifications();
