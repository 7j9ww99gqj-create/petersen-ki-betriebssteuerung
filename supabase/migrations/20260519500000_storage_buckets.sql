-- Storage Buckets für Petersen KI (alle privat, user-scoped RLS)
-- Buckets:
--   lager-bilder    → 1 Artikel-Bild pro Artikel (privat, signed URL)
--   ocr-originale   → Original-Belege aus document-ai (privat, GoBD-relevant)
--   firma-branding  → Logo + Briefkopf-Assets (privat, signed URL)
--   db-backups      → nightly DB-Dumps (privat, nur Service-Role)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lager-bilder',    'lager-bilder',    false, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('ocr-originale',   'ocr-originale',   false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('firma-branding',  'firma-branding',  false, 5242880,  array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('db-backups',      'db-backups',      false, 104857600, array['application/json','application/gzip','application/octet-stream'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop existing policies (idempotent)
drop policy if exists "lager_bilder_select" on storage.objects;
drop policy if exists "lager_bilder_insert" on storage.objects;
drop policy if exists "lager_bilder_update" on storage.objects;
drop policy if exists "lager_bilder_delete" on storage.objects;

drop policy if exists "ocr_originale_select" on storage.objects;
drop policy if exists "ocr_originale_insert" on storage.objects;
drop policy if exists "ocr_originale_update" on storage.objects;
drop policy if exists "ocr_originale_delete" on storage.objects;

drop policy if exists "firma_branding_select" on storage.objects;
drop policy if exists "firma_branding_insert" on storage.objects;
drop policy if exists "firma_branding_update" on storage.objects;
drop policy if exists "firma_branding_delete" on storage.objects;

drop policy if exists "db_backups_service_only" on storage.objects;

-- Pfad-Konvention: <bucket>/<user_id>/<rest...>
-- → erstes Pfadsegment muss user_id des authentifizierten Nutzers sein

-- lager-bilder
create policy "lager_bilder_select" on storage.objects for select
  using (bucket_id = 'lager-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lager_bilder_insert" on storage.objects for insert
  with check (bucket_id = 'lager-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lager_bilder_update" on storage.objects for update
  using (bucket_id = 'lager-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "lager_bilder_delete" on storage.objects for delete
  using (bucket_id = 'lager-bilder' and (storage.foldername(name))[1] = auth.uid()::text);

-- ocr-originale
create policy "ocr_originale_select" on storage.objects for select
  using (bucket_id = 'ocr-originale' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ocr_originale_insert" on storage.objects for insert
  with check (bucket_id = 'ocr-originale' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ocr_originale_update" on storage.objects for update
  using (bucket_id = 'ocr-originale' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ocr_originale_delete" on storage.objects for delete
  using (bucket_id = 'ocr-originale' and (storage.foldername(name))[1] = auth.uid()::text);

-- firma-branding
create policy "firma_branding_select" on storage.objects for select
  using (bucket_id = 'firma-branding' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "firma_branding_insert" on storage.objects for insert
  with check (bucket_id = 'firma-branding' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "firma_branding_update" on storage.objects for update
  using (bucket_id = 'firma-branding' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "firma_branding_delete" on storage.objects for delete
  using (bucket_id = 'firma-branding' and (storage.foldername(name))[1] = auth.uid()::text);

-- db-backups: kein anon/auth-Zugriff, nur Service-Role kann lesen/schreiben
-- (keine Policy = standardmäßig blockiert für anon/auth, Service-Role bypassed RLS)
