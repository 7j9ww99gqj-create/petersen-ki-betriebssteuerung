-- Pondruff Price Config Tabelle (eine Zeile pro Inhaber).
-- Inhaber kann Faktoren/Preistabelle ohne Redeploy ändern.

create table if not exists pondruff_price_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table pondruff_price_config enable row level security;

drop policy if exists "pondruff_price_config_select" on pondruff_price_config;
create policy "pondruff_price_config_select" on pondruff_price_config
  for select using (auth.uid() = user_id);

drop policy if exists "pondruff_price_config_insert" on pondruff_price_config;
create policy "pondruff_price_config_insert" on pondruff_price_config
  for insert with check (auth.uid() = user_id);

drop policy if exists "pondruff_price_config_update" on pondruff_price_config;
create policy "pondruff_price_config_update" on pondruff_price_config
  for update using (auth.uid() = user_id);

drop policy if exists "pondruff_price_config_delete" on pondruff_price_config;
create policy "pondruff_price_config_delete" on pondruff_price_config
  for delete using (auth.uid() = user_id);
