-- Artikel-Bild: 1 Bild pro Artikel (Pfad im Storage-Bucket "lager-bilder")
alter table public.lager_artikel
  add column if not exists bild_path text;

comment on column public.lager_artikel.bild_path is
  'Pfad im Storage-Bucket lager-bilder, Konvention: <user_id>/<artikel_id>.<ext>';
