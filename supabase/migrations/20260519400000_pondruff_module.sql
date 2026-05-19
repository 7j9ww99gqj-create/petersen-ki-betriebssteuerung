-- Pondruff-Modul: separate Tabellen mit Prefix pondruff_*
-- Komplett gated auf user_id = info@pondruffpolierservice.de (per RLS auth.uid())
-- Rollback: DROP TABLE pondruff_*; supabase storage bucket pondruff loeschen

create table if not exists pondruff_preisauftraege (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(),
  created_at timestamp with time zone default now(),
  order_id text,
  customer text,
  project text,
  purchase_order text,
  total numeric default 0,
  positions jsonb default '[]'::jsonb,
  rows jsonb default '[]'::jsonb
);

alter table pondruff_preisauftraege enable row level security;
drop policy if exists "pondruff_preise_select_own" on pondruff_preisauftraege;
drop policy if exists "pondruff_preise_insert_own" on pondruff_preisauftraege;
drop policy if exists "pondruff_preise_update_own" on pondruff_preisauftraege;
drop policy if exists "pondruff_preise_delete_own" on pondruff_preisauftraege;
create policy "pondruff_preise_select_own" on pondruff_preisauftraege for select to authenticated using (user_id = auth.uid());
create policy "pondruff_preise_insert_own" on pondruff_preisauftraege for insert to authenticated with check (user_id = auth.uid());
create policy "pondruff_preise_update_own" on pondruff_preisauftraege for update to authenticated using (user_id = auth.uid());
create policy "pondruff_preise_delete_own" on pondruff_preisauftraege for delete to authenticated using (user_id = auth.uid());

create table if not exists pondruff_wareneingaenge (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(),
  created_at timestamp with time zone default now(),
  delivery_id text,
  customer text,
  operator text,
  status text default 'offen',
  receipt_url text,
  parts_url text,
  packaging_url text,
  ai_data jsonb,
  note text
);

alter table pondruff_wareneingaenge enable row level security;
drop policy if exists "pondruff_we_select_own" on pondruff_wareneingaenge;
drop policy if exists "pondruff_we_insert_own" on pondruff_wareneingaenge;
drop policy if exists "pondruff_we_update_own" on pondruff_wareneingaenge;
drop policy if exists "pondruff_we_delete_own" on pondruff_wareneingaenge;
create policy "pondruff_we_select_own" on pondruff_wareneingaenge for select to authenticated using (user_id = auth.uid());
create policy "pondruff_we_insert_own" on pondruff_wareneingaenge for insert to authenticated with check (user_id = auth.uid());
create policy "pondruff_we_update_own" on pondruff_wareneingaenge for update to authenticated using (user_id = auth.uid());
create policy "pondruff_we_delete_own" on pondruff_wareneingaenge for delete to authenticated using (user_id = auth.uid());

create index if not exists pondruff_preise_user_idx on pondruff_preisauftraege(user_id, created_at desc);
create index if not exists pondruff_we_user_idx on pondruff_wareneingaenge(user_id, created_at desc);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('pondruff', 'pondruff', false)
on conflict (id) do nothing;

drop policy if exists "pondruff_storage_select_own" on storage.objects;
drop policy if exists "pondruff_storage_insert_own" on storage.objects;
drop policy if exists "pondruff_storage_delete_own" on storage.objects;
create policy "pondruff_storage_select_own" on storage.objects for select to authenticated using (bucket_id = 'pondruff' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pondruff_storage_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'pondruff' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pondruff_storage_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'pondruff' and (storage.foldername(name))[1] = auth.uid()::text);
