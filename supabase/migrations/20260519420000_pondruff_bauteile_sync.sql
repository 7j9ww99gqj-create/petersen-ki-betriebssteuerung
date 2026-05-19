-- Pondruff: Bauteil-KI + Sync-Spalten zum BüroPilot
-- Rollback: drop table pondruff_bauteile; alter table pondruff_* drop column synced_*;

create table if not exists pondruff_bauteile (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(),
  created_at timestamp with time zone default now(),
  customer text,
  delivery_id text,
  article_no text,
  description text,
  image_url text not null,
  wareneingang_id uuid references pondruff_wareneingaenge(id) on delete set null,
  preisauftrag_id uuid references pondruff_preisauftraege(id) on delete set null,
  note text
);

alter table pondruff_bauteile enable row level security;
drop policy if exists "pondruff_bt_select" on pondruff_bauteile;
drop policy if exists "pondruff_bt_insert" on pondruff_bauteile;
drop policy if exists "pondruff_bt_update" on pondruff_bauteile;
drop policy if exists "pondruff_bt_delete" on pondruff_bauteile;
create policy "pondruff_bt_select" on pondruff_bauteile for select to authenticated using (user_id = auth.uid());
create policy "pondruff_bt_insert" on pondruff_bauteile for insert to authenticated with check (user_id = auth.uid());
create policy "pondruff_bt_update" on pondruff_bauteile for update to authenticated using (user_id = auth.uid());
create policy "pondruff_bt_delete" on pondruff_bauteile for delete to authenticated using (user_id = auth.uid());
create index if not exists pondruff_bt_user_idx on pondruff_bauteile(user_id, created_at desc);

-- Sync-Spalten: Pondruff -> BüroPilot
alter table pondruff_preisauftraege
  add column if not exists synced_buero_auftrag_id text,
  add column if not exists synced_buero_at timestamp with time zone,
  add column if not exists synced_wiso_at timestamp with time zone,
  add column if not exists synced_wiso_response jsonb;

alter table pondruff_wareneingaenge
  add column if not exists synced_buero_dokument_id text,
  add column if not exists synced_buero_at timestamp with time zone;
