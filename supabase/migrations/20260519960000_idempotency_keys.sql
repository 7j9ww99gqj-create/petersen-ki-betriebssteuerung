-- Idempotency Keys für mutierende API-Anfragen
-- Schützt vor Doppel-Klick-Bestellungen/-Rechnungen
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash      text NOT NULL UNIQUE,           -- SHA-256 des Idempotency-Key Headers
  user_id       uuid REFERENCES auth.users,
  route         text NOT NULL,
  response_body text,                           -- gecachte Antwort (JSON)
  status_code   integer NOT NULL DEFAULT 200,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- TTL-Index: Keys älter als 24h werden via Cron gelöscht
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys (created_at);

-- RLS: User sieht nur eigene Keys
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_user_select" ON idempotency_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "idempotency_service_all" ON idempotency_keys
  FOR ALL USING (true)
  WITH CHECK (true);
