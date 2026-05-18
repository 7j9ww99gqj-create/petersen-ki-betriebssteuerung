-- ============================================================
-- DATARESET: Alle Geschäftsdaten löschen (Demo + Test-Accounts)
-- TRUNCATE CASCADE behandelt FK-Abhängigkeiten automatisch
-- Inhaber-Account bleibt erhalten
-- ============================================================

-- Billing zuerst (hat FK auf buero_rechnungen)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_payments') THEN
    TRUNCATE TABLE billing_payments CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_subscriptions') THEN
    TRUNCATE TABLE billing_subscriptions CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_stripe_events') THEN
    TRUNCATE TABLE billing_stripe_events;
  END IF;
END $$;

-- Büro
TRUNCATE TABLE buero_rechnungen CASCADE;
TRUNCATE TABLE buero_auftraege CASCADE;
TRUNCATE TABLE buero_angebote CASCADE;
TRUNCATE TABLE buero_kunden CASCADE;
TRUNCATE TABLE buero_dokumente CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buero_eingangsrechnungen') THEN
    TRUNCATE TABLE buero_eingangsrechnungen;
  END IF;
END $$;

-- Einkauf
TRUNCATE TABLE einkauf_wareneingaenge CASCADE;
TRUNCATE TABLE einkauf_bestellungen CASCADE;
TRUNCATE TABLE einkauf_lieferanten CASCADE;

-- Lager
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lager_umlagerungen') THEN TRUNCATE TABLE lager_umlagerungen; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lager_stellplatz_bestand') THEN TRUNCATE TABLE lager_stellplatz_bestand; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lager_stellplaetze') THEN TRUNCATE TABLE lager_stellplaetze; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lager_bewegungen') THEN TRUNCATE TABLE lager_bewegungen; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lager_artikel') THEN TRUNCATE TABLE lager_artikel; END IF;
END $$;

-- Werkstatt
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'werkstatt_pruefprotokolle') THEN TRUNCATE TABLE werkstatt_pruefprotokolle; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'werkstatt_material') THEN TRUNCATE TABLE werkstatt_material; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'werkstatt_zeitbuchungen') THEN TRUNCATE TABLE werkstatt_zeitbuchungen; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'werkstatt_karten') THEN TRUNCATE TABLE werkstatt_karten CASCADE; END IF;
END $$;

-- Marketing
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_newsletter') THEN TRUNCATE TABLE marketing_newsletter; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_leads') THEN TRUNCATE TABLE marketing_leads; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_kampagnen') THEN TRUNCATE TABLE marketing_kampagnen; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketing_seo_keywords') THEN TRUNCATE TABLE marketing_seo_keywords; END IF;
END $$;

-- Planung
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'planung_ressourcen') THEN TRUNCATE TABLE planung_ressourcen; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'planung_termine') THEN TRUNCATE TABLE planung_termine; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'planung_aufgaben') THEN TRUNCATE TABLE planung_aufgaben CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'planung_projekte') THEN TRUNCATE TABLE planung_projekte CASCADE; END IF;
END $$;

-- Steuer
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'steuer_anschaffungen') THEN TRUNCATE TABLE steuer_anschaffungen; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'steuer_betriebsausgaben') THEN TRUNCATE TABLE steuer_betriebsausgaben; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'steuer_fixkosten') THEN TRUNCATE TABLE steuer_fixkosten; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'steuer_belege') THEN TRUNCATE TABLE steuer_belege; END IF;
END $$;

-- Import-Protokolle
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'import_protokolle') THEN TRUNCATE TABLE import_protokolle; END IF;
END $$;

-- Auth-User löschen (alle außer Inhaber und Demo-Account)
DELETE FROM auth.users
WHERE email NOT IN ('info@petersen-ki-pilot.de', 'demo@petersen-ki.de');
