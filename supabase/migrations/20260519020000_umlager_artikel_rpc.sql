-- Atomare Umlagerungs-Transaktion als Supabase RPC
-- Ersetzt 4 sequenzielle awaits ohne Rollback in lib/db.ts
-- Alle 4 Schritte laufen in einer Datenbank-Transaktion

CREATE OR REPLACE FUNCTION umlager_artikel(
  p_von_bestand_id TEXT,
  p_nach_stellplatz_id TEXT,
  p_menge NUMERIC,
  p_charge TEXT DEFAULT NULL,
  p_mhd TEXT DEFAULT NULL,
  p_grund TEXT DEFAULT NULL,
  p_notiz TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_von RECORD;
  v_ziel RECORD;
  v_uml_id TEXT;
BEGIN
  -- 1. Quell-Bestand laden und sperren (FOR UPDATE verhindert Race Conditions)
  SELECT * INTO v_von
  FROM lager_stellplatz_bestand
  WHERE id = p_von_bestand_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quell-Bestand nicht gefunden: %', p_von_bestand_id;
  END IF;

  IF v_von.menge < p_menge THEN
    RAISE EXCEPTION 'Nur % % verfügbar', v_von.menge, COALESCE(v_von.einheit, 'Stk');
  END IF;

  -- 2. Quell-Menge reduzieren oder Datensatz löschen
  IF v_von.menge = p_menge THEN
    DELETE FROM lager_stellplatz_bestand WHERE id = p_von_bestand_id;
  ELSE
    UPDATE lager_stellplatz_bestand
    SET menge = menge - p_menge
    WHERE id = p_von_bestand_id;
  END IF;

  -- 3. Ziel-Bestand suchen (gleicher Artikel + Charge am Ziel-Stellplatz)
  SELECT * INTO v_ziel
  FROM lager_stellplatz_bestand
  WHERE stellplatz_id = p_nach_stellplatz_id
    AND COALESCE(artikelnummer, '') = COALESCE(v_von.artikelnummer, '')
    AND COALESCE(charge, '') = COALESCE(COALESCE(p_charge, v_von.charge), '')
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE lager_stellplatz_bestand
    SET menge = menge + p_menge
    WHERE id = v_ziel.id;
  ELSE
    INSERT INTO lager_stellplatz_bestand (
      id, stellplatz_id, artikel_id, artikelnummer, artikelname,
      charge, mhd, menge, einheit, status, eingelagert_am
    ) VALUES (
      gen_random_uuid()::text,
      p_nach_stellplatz_id,
      v_von.artikel_id,
      v_von.artikelnummer,
      v_von.artikelname,
      COALESCE(p_charge, v_von.charge),
      COALESCE(p_mhd, v_von.mhd),
      p_menge,
      v_von.einheit,
      'Verfügbar',
      CURRENT_DATE::text
    );
  END IF;

  -- 4. Umlagerung dokumentieren
  v_uml_id := 'UML-' || upper(to_hex(extract(epoch from now())::bigint));
  INSERT INTO lager_umlagerungen (
    id, artikel_id, artikelnummer, artikelname,
    von_stellplatz_id, nach_stellplatz_id,
    charge, mhd, menge, grund, notiz, datum
  ) VALUES (
    v_uml_id,
    v_von.artikel_id,
    v_von.artikelnummer,
    v_von.artikelname,
    v_von.stellplatz_id,
    p_nach_stellplatz_id,
    COALESCE(p_charge, v_von.charge),
    COALESCE(p_mhd, v_von.mhd),
    p_menge,
    p_grund,
    p_notiz,
    now()
  );

  RETURN jsonb_build_object('success', true, 'umlagerung_id', v_uml_id);
END;
$$;

-- Nur eingeloggte User dürfen die Funktion aufrufen
REVOKE ALL ON FUNCTION umlager_artikel FROM PUBLIC;
GRANT EXECUTE ON FUNCTION umlager_artikel TO authenticated;
