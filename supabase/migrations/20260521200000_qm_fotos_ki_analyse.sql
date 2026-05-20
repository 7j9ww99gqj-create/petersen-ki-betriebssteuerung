-- Phase 2 QM: KI-Sichtprüfung — Ergebnis als JSONB an qm_fotos hängen
ALTER TABLE qm_fotos
  ADD COLUMN IF NOT EXISTS ki_analyse_ergebnis jsonb;
