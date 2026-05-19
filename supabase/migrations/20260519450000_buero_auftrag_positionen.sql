-- buero_auftraege.positionen jsonb — analog zu buero_angebote und buero_rechnungen.
-- Wird vom Pondruff-Sync (sync-buero-auftrag) befuellt; AuftraegeTab uebernimmt
-- die Positionen beim Workflow Auftrag → Rechnung.
-- Rollback: alter table buero_auftraege drop column if exists positionen;

alter table buero_auftraege
  add column if not exists positionen jsonb default '[]'::jsonb;
