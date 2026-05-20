-- QM Messmittel-Kalibrierungs-Tracking (ISO 9001 §7.1.5)
CREATE TABLE IF NOT EXISTS qm_messmittel (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid REFERENCES auth.users DEFAULT auth.uid(),
  name                        text NOT NULL,
  seriennummer                text,
  hersteller                  text,
  typ                         text,
  messbereich                 text,
  aufloesung                  text,
  kalibriert_am               date,
  kalibrierung_faellig_am     date,
  kalibrierungs_intervall_tage integer DEFAULT 365,
  status                      text CHECK (status IN ('ok','faellig','ueberfaellig')) DEFAULT 'ok',
  notiz                       text,
  aktiv                       boolean DEFAULT true,
  erstellt_am                 timestamptz DEFAULT now()
);

ALTER TABLE qm_messmittel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm_messmittel_select" ON qm_messmittel FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "qm_messmittel_insert" ON qm_messmittel FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "qm_messmittel_update" ON qm_messmittel FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "qm_messmittel_delete" ON qm_messmittel FOR DELETE USING (auth.uid() = user_id);
