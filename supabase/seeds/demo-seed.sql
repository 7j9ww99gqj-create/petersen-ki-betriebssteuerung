-- ===========================================================================
-- Demo-User Seed (Petersen KI)
-- User-ID: 5ff2cb0a-1ea0-4ba5-a6cc-54762710b68f (demo@petersen-ki-pilot.de)
--
-- Ausführen via exec_sql RPC ODER Supabase SQL-Editor.
-- Wird täglich um 03:00 Uhr automatisch via /api/admin/demo-reset neu eingespielt.
-- ===========================================================================

DO $$
DECLARE
  v_demo_user_id uuid := '5ff2cb0a-1ea0-4ba5-a6cc-54762710b68f';
BEGIN

-- ─── Firma-Einstellungen ──────────────────────────────────────────────────
INSERT INTO firma_einstellungen (
  user_id, firmenname, adresse, plz, ort, land, email, telefon, website,
  ansprechpartner, slogan, branche, ust_id, steuernummer,
  bankname, iban, bic, zahlungsziel_tage, standard_mwst, standard_waehrung,
  onboarding_completed
)
VALUES (
  v_demo_user_id,
  'Demo Betrieb GmbH', 'Musterstraße 12', '24937', 'Flensburg', 'Deutschland',
  'demo@petersen-ki-pilot.de', '+49 461 1234567', 'https://petersen-ki-pilot.de',
  'Max Mustermann', 'KI für jeden Betrieb', 'Metallverarbeitung',
  'DE123456789', '21/123/45678',
  'Demo-Bank', 'DE12 1234 5678 9012 3456 78', 'DEMODEFXXXX', 14, 19, 'EUR',
  true
)
;

-- ─── Lager-Artikel ────────────────────────────────────────────────────────
INSERT INTO lager_artikel (user_id, id, name, kategorie, bestand, einheit, lagerplatz, status, mindestbestand) VALUES
  (v_demo_user_id, 'ART-001', 'Stahlrohr 40x40',         'Rohstoffe',         142,  'Stk',    'A-01-03', 'ok',       20),
  (v_demo_user_id, 'ART-002', 'Schrauben M8x30',          'Kleinteile',        1840, 'Stk',    'B-02-01', 'ok',       500),
  (v_demo_user_id, 'ART-003', 'Hydrauliköl HLP46',        'Betriebsstoffe',    8,    'Liter',  'C-01-02', 'niedrig',  20),
  (v_demo_user_id, 'ART-004', 'Schweißdraht 1.0mm',       'Verbrauchsmaterial',24,   'Rollen', 'B-03-04', 'ok',       10),
  (v_demo_user_id, 'ART-005', 'Aluminiumplatte 200x300',  'Rohstoffe',         0,    'Stk',    'A-02-01', 'leer',     5),
  (v_demo_user_id, 'ART-006', 'Dichtungsring 50mm',       'Kleinteile',        360,  'Stk',    'B-01-05', 'ok',       50),
  (v_demo_user_id, 'ART-007', 'Schutzhandschuhe Gr. L',   'Schutzausrüstung',  12,   'Paar',   'D-01-01', 'niedrig',  20),
  (v_demo_user_id, 'ART-008', 'Winkelschleifer 125mm',    'Werkzeug',          3,    'Stk',    'E-01-02', 'ok',       1)
;

-- ─── Lager-Stellplätze ────────────────────────────────────────────────────
INSERT INTO lager_stellplaetze (user_id, id, code, name, bereich, zone, typ, aktiv) VALUES
  (v_demo_user_id, gen_random_uuid(), 'TL-A-01-01', 'Trockenlager A Regal 1 Fach 1', 'Trockenlager', 'A',  'Standard', true),
  (v_demo_user_id, gen_random_uuid(), 'TL-A-01-02', 'Trockenlager A Regal 1 Fach 2', 'Trockenlager', 'A',  'Standard', true),
  (v_demo_user_id, gen_random_uuid(), 'KL-B-02-01', 'Kühlbereich B Regal 2 Fach 1',  'Kühlbereich',  'B',  'Kühl',     true),
  (v_demo_user_id, gen_random_uuid(), 'WE-ZONE-01', 'Wareneingangszone 1',           'Wareneingang', 'WE', 'Eingang',  true),
  (v_demo_user_id, gen_random_uuid(), 'SPERR-01',   'Sperrlager 1',                  'Sperrlager',   'S',  'Sperr',    true),
  (v_demo_user_id, gen_random_uuid(), 'VERSAND-01', 'Versandzone 1',                 'Versand',      'V',  'Ausgang',  true)
;

-- ─── Lager-Bewegungen ─────────────────────────────────────────────────────
INSERT INTO lager_bewegungen (user_id, typ, artikel, menge, datum, mitarbeiter, status) VALUES
  (v_demo_user_id, 'Eingang', 'Stahlrohr 40x40',    50,   '2026-05-15', 'K. Petersen', 'Gebucht'),
  (v_demo_user_id, 'Ausgang', 'Schrauben M8x30',    200,  '2026-05-15', 'M. Fischer',  'Gebucht'),
  (v_demo_user_id, 'Eingang', 'Hydrauliköl HLP46',  20,   '2026-05-14', 'K. Petersen', 'KI erkannt'),
  (v_demo_user_id, 'Ausgang', 'Schweißdraht 1.0mm', 6,    '2026-05-14', 'M. Fischer',  'Gebucht'),
  (v_demo_user_id, 'Eingang', 'Schrauben M8x30',    1000, '2026-05-12', 'K. Petersen', 'Gebucht'),
  (v_demo_user_id, 'Ausgang', 'Stahlrohr 40x40',    8,    '2026-05-11', 'T. Schulz',   'Gebucht')
;

-- ─── Büro-Kunden ──────────────────────────────────────────────────────────
INSERT INTO buero_kunden (user_id, id, name, email, telefon, ort, ansprechpartner) VALUES
  (v_demo_user_id, gen_random_uuid(), 'Müller Maschinenbau GmbH', 'einkauf@mueller-maschinen.de', '+49 461 111111', 'Flensburg', 'Frau Schmidt'),
  (v_demo_user_id, gen_random_uuid(), 'Schmidt Industrie AG',     'kontakt@schmidt-ag.de',         '+49 461 222222', 'Kiel',      'Herr Wagner'),
  (v_demo_user_id, gen_random_uuid(), 'Werft Nord GmbH',          'order@werft-nord.de',           '+49 461 333333', 'Eckernförde','Frau Meier'),
  (v_demo_user_id, gen_random_uuid(), 'Bauunternehmung Klaus',    'info@bau-klaus.de',             '+49 461 444444', 'Schleswig', 'Herr Klaus'),
  (v_demo_user_id, gen_random_uuid(), 'Privatkunde Otto Hansen',  'otto.hansen@email.de',          '+49 461 555555', 'Flensburg', 'Otto Hansen')
;

-- ─── Einkauf-Lieferanten ──────────────────────────────────────────────────
INSERT INTO einkauf_lieferanten (user_id, id, name, kategorie, ansprechpartner, email, telefon, zahlungsziel) VALUES
  (v_demo_user_id, gen_random_uuid(), 'StahlMax GmbH',         'Rohstoffe',         'Hr. Hansen',  'order@stahlmax.de',         '+49 461 100100', 30),
  (v_demo_user_id, gen_random_uuid(), 'SchraubenKönig OHG',    'Kleinteile',        'Fr. Petersen','vertrieb@schraubenkoenig.de','+49 461 200200', 14),
  (v_demo_user_id, gen_random_uuid(), 'Öl & Schmierstoff KG',  'Betriebsstoffe',    'Hr. Lorenz',  'sales@oel-schmier.de',      '+49 461 300300', 21),
  (v_demo_user_id, gen_random_uuid(), 'Werkzeug-Service Nord', 'Werkzeug',          'Hr. Bauer',   'kontakt@werkzeug-nord.de',  '+49 461 400400', 30)
;

-- ─── Werkstatt-Karten ─────────────────────────────────────────────────────
INSERT INTO werkstatt_karten (user_id, id, auftragsnr, beschreibung, status, prioritaet, mitarbeiter, maschine, fortschritt) VALUES
  (v_demo_user_id, gen_random_uuid(), 'WK-001', 'Hydraulikzylinder Reparatur',  'In Arbeit',  'hoch',    'M. Fischer',  'Drehbank 1', 45),
  (v_demo_user_id, gen_random_uuid(), 'WK-002', 'Schweißarbeit Stahlträger',    'Wartend',    'mittel',  'T. Schulz',   'Schweißroboter', 0),
  (v_demo_user_id, gen_random_uuid(), 'WK-003', 'Inspektion Werkzeugmaschine',  'Geplant',    'niedrig', 'K. Petersen', 'Fräse 2', 0),
  (v_demo_user_id, gen_random_uuid(), 'WK-004', 'Wartung Druckluftsystem',      'Erledigt',   'mittel',  'M. Fischer',  'Kompressor', 100)
;

-- ─── Planung-Projekte ─────────────────────────────────────────────────────
INSERT INTO planung_projekte (user_id, id, name, status, fortschritt, start, ende, kunde, verantwortlich) VALUES
  (v_demo_user_id, gen_random_uuid(), 'Neubau Werkhalle 3',         'aktiv',     45, '2026-04-01', '2026-08-30', 'Eigenbau',          'K. Petersen'),
  (v_demo_user_id, gen_random_uuid(), 'Kundenauftrag Werft Nord',   'aktiv',     70, '2026-05-01', '2026-06-15', 'Werft Nord GmbH',   'M. Fischer'),
  (v_demo_user_id, gen_random_uuid(), 'Maschinen-Modernisierung',   'geplant',   10, '2026-06-01', '2026-09-30', 'Eigenbau',          'T. Schulz')
;

-- ─── Marketing-Kampagnen ──────────────────────────────────────────────────
INSERT INTO marketing_kampagnen (user_id, id, name, typ, status, budget, start, ende) VALUES
  (v_demo_user_id, gen_random_uuid(), 'Frühjahrs-Newsletter',  'E-Mail',       'aktiv',     200.00, '2026-04-01', '2026-05-31'),
  (v_demo_user_id, gen_random_uuid(), 'LinkedIn-Werbung Q2',   'LinkedIn',     'pausiert',  500.00, '2026-04-15', '2026-06-30'),
  (v_demo_user_id, gen_random_uuid(), 'Google-Ads Stahlbau',   'Google Ads',   'aktiv',     800.00, '2026-05-01', '2026-07-31')
;

-- ─── Marketing-Leads ──────────────────────────────────────────────────────
INSERT INTO marketing_leads (user_id, id, name, firma, email, status, quelle, wert) VALUES
  (v_demo_user_id, gen_random_uuid(), 'Klaus Beispiel',  'Beispiel GmbH',  'klaus@beispiel.de', 'neu',         'Website',    5000),
  (v_demo_user_id, gen_random_uuid(), 'Anna Schmidt',    'Schmidt KG',     'anna@schmidt.de',   'kontaktiert', 'LinkedIn',   12000),
  (v_demo_user_id, gen_random_uuid(), 'Tom Werner',      'Werner Bau',     'tom@werner-bau.de', 'qualifiziert','Empfehlung', 25000)
;

-- ─── Steuer-Belege (3 Beispiele) ──────────────────────────────────────────
INSERT INTO steuer_belege (user_id, id, lieferant, betrag, datum, kategorie, status, steuersatz, steuerbetrag, belegnummer) VALUES
  (v_demo_user_id, gen_random_uuid(), 'StahlMax GmbH',         1190.00, '2026-05-10', 'Wareneinkauf',    'gebucht', 19, 190.00, 'RE-2026-1001'),
  (v_demo_user_id, gen_random_uuid(), 'Öl & Schmierstoff KG',  238.00,  '2026-05-08', 'Betriebsstoffe',  'gebucht', 19,  38.00, 'RE-2026-1002'),
  (v_demo_user_id, gen_random_uuid(), 'Werkzeug-Service Nord', 595.00,  '2026-05-05', 'Werkzeug/Geräte', 'gebucht', 19,  95.00, 'RE-2026-1003')
;

END $$;
