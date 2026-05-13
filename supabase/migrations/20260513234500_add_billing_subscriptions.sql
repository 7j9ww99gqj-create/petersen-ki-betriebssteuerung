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
  next_payment   date,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(user_id)
);

alter table billing_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'billing_subscriptions_user'
  ) then
    create policy "billing_subscriptions_user" on billing_subscriptions
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_billing_subscriptions_user_status on billing_subscriptions(user_id, status);
