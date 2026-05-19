-- pg_trgm: fuzzy text search indexes für GlobalSearch
-- Ermöglicht ILIKE '%query%' in O(log n) statt O(n)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Lager
CREATE INDEX IF NOT EXISTS idx_trgm_lager_artikel_name
  ON lager_artikel USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_lager_artikel_lagerplatz
  ON lager_artikel USING GIN (lagerplatz gin_trgm_ops);

-- Büro Kunden
CREATE INDEX IF NOT EXISTS idx_trgm_buero_kunden_name
  ON buero_kunden USING GIN (name gin_trgm_ops);

-- Büro Rechnungen
CREATE INDEX IF NOT EXISTS idx_trgm_buero_rechnungen_nummer
  ON buero_rechnungen USING GIN (nummer gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_buero_rechnungen_kunde
  ON buero_rechnungen USING GIN (kunde gin_trgm_ops);

-- Werkstatt Karten (kein titel, nur beschreibung + auftragsnr)
CREATE INDEX IF NOT EXISTS idx_trgm_werkstatt_karten_beschreibung
  ON werkstatt_karten USING GIN (beschreibung gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_werkstatt_karten_auftragsnr
  ON werkstatt_karten USING GIN (auftragsnr gin_trgm_ops);
