-- Idempotenz fuer Stripe-Webhook-Retries.
-- Stripe wiederholt Webhooks bis zu 3 Tage lang. Diese Tabelle haelt jede
-- bereits verarbeitete event.id genau einmal, damit Audit-Log und
-- Payment-Tracking nicht doppelt geschrieben werden.

create table if not exists stripe_webhook_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;

-- Nur Service Role schreibt/liest; kein Client-Zugriff.
drop policy if exists "stripe_webhook_events service" on stripe_webhook_events;
create policy "stripe_webhook_events service" on stripe_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_stripe_webhook_events_received_at
  on stripe_webhook_events (received_at desc);
