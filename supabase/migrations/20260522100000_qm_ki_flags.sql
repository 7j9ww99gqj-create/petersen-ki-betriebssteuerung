ALTER TABLE firma_einstellungen
  ADD COLUMN IF NOT EXISTS qm_ki_zeichnungs_analyse boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS qm_ki_sichtpruefung boolean DEFAULT false;
