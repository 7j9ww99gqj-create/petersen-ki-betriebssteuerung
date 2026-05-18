-- ── SteuerPilot Erweiterung ────────────────────────────────────────────────────
-- Neue Tabellen: steuer_fixkosten, steuer_betriebsausgaben, steuer_anschaffungen

-- 1. Fixkosten (monatliche Dauerverpflichtungen)
CREATE TABLE IF NOT EXISTS steuer_fixkosten (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users DEFAULT auth.uid() NOT NULL,
  titel text NOT NULL,
  kategorie text NOT NULL DEFAULT 'Sonstiges',
  betrag_netto numeric(10,2) NOT NULL DEFAULT 0,
  steuersatz integer NOT NULL DEFAULT 19,
  betrag_brutto numeric(10,2) NOT NULL DEFAULT 0,
  zahlungsintervall text NOT NULL DEFAULT 'monatlich',
  naechste_zahlung date,
  anbieter text,
  notiz text,
  datei_url text,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE steuer_fixkosten ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'steuer_fixkosten' AND policyname = 'steuer_fixkosten_owner'
  ) THEN
    CREATE POLICY "steuer_fixkosten_owner" ON steuer_fixkosten
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Variable Betriebsausgaben (Einzelausgaben)
CREATE TABLE IF NOT EXISTS steuer_betriebsausgaben (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users DEFAULT auth.uid() NOT NULL,
  titel text NOT NULL,
  kategorie text NOT NULL DEFAULT 'Sonstiges',
  betrag_netto numeric(10,2) NOT NULL DEFAULT 0,
  steuersatz integer NOT NULL DEFAULT 19,
  betrag_brutto numeric(10,2) NOT NULL DEFAULT 0,
  datum date NOT NULL,
  anbieter text,
  notiz text,
  datei_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE steuer_betriebsausgaben ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'steuer_betriebsausgaben' AND policyname = 'steuer_betriebsausgaben_owner'
  ) THEN
    CREATE POLICY "steuer_betriebsausgaben_owner" ON steuer_betriebsausgaben
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Anschaffungen (Wirtschaftsgüter / Investitionen)
CREATE TABLE IF NOT EXISTS steuer_anschaffungen (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users DEFAULT auth.uid() NOT NULL,
  titel text NOT NULL,
  kategorie text NOT NULL DEFAULT 'Sonstiges',
  betrag_netto numeric(10,2) NOT NULL DEFAULT 0,
  steuersatz integer NOT NULL DEFAULT 19,
  betrag_brutto numeric(10,2) NOT NULL DEFAULT 0,
  kaufdatum date NOT NULL,
  lieferant text,
  seriennummer text,
  garantie_bis date,
  notiz text,
  datei_url text,
  gwg boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE steuer_anschaffungen ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'steuer_anschaffungen' AND policyname = 'steuer_anschaffungen_owner'
  ) THEN
    CREATE POLICY "steuer_anschaffungen_owner" ON steuer_anschaffungen
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
