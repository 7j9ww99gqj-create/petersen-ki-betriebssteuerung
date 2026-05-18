-- ============================================================
-- RLS-Policies vollständig für alle Tabellen
-- Lücken: fehlende WITH CHECK, fehlende DELETE-Policies,
--         fehlende INSERT/UPDATE auf owner-only Tabellen,
--         billing_sequences ohne RLS
-- ============================================================

-- ── billing_sequences: nur service_role und security-definer Funktionen ──────
-- Die Tabelle wird ausschließlich über pk_next_invoice_number() (SECURITY DEFINER)
-- befüllt und gelesen. Kein Direktzugriff für authentifizierte Nutzer.
ALTER TABLE billing_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_sequences_service" ON billing_sequences;
CREATE POLICY "billing_sequences_service" ON billing_sequences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── billing_subscriptions: fehlende DELETE-Policy ────────────────────────────
-- Bestehende SELECT/INSERT/UPDATE-Policies bleiben erhalten.
-- DELETE nur für eigenen Datensatz oder Inhaber.
DROP POLICY IF EXISTS "billing_subscriptions_delete" ON billing_subscriptions;
CREATE POLICY "billing_subscriptions_delete" ON billing_subscriptions
  FOR DELETE USING (auth.uid() = user_id OR pk_is_owner());

-- ── owner_event_inbox: Inhaber-only INSERT/UPDATE/DELETE ─────────────────────
-- SELECT-Policy existiert bereits. Einfügen/Ändern/Löschen nur über Inhaber
-- oder service_role (Trigger nutzt SECURITY DEFINER, braucht keine eigene Policy).
DROP POLICY IF EXISTS "owner_event_inbox_insert" ON owner_event_inbox;
CREATE POLICY "owner_event_inbox_insert" ON owner_event_inbox
  FOR INSERT WITH CHECK (pk_is_owner());

DROP POLICY IF EXISTS "owner_event_inbox_update" ON owner_event_inbox;
CREATE POLICY "owner_event_inbox_update" ON owner_event_inbox
  FOR UPDATE USING (pk_is_owner()) WITH CHECK (pk_is_owner());

DROP POLICY IF EXISTS "owner_event_inbox_delete" ON owner_event_inbox;
CREATE POLICY "owner_event_inbox_delete" ON owner_event_inbox
  FOR DELETE USING (pk_is_owner());

-- ── owner_notifications: fehlende INSERT/DELETE ───────────────────────────────
-- SELECT und UPDATE existieren bereits.
DROP POLICY IF EXISTS "owner_notifications_insert" ON owner_notifications;
CREATE POLICY "owner_notifications_insert" ON owner_notifications
  FOR INSERT WITH CHECK (pk_is_owner());

DROP POLICY IF EXISTS "owner_notifications_delete" ON owner_notifications;
CREATE POLICY "owner_notifications_delete" ON owner_notifications
  FOR DELETE USING (pk_is_owner());

-- ── billing_payments: fehlende DELETE-Policy ─────────────────────────────────
-- SELECT/INSERT/UPDATE existieren bereits (schema.sql + migration).
DROP POLICY IF EXISTS "billing_payments_delete" ON billing_payments;
CREATE POLICY "billing_payments_delete" ON billing_payments
  FOR DELETE USING (auth.uid() = user_id OR pk_is_owner());

-- ── audit_logs: fehlende UPDATE/DELETE (Admin/Inhaber only) ──────────────────
-- audit_logs ist konzeptionell append-only. UPDATE/DELETE nur für Inhaber,
-- damit der Inhaber Einträge im Notfall korrigieren/löschen kann.
DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
CREATE POLICY "audit_logs_update" ON audit_logs
  FOR UPDATE USING (pk_is_owner()) WITH CHECK (pk_is_owner());

DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;
CREATE POLICY "audit_logs_delete" ON audit_logs
  FOR DELETE USING (pk_is_owner());

-- ── import_protokolle: fehlende UPDATE/DELETE ────────────────────────────────
-- SELECT und INSERT existieren bereits.
DROP POLICY IF EXISTS "import_protokolle_update" ON import_protokolle;
CREATE POLICY "import_protokolle_update" ON import_protokolle
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_protokolle_delete" ON import_protokolle;
CREATE POLICY "import_protokolle_delete" ON import_protokolle
  FOR DELETE USING (auth.uid() = user_id);

-- ── steuer_belege: WITH CHECK ergänzen ───────────────────────────────────────
-- Bestehende Policy "steuer_belege_all" hat kein WITH CHECK → INSERT/UPDATE
-- Manipulation möglich (user_id frei wählbar). Ersetzen durch granulare Policies.
DROP POLICY IF EXISTS "steuer_belege_all" ON steuer_belege;

CREATE POLICY "steuer_belege_select" ON steuer_belege
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "steuer_belege_insert" ON steuer_belege
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_belege_update" ON steuer_belege
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_belege_delete" ON steuer_belege
  FOR DELETE USING (auth.uid() = user_id);

-- ── steuer_ustva: WITH CHECK ergänzen ────────────────────────────────────────
DROP POLICY IF EXISTS "steuer_ustva_all" ON steuer_ustva;

CREATE POLICY "steuer_ustva_select" ON steuer_ustva
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "steuer_ustva_insert" ON steuer_ustva
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_ustva_update" ON steuer_ustva
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_ustva_delete" ON steuer_ustva
  FOR DELETE USING (auth.uid() = user_id);

-- ── steuer_buchungen: WITH CHECK ergänzen ────────────────────────────────────
DROP POLICY IF EXISTS "steuer_buchungen_all" ON steuer_buchungen;

CREATE POLICY "steuer_buchungen_select" ON steuer_buchungen
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "steuer_buchungen_insert" ON steuer_buchungen
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_buchungen_update" ON steuer_buchungen
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_buchungen_delete" ON steuer_buchungen
  FOR DELETE USING (auth.uid() = user_id);

-- ── steuer_konten: WITH CHECK ergänzen ───────────────────────────────────────
DROP POLICY IF EXISTS "steuer_konten_all" ON steuer_konten;

CREATE POLICY "steuer_konten_select" ON steuer_konten
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "steuer_konten_insert" ON steuer_konten
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_konten_update" ON steuer_konten
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "steuer_konten_delete" ON steuer_konten
  FOR DELETE USING (auth.uid() = user_id);

-- ── lager_artikel / lager_bewegungen: WITH CHECK bereits vorhanden ───────────
-- Keine Änderung nötig (schema.sql Zeile 495–496).

-- ── Werkstatt / Marketing / Planung / BüroPilot ──────────────────────────────
-- Alle durch Migration 20260513200000_add_role_based_rls.sql vollständig abgedeckt.
-- Keine Änderung nötig.

-- ── steuer_fixkosten / steuer_betriebsausgaben / steuer_anschaffungen ─────────
-- Migration 20260518150000_add_steuer_erweiterung.sql:
-- Policies verwenden USING + WITH CHECK → korrekt, keine Änderung nötig.

-- ── stripe_webhook_events ─────────────────────────────────────────────────────
-- Nur service_role Zugriff, kein authenticated-User-Zugriff gewünscht.
-- Schema bereits korrekt (Zeile 786–788). Keine Änderung nötig.
