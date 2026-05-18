-- Performance-Indizes für alle Haupttabellen
-- Ausgeführt: 2026-05-19

-- Lager
CREATE INDEX IF NOT EXISTS idx_lager_artikel_user_id ON lager_artikel(user_id);
CREATE INDEX IF NOT EXISTS idx_lager_artikel_status ON lager_artikel(status);
CREATE INDEX IF NOT EXISTS idx_lager_bewegungen_user_id ON lager_bewegungen(user_id);
CREATE INDEX IF NOT EXISTS idx_lager_bewegungen_datum ON lager_bewegungen(datum DESC);
CREATE INDEX IF NOT EXISTS idx_lager_stellplaetze_user_id ON lager_stellplaetze(user_id);
CREATE INDEX IF NOT EXISTS idx_lager_stellplatz_bestand_user_id ON lager_stellplatz_bestand(user_id);

-- Büro
CREATE INDEX IF NOT EXISTS idx_buero_rechnungen_user_id ON buero_rechnungen(user_id);
CREATE INDEX IF NOT EXISTS idx_buero_rechnungen_status ON buero_rechnungen(status);
CREATE INDEX IF NOT EXISTS idx_buero_kunden_user_id ON buero_kunden(user_id);
CREATE INDEX IF NOT EXISTS idx_buero_angebote_user_id ON buero_angebote(user_id);
CREATE INDEX IF NOT EXISTS idx_buero_auftraege_user_id ON buero_auftraege(user_id);
CREATE INDEX IF NOT EXISTS idx_buero_auftraege_status ON buero_auftraege(status);
CREATE INDEX IF NOT EXISTS idx_buero_eingangsrechnungen_user_id ON buero_eingangsrechnungen(user_id);
CREATE INDEX IF NOT EXISTS idx_buero_dokumente_user_id ON buero_dokumente(user_id);

-- Werkstatt
CREATE INDEX IF NOT EXISTS idx_werkstatt_karten_user_id ON werkstatt_karten(user_id);
CREATE INDEX IF NOT EXISTS idx_werkstatt_karten_status ON werkstatt_karten(status);

-- Marketing / Planung / Steuer
CREATE INDEX IF NOT EXISTS idx_marketing_kampagnen_user_id ON marketing_kampagnen(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_user_id ON marketing_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_planung_projekte_user_id ON planung_projekte(user_id);
CREATE INDEX IF NOT EXISTS idx_planung_aufgaben_user_id ON planung_aufgaben(user_id);
CREATE INDEX IF NOT EXISTS idx_steuer_belege_user_id ON steuer_belege(user_id);

-- Cloud / Messages
CREATE INDEX IF NOT EXISTS idx_cloud_backups_user_id ON cloud_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_backups_created_at ON cloud_backups(created_at DESC);
-- Note: user_messages indexes skipped (columns recipient_id/sender_id not yet in schema)
-- CREATE INDEX IF NOT EXISTS idx_user_messages_recipient_id ON user_messages(recipient_id);
-- CREATE INDEX IF NOT EXISTS idx_user_messages_sender_id ON user_messages(sender_id);
