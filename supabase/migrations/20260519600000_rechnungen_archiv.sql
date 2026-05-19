-- GoBD: Rechnungen/Angebote als PDF unveränderlich archivieren
-- Bucket "rechnungen-archiv" + Pfad-/Hash-Spalten

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rechnungen-archiv', 'rechnungen-archiv', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rechnungen_archiv_select" on storage.objects;
drop policy if exists "rechnungen_archiv_insert" on storage.objects;
drop policy if exists "rechnungen_archiv_update" on storage.objects;
drop policy if exists "rechnungen_archiv_delete" on storage.objects;

create policy "rechnungen_archiv_select" on storage.objects for select
  using (bucket_id = 'rechnungen-archiv' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "rechnungen_archiv_insert" on storage.objects for insert
  with check (bucket_id = 'rechnungen-archiv' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "rechnungen_archiv_update" on storage.objects for update
  using (bucket_id = 'rechnungen-archiv' and (storage.foldername(name))[1] = auth.uid()::text);
-- KEIN DELETE-Policy für anon/auth: archivierte PDFs sind unveränderlich (GoBD)
-- Service-Role kann löschen (bypassed RLS)

alter table public.buero_rechnungen
  add column if not exists pdf_path text,
  add column if not exists pdf_hash text,
  add column if not exists pdf_archived_at timestamptz;

alter table public.buero_angebote
  add column if not exists pdf_path text,
  add column if not exists pdf_hash text,
  add column if not exists pdf_archived_at timestamptz;

comment on column public.buero_rechnungen.pdf_path is 'Pfad im Storage-Bucket rechnungen-archiv';
comment on column public.buero_rechnungen.pdf_hash is 'SHA-256 Hash für Manipulationsschutz';
comment on column public.buero_angebote.pdf_path is 'Pfad im Storage-Bucket rechnungen-archiv';
comment on column public.buero_angebote.pdf_hash is 'SHA-256 Hash für Manipulationsschutz';
