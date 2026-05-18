-- WerkstattPilot: echte FK zu BüroPilot Aufträgen
-- auftragsnr bleibt als freier Text für Rückwärtskompatibilität
-- buero_auftrag_id ist optional und verknüpft strukturell mit buero_auftraege

ALTER TABLE werkstatt_karten
  ADD COLUMN IF NOT EXISTS buero_auftrag_id text REFERENCES buero_auftraege(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_werkstatt_karten_buero_auftrag_id
  ON werkstatt_karten(buero_auftrag_id);
