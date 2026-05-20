-- QM-Pilot Schema (Phase 1)
-- 4 Tabellen + RLS + 2 Storage-Buckets (qm-zeichnungen, qm-fotos)

-- ============================================================
-- Tabellen
-- ============================================================

create table if not exists qm_zeichnungen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  zeichnungsnummer text,
  revision text,
  datei_pfad text,
  material text,
  oberflaeche_anforderung text,
  beschichtung text,
  sonderanforderungen text[],
  ki_konfidenz integer,
  erkannte_masse jsonb,
  erstellt_am timestamptz not null default now()
);

create index if not exists qm_zeichnungen_user_id_idx on qm_zeichnungen(user_id);
create index if not exists qm_zeichnungen_erstellt_am_idx on qm_zeichnungen(erstellt_am desc);

create table if not exists qm_pruefberichte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  zeichnung_id uuid references qm_zeichnungen(id) on delete set null,
  pruefbericht_nr text not null,
  bauteil_id text,
  chargennummer text,
  anzahl_geprueft integer default 1,
  pruef_datum date default current_date,
  pruefer_name text,
  gesamtstatus text check (gesamtstatus in ('bestanden','nachbesserung','ausschuss','offen')),
  bemerkungen text,
  unterschrift_initialen text,
  gesperrt boolean default false,
  erstellt_am timestamptz not null default now(),
  unique (user_id, pruefbericht_nr)
);

create index if not exists qm_pruefberichte_user_id_idx on qm_pruefberichte(user_id);
create index if not exists qm_pruefberichte_zeichnung_id_idx on qm_pruefberichte(zeichnung_id);
create index if not exists qm_pruefberichte_pruef_datum_idx on qm_pruefberichte(pruef_datum desc);

create table if not exists qm_messwerte (
  id uuid primary key default gen_random_uuid(),
  pruefbericht_id uuid not null references qm_pruefberichte(id) on delete cascade,
  messstelle text not null,
  sollwert numeric,
  toleranz_plus numeric,
  toleranz_minus numeric,
  istwert numeric,
  abweichung numeric generated always as (istwert - sollwert) stored,
  einheit text default 'mm',
  status text check (status in ('gruen','orange','rot','offen')),
  pruefmittel text,
  reihenfolge integer default 0
);

create index if not exists qm_messwerte_pruefbericht_id_idx on qm_messwerte(pruefbericht_id);

create table if not exists qm_fotos (
  id uuid primary key default gen_random_uuid(),
  pruefbericht_id uuid not null references qm_pruefberichte(id) on delete cascade,
  typ text check (typ in ('gesamt','detail','oberflaeche','referenz')),
  datei_pfad text not null,
  beschreibung text,
  erstellt_am timestamptz not null default now()
);

create index if not exists qm_fotos_pruefbericht_id_idx on qm_fotos(pruefbericht_id);

-- ============================================================
-- RLS
-- ============================================================

alter table qm_zeichnungen enable row level security;
alter table qm_pruefberichte enable row level security;
alter table qm_messwerte enable row level security;
alter table qm_fotos enable row level security;

drop policy if exists "qm_zeichnungen_owner_all" on qm_zeichnungen;
create policy "qm_zeichnungen_owner_all" on qm_zeichnungen
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "qm_pruefberichte_owner_all" on qm_pruefberichte;
create policy "qm_pruefberichte_owner_all" on qm_pruefberichte
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "qm_messwerte_owner_all" on qm_messwerte;
create policy "qm_messwerte_owner_all" on qm_messwerte
  for all using (
    exists (select 1 from qm_pruefberichte p where p.id = qm_messwerte.pruefbericht_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from qm_pruefberichte p where p.id = qm_messwerte.pruefbericht_id and p.user_id = auth.uid())
  );

drop policy if exists "qm_fotos_owner_all" on qm_fotos;
create policy "qm_fotos_owner_all" on qm_fotos
  for all using (
    exists (select 1 from qm_pruefberichte p where p.id = qm_fotos.pruefbericht_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from qm_pruefberichte p where p.id = qm_fotos.pruefbericht_id and p.user_id = auth.uid())
  );

-- ============================================================
-- Storage Buckets (privat, user-scoped via Path-Prefix)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('qm-zeichnungen', 'qm-zeichnungen', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('qm-fotos',       'qm-fotos',       false,  5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "qm_zeichnungen_select" on storage.objects;
drop policy if exists "qm_zeichnungen_insert" on storage.objects;
drop policy if exists "qm_zeichnungen_update" on storage.objects;
drop policy if exists "qm_zeichnungen_delete" on storage.objects;
drop policy if exists "qm_fotos_select" on storage.objects;
drop policy if exists "qm_fotos_insert" on storage.objects;
drop policy if exists "qm_fotos_update" on storage.objects;
drop policy if exists "qm_fotos_delete" on storage.objects;

create policy "qm_zeichnungen_select" on storage.objects for select
  using (bucket_id = 'qm-zeichnungen' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "qm_zeichnungen_insert" on storage.objects for insert
  with check (bucket_id = 'qm-zeichnungen' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "qm_zeichnungen_update" on storage.objects for update
  using (bucket_id = 'qm-zeichnungen' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "qm_zeichnungen_delete" on storage.objects for delete
  using (bucket_id = 'qm-zeichnungen' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "qm_fotos_select" on storage.objects for select
  using (bucket_id = 'qm-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "qm_fotos_insert" on storage.objects for insert
  with check (bucket_id = 'qm-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "qm_fotos_update" on storage.objects for update
  using (bucket_id = 'qm-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "qm_fotos_delete" on storage.objects for delete
  using (bucket_id = 'qm-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
