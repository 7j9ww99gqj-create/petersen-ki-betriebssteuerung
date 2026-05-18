-- Add workflow columns
ALTER TABLE buero_angebote
  ADD COLUMN IF NOT EXISTS nummer VARCHAR(50),
  ADD COLUMN IF NOT EXISTS verschickt_am DATE;

ALTER TABLE buero_auftraege
  ADD COLUMN IF NOT EXISTS angebot_id TEXT,
  ADD COLUMN IF NOT EXISTS ab_verschickt_am DATE;

-- Angebot number function (MAX-based, safe for existing data)
CREATE OR REPLACE FUNCTION pk_next_angebot_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  yr text := to_char(CURRENT_DATE, 'YYYY');
  prefix text;
  max_nr int := 0;
BEGIN
  prefix := 'ANG-' || yr || '-';
  SELECT COALESCE(MAX(CAST(SUBSTRING(nummer FROM LENGTH(prefix) + 1) AS integer)), 0)
  INTO max_nr
  FROM buero_angebote
  WHERE nummer LIKE prefix || '%'
    AND LENGTH(nummer) = LENGTH(prefix) + 5;
  RETURN prefix || lpad((max_nr + 1)::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION pk_next_angebot_number() TO authenticated;
