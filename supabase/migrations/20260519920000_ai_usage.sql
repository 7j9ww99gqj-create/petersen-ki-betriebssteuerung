-- OpenAI-Usage-Tracking pro User: für Cost-Cockpit pro Nutzer
create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  route         text not null,
  model         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_eur      numeric(10, 6) not null default 0,
  cached        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_time
  on public.ai_usage (user_id, created_at desc);

create index if not exists idx_ai_usage_time
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "user_only_select" on public.ai_usage;
create policy "user_only_select" on public.ai_usage
  for select using (auth.uid() = user_id);

-- Insert via Service-Role (Server-Side nach OpenAI-Call); kein direkter User-Insert nötig
