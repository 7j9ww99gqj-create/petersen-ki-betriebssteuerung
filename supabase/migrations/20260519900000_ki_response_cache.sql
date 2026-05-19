-- KI-Response-Cache pro User: spart OpenAI-Aufrufe für identische Anfragen
-- (z.B. Tagesbericht, der mehrfach am Tag aufgerufen wird)

create table if not exists public.ki_response_cache (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cache_key   text not null,
  response    jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  unique (user_id, cache_key)
);

create index if not exists idx_ki_response_cache_lookup
  on public.ki_response_cache (user_id, cache_key, expires_at);

create index if not exists idx_ki_response_cache_expires
  on public.ki_response_cache (expires_at);

alter table public.ki_response_cache enable row level security;

drop policy if exists "user_only_select" on public.ki_response_cache;
create policy "user_only_select" on public.ki_response_cache
  for select using (auth.uid() = user_id);

drop policy if exists "user_only_insert" on public.ki_response_cache;
create policy "user_only_insert" on public.ki_response_cache
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_only_delete" on public.ki_response_cache;
create policy "user_only_delete" on public.ki_response_cache
  for delete using (auth.uid() = user_id);
