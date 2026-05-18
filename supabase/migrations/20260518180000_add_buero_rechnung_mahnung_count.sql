-- mahnung_count: Zählt wie viele Mahnungen für eine Rechnung erstellt wurden
ALTER TABLE buero_rechnungen ADD COLUMN IF NOT EXISTS mahnung_count integer DEFAULT 0;
