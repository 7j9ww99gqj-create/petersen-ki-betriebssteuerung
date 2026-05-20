-- P0-5: pk_next_angebot_number atomar via billing_sequences
-- Analog zu pk_next_invoice_number

CREATE OR REPLACE FUNCTION pk_next_angebot_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_value bigint;
  current_year text := to_char(now(), 'YYYY');
BEGIN
  INSERT INTO billing_sequences (key, value, updated_at)
  VALUES ('angebot:' || current_year, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    value = billing_sequences.value + 1,
    updated_at = now()
  RETURNING value INTO next_value;

  RETURN 'ANG-' || current_year || '-' || lpad(next_value::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION pk_next_angebot_number() TO authenticated;

-- UNIQUE-Constraint damit Duplikate auf DB-Ebene verhindert werden
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buero_angebote_nummer_unique') THEN
    ALTER TABLE buero_angebote ADD CONSTRAINT buero_angebote_nummer_unique UNIQUE (nummer);
  END IF;
END $$;
