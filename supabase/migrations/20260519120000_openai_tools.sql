-- OpenAI Piloten-Tools: 4 neue Spalten in firma_einstellungen
-- Alle default false (deaktiviert)

ALTER TABLE firma_einstellungen
  ADD COLUMN IF NOT EXISTS openai_steuerprognose_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS openai_mahnungsgenerator_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS openai_email_assistent_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS openai_monatsbericht_enabled boolean DEFAULT false;
