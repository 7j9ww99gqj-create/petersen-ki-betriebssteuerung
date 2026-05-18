-- Tabelle für Beleg-Uploads mit Kategorie-Unterstützung
create table if not exists steuer_belege_uploads (
  id           text primary key,
  user_id      uuid references auth.users default auth.uid(),
  kategorie    text not null default 'Sonstiges',
  datei_url    text,
  betrag       numeric(12,2),
  datum        date,
  notiz        text,
  created_at   timestamptz default now()
);

-- RLS
alter table steuer_belege_uploads enable row level security;

drop policy if exists "steuer_belege_uploads_select" on steuer_belege_uploads;
drop policy if exists "steuer_belege_uploads_insert" on steuer_belege_uploads;
drop policy if exists "steuer_belege_uploads_update" on steuer_belege_uploads;
drop policy if exists "steuer_belege_uploads_delete" on steuer_belege_uploads;

create policy "steuer_belege_uploads_select" on steuer_belege_uploads for select using (auth.uid() = user_id);
create policy "steuer_belege_uploads_insert" on steuer_belege_uploads for insert with check (auth.uid() = user_id);
create policy "steuer_belege_uploads_update" on steuer_belege_uploads for update using (auth.uid() = user_id);
create policy "steuer_belege_uploads_delete" on steuer_belege_uploads for delete using (auth.uid() = user_id);

-- Storage-Bucket (falls noch nicht vorhanden; ignoriert Fehler falls schon da)
insert into storage.buckets (id, name, public)
values ('steuer-belege', 'steuer-belege', false)
on conflict (id) do nothing;

-- Storage-Policies
drop policy if exists "steuer_belege_upload_insert" on storage.objects;
drop policy if exists "steuer_belege_upload_select" on storage.objects;
drop policy if exists "steuer_belege_upload_delete" on storage.objects;

create policy "steuer_belege_upload_insert" on storage.objects
  for insert with check (bucket_id = 'steuer-belege' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "steuer_belege_upload_select" on storage.objects
  for select using (bucket_id = 'steuer-belege' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "steuer_belege_upload_delete" on storage.objects
  for delete using (bucket_id = 'steuer-belege' and auth.uid()::text = (storage.foldername(name))[1]);
