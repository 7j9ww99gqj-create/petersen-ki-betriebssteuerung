-- Dual-Layer-Bestandssync:
-- Hält lager_artikel.bestand automatisch synchron mit der Summe aus lager_stellplatz_bestand
-- Wird bei INSERT, UPDATE, DELETE auf lager_stellplatz_bestand ausgelöst

CREATE OR REPLACE FUNCTION sync_lager_artikel_bestand()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_artikel_id TEXT;
  v_neue_summe NUMERIC;
BEGIN
  -- Betroffene artikel_id bestimmen (NEW bei INSERT/UPDATE, OLD bei DELETE)
  IF TG_OP = 'DELETE' THEN
    v_artikel_id := OLD.artikel_id;
  ELSE
    v_artikel_id := NEW.artikel_id;
  END IF;

  -- Nur wenn artikel_id bekannt ist
  IF v_artikel_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Neue Gesamtmenge über alle Stellplätze berechnen
  SELECT COALESCE(SUM(menge), 0)
  INTO v_neue_summe
  FROM lager_stellplatz_bestand
  WHERE artikel_id = v_artikel_id;

  -- lager_artikel.bestand aktualisieren
  UPDATE lager_artikel
  SET bestand = v_neue_summe
  WHERE id = v_artikel_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger auf lager_stellplatz_bestand
DROP TRIGGER IF EXISTS trg_sync_bestand ON lager_stellplatz_bestand;

CREATE TRIGGER trg_sync_bestand
AFTER INSERT OR UPDATE OR DELETE ON lager_stellplatz_bestand
FOR EACH ROW EXECUTE FUNCTION sync_lager_artikel_bestand();
