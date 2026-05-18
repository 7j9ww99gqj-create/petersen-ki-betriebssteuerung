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
    TRUNCATE TABLE buero_eingangsrechnungen CASCADE;
  END IF;
END $$;

-- Einkauf
TRUNCATE TABLE einkauf_wareneingaenge CASCADE;
TRUNCATE TABLE einkauf_bestellungen CASCADE;
TRUNCATE TABLE einkauf_lieferanten CASCADE;

-- Lager, Werkstatt, Marketing, Planung, Steuer, Import
-- Alle mit CASCADE um FK-Ketten automatisch aufzulösen
DO $$ DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'lager_umlagerungen','lager_stellplatz_bestand','lager_stellplaetze',
    'lager_bewegungen','lager_artikel',
    'werkstatt_pruefprotokolle','werkstatt_material','werkstatt_zeitbuchungen','werkstatt_karten',
    'marketing_newsletter','marketing_leads','marketing_kampagnen','marketing_seo_keywords',
    'planung_ressourcen','planung_termine','planung_aufgaben','planung_projekte',
    'steuer_anschaffungen','steuer_betriebsausgaben','steuer_fixkosten','steuer_belege',
    'import_protokolle'
  ])
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- Auth-User löschen (alle außer Inhaber und Demo-Account)
DELETE FROM auth.users
WHERE email NOT IN ('info@petersen-ki-pilot.de', 'demo@petersen-ki.de');
