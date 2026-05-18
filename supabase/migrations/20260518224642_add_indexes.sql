-- Performance-Indexes für häufig gefilterte Spalten
CREATE INDEX IF NOT EXISTS idx_buero_rechnungen_status ON buero_rechnungen(status);
CREATE INDEX IF NOT EXISTS idx_buero_rechnungen_faellig ON buero_rechnungen(faellig);
CREATE INDEX IF NOT EXISTS idx_buero_angebote_status ON buero_angebote(status);
CREATE INDEX IF NOT EXISTS idx_buero_auftraege_status ON buero_auftraege(status);
CREATE INDEX IF NOT EXISTS idx_lager_artikel_status ON lager_artikel(status);
CREATE INDEX IF NOT EXISTS idx_lager_stellplatz_bestand_mhd ON lager_stellplatz_bestand(mhd);
CREATE INDEX IF NOT EXISTS idx_buero_kunden_status ON buero_kunden(status);
CREATE INDEX IF NOT EXISTS idx_werkstatt_karten_status ON werkstatt_karten(status);
