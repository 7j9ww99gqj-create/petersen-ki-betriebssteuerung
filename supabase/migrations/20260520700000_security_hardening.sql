-- ═══════════════════════════════════════════════════════════════════
-- Security Hardening — Supabase Advisor Findings
-- Fixes: anon_security_definer_function_executable
--        authenticated_security_definer_function_executable
--        function_search_path_mutable
--        auth_rls_initplan (performance)
--        multiple_permissive_policies (cleanup)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Revoke dangerous anon/authenticated access to SECURITY DEFINER functions ──

-- exec_sql: executes arbitrary SQL — only service_role should call this
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon, authenticated;

-- Trigger functions must not be callable via REST API
REVOKE EXECUTE ON FUNCTION public.sync_lager_artikel_bestand() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_billing_subscription_to_owner_customer() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_billing_subscription_to_owner_notifications() FROM anon, authenticated;

-- User-facing helpers: revoke from anon (unauthenticated users have no role)
REVOKE EXECUTE ON FUNCTION public.pk_get_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pk_can_write() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pk_is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pk_get_ai_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pk_next_angebot_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pk_next_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pk_register_owner_event(text,text,text,text,text,text,text,text,text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.umlager_artikel(text,text,numeric,text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_pondruff_bauteile(vector,integer,double precision) FROM anon;


-- ── 2. Fix function_search_path_mutable + auth.jwt() initplan in helpers ──

CREATE OR REPLACE FUNCTION public.pk_get_role()
  RETURNS text
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  select coalesce(
    nullif((select auth.jwt()) -> 'app_metadata' ->> 'role', ''),
    nullif((select auth.jwt()) -> 'user_metadata' ->> 'role', ''),
    'Mitarbeiter'
  );
$$;

CREATE OR REPLACE FUNCTION public.pk_can_write()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  select pk_get_role() in ('Inhaber', 'Admin', 'Mitarbeiter', 'Büro');
$$;

CREATE OR REPLACE FUNCTION public.pk_is_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  select lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'info@petersen-ki-pilot.de';
$$;

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_lager_artikel_bestand()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_artikel_id TEXT;
  v_neue_summe NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_artikel_id := OLD.artikel_id;
  ELSE
    v_artikel_id := NEW.artikel_id;
  END IF;
  IF v_artikel_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT COALESCE(SUM(menge), 0)
  INTO v_neue_summe
  FROM lager_stellplatz_bestand
  WHERE artikel_id = v_artikel_id;
  UPDATE lager_artikel
  SET bestand = v_neue_summe
  WHERE id = v_artikel_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_werkstatt_karte_stunden()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
DECLARE
  v_auftragsnr text;
  v_user_id uuid;
  v_summe numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_auftragsnr := OLD.auftragsnr;
    v_user_id := OLD.user_id;
  ELSE
    v_auftragsnr := NEW.auftragsnr;
    v_user_id := NEW.user_id;
  END IF;
  SELECT coalesce(sum(stunden), 0)
  INTO v_summe
  FROM werkstatt_zeitbuchungen
  WHERE auftragsnr = v_auftragsnr AND user_id = v_user_id;
  UPDATE werkstatt_karten
  SET stunden = v_summe, updated_at = now()
  WHERE auftragsnr = v_auftragsnr AND user_id = v_user_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_pondruff_bauteile(
  query_embedding vector,
  match_count integer DEFAULT 10,
  similarity_threshold double precision DEFAULT 0.3
)
  RETURNS TABLE(
    id uuid, customer text, delivery_id text, article_no text,
    description text, image_url text, wareneingang_id uuid,
    created_at timestamp with time zone, similarity double precision
  )
  LANGUAGE sql
  STABLE
  SET search_path = public
AS $$
  select
    b.id, b.customer, b.delivery_id, b.article_no, b.description,
    b.image_url, b.wareneingang_id, b.created_at,
    1 - (b.embedding <=> query_embedding) as similarity
  from pondruff_bauteile b
  where b.user_id = (select auth.uid())
    and b.embedding is not null
    and 1 - (b.embedding <=> query_embedding) >= similarity_threshold
  order by b.embedding <=> query_embedding
  limit match_count;
$$;

CREATE OR REPLACE FUNCTION public.tg_user_design_prefs_set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ── 3. Fix multiple_permissive_policies + auth_rls_initplan in all policies ──
-- Drops redundant ALL/owner-only duplicate policies and rewrites remaining
-- policies to use (select auth.uid()) for once-per-query evaluation.

DROP POLICY IF EXISTS "user_only_select" ON ai_usage;
CREATE POLICY "user_only_select" ON ai_usage AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = actor_user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs AS PERMISSIVE FOR SELECT
  USING ((((select auth.uid()) = actor_user_id) OR pk_is_owner()));

DROP POLICY IF EXISTS "billing_payments_delete" ON billing_payments;
CREATE POLICY "billing_payments_delete" ON billing_payments AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "billing_payments_insert" ON billing_payments;
CREATE POLICY "billing_payments_insert" ON billing_payments AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "billing_payments_select" ON billing_payments;
CREATE POLICY "billing_payments_select" ON billing_payments AS PERMISSIVE FOR SELECT
  USING ((((select auth.uid()) = user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "billing_payments_update" ON billing_payments;
CREATE POLICY "billing_payments_update" ON billing_payments AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) OR pk_is_owner()))
  WITH CHECK ((((select auth.uid()) = user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "billing_payments_user" ON billing_payments;

DROP POLICY IF EXISTS "billing_subscriptions_delete" ON billing_subscriptions;
CREATE POLICY "billing_subscriptions_delete" ON billing_subscriptions AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "billing_subscriptions_insert" ON billing_subscriptions;
CREATE POLICY "billing_subscriptions_insert" ON billing_subscriptions AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "billing_subscriptions_select" ON billing_subscriptions;
CREATE POLICY "billing_subscriptions_select" ON billing_subscriptions AS PERMISSIVE FOR SELECT
  USING ((((select auth.uid()) = user_id) OR pk_is_owner()));
DROP POLICY IF EXISTS "billing_subscriptions_update" ON billing_subscriptions;
CREATE POLICY "billing_subscriptions_update" ON billing_subscriptions AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) OR pk_is_owner()))
  WITH CHECK ((((select auth.uid()) = user_id) OR pk_is_owner()));

DROP POLICY IF EXISTS "broadcast_messages_select" ON broadcast_messages;
CREATE POLICY "broadcast_messages_select" ON broadcast_messages AS PERMISSIVE FOR SELECT
  USING ((((select auth.uid()) = recipient_user_id) OR ((select auth.uid()) = owner_user_id) OR (recipient_type = 'all'::text)));

DROP POLICY IF EXISTS "buero_angebote_delete" ON buero_angebote;
CREATE POLICY "buero_angebote_delete" ON buero_angebote AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_angebote_insert" ON buero_angebote;
CREATE POLICY "buero_angebote_insert" ON buero_angebote AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_angebote_select" ON buero_angebote;
CREATE POLICY "buero_angebote_select" ON buero_angebote AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "buero_angebote_update" ON buero_angebote;
CREATE POLICY "buero_angebote_update" ON buero_angebote AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "buero_artikel_user" ON buero_artikel;
CREATE POLICY "buero_artikel_user" ON buero_artikel AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "buero_auftraege_delete" ON buero_auftraege;
CREATE POLICY "buero_auftraege_delete" ON buero_auftraege AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_auftraege_insert" ON buero_auftraege;
CREATE POLICY "buero_auftraege_insert" ON buero_auftraege AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_auftraege_select" ON buero_auftraege;
CREATE POLICY "buero_auftraege_select" ON buero_auftraege AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "buero_auftraege_update" ON buero_auftraege;
CREATE POLICY "buero_auftraege_update" ON buero_auftraege AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "buero_dokumente_delete" ON buero_dokumente;
CREATE POLICY "buero_dokumente_delete" ON buero_dokumente AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_dokumente_insert" ON buero_dokumente;
CREATE POLICY "buero_dokumente_insert" ON buero_dokumente AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_dokumente_select" ON buero_dokumente;
CREATE POLICY "buero_dokumente_select" ON buero_dokumente AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "buero_dokumente_update" ON buero_dokumente;
CREATE POLICY "buero_dokumente_update" ON buero_dokumente AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "buero_eingangsrechnungen_delete" ON buero_eingangsrechnungen;
CREATE POLICY "buero_eingangsrechnungen_delete" ON buero_eingangsrechnungen AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_eingangsrechnungen_insert" ON buero_eingangsrechnungen;
CREATE POLICY "buero_eingangsrechnungen_insert" ON buero_eingangsrechnungen AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_eingangsrechnungen_select" ON buero_eingangsrechnungen;
CREATE POLICY "buero_eingangsrechnungen_select" ON buero_eingangsrechnungen AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "buero_eingangsrechnungen_update" ON buero_eingangsrechnungen;
CREATE POLICY "buero_eingangsrechnungen_update" ON buero_eingangsrechnungen AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "buero_kunden_delete" ON buero_kunden;
CREATE POLICY "buero_kunden_delete" ON buero_kunden AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_kunden_insert" ON buero_kunden;
CREATE POLICY "buero_kunden_insert" ON buero_kunden AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_kunden_select" ON buero_kunden;
CREATE POLICY "buero_kunden_select" ON buero_kunden AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "buero_kunden_update" ON buero_kunden;
CREATE POLICY "buero_kunden_update" ON buero_kunden AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "buero_ansprechpartner_user" ON buero_kunden_ansprechpartner;
CREATE POLICY "buero_ansprechpartner_user" ON buero_kunden_ansprechpartner AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "buero_rechnungen_delete" ON buero_rechnungen;
CREATE POLICY "buero_rechnungen_delete" ON buero_rechnungen AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_rechnungen_insert" ON buero_rechnungen;
CREATE POLICY "buero_rechnungen_insert" ON buero_rechnungen AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "buero_rechnungen_select" ON buero_rechnungen;
CREATE POLICY "buero_rechnungen_select" ON buero_rechnungen AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id) OR pk_is_owner());
DROP POLICY IF EXISTS "buero_rechnungen_update" ON buero_rechnungen;
CREATE POLICY "buero_rechnungen_update" ON buero_rechnungen AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id) OR pk_is_owner())
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "buero_zeiterfassung_user" ON buero_zeiterfassung;
CREATE POLICY "buero_zeiterfassung_user" ON buero_zeiterfassung AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "cloud_backups_own" ON cloud_backups;
CREATE POLICY "cloud_backups_own" ON cloud_backups AS PERMISSIVE FOR ALL
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "einkauf_bestellungen_all" ON einkauf_bestellungen;
DROP POLICY IF EXISTS "einkauf_bestellungen_delete" ON einkauf_bestellungen;
CREATE POLICY "einkauf_bestellungen_delete" ON einkauf_bestellungen AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "einkauf_bestellungen_insert" ON einkauf_bestellungen;
CREATE POLICY "einkauf_bestellungen_insert" ON einkauf_bestellungen AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "einkauf_bestellungen_select" ON einkauf_bestellungen;
CREATE POLICY "einkauf_bestellungen_select" ON einkauf_bestellungen AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "einkauf_bestellungen_update" ON einkauf_bestellungen;
CREATE POLICY "einkauf_bestellungen_update" ON einkauf_bestellungen AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "einkauf_lieferanten_all" ON einkauf_lieferanten;
DROP POLICY IF EXISTS "einkauf_lieferanten_delete" ON einkauf_lieferanten;
CREATE POLICY "einkauf_lieferanten_delete" ON einkauf_lieferanten AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "einkauf_lieferanten_insert" ON einkauf_lieferanten;
CREATE POLICY "einkauf_lieferanten_insert" ON einkauf_lieferanten AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "einkauf_lieferanten_select" ON einkauf_lieferanten;
CREATE POLICY "einkauf_lieferanten_select" ON einkauf_lieferanten AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "einkauf_lieferanten_update" ON einkauf_lieferanten;
CREATE POLICY "einkauf_lieferanten_update" ON einkauf_lieferanten AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "einkauf_wareneingaenge_all" ON einkauf_wareneingaenge;
CREATE POLICY "einkauf_wareneingaenge_all" ON einkauf_wareneingaenge AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "einkauf_wareneingaenge_insert" ON einkauf_wareneingaenge;
CREATE POLICY "einkauf_wareneingaenge_insert" ON einkauf_wareneingaenge AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND (pk_get_role() = ANY (ARRAY['Admin'::text, 'Mitarbeiter'::text, 'Lager'::text, 'Werkstatt'::text, 'Büro'::text]))));
DROP POLICY IF EXISTS "einkauf_wareneingaenge_select" ON einkauf_wareneingaenge;
CREATE POLICY "einkauf_wareneingaenge_select" ON einkauf_wareneingaenge AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "firma_einstellungen_user" ON firma_einstellungen;
CREATE POLICY "firma_einstellungen_user" ON firma_einstellungen AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "import_protokolle_delete" ON import_protokolle;
CREATE POLICY "import_protokolle_delete" ON import_protokolle AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "import_protokolle_insert" ON import_protokolle;
CREATE POLICY "import_protokolle_insert" ON import_protokolle AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "import_protokolle_select" ON import_protokolle;
CREATE POLICY "import_protokolle_select" ON import_protokolle AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "import_protokolle_update" ON import_protokolle;
CREATE POLICY "import_protokolle_update" ON import_protokolle AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "user_only_delete" ON ki_response_cache;
CREATE POLICY "user_only_delete" ON ki_response_cache AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_only_insert" ON ki_response_cache;
CREATE POLICY "user_only_insert" ON ki_response_cache AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_only_select" ON ki_response_cache;
CREATE POLICY "user_only_select" ON ki_response_cache AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "lager_artikel_user" ON lager_artikel;
CREATE POLICY "lager_artikel_user" ON lager_artikel AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "lager_bestand_snapshots_all" ON lager_bestand_snapshots;
CREATE POLICY "lager_bestand_snapshots_all" ON lager_bestand_snapshots AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "lager_bewegungen_user" ON lager_bewegungen;
CREATE POLICY "lager_bewegungen_user" ON lager_bewegungen AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "lager_stellplaetze_all" ON lager_stellplaetze;
CREATE POLICY "lager_stellplaetze_all" ON lager_stellplaetze AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "lager_stellplatz_bestand_all" ON lager_stellplatz_bestand;
CREATE POLICY "lager_stellplatz_bestand_all" ON lager_stellplatz_bestand AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "lager_umlagerungen_all" ON lager_umlagerungen;
CREATE POLICY "lager_umlagerungen_all" ON lager_umlagerungen AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "marketing_automation_delete" ON marketing_automation_rules;
CREATE POLICY "marketing_automation_delete" ON marketing_automation_rules AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_automation_select" ON marketing_automation_rules;
CREATE POLICY "marketing_automation_select" ON marketing_automation_rules AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_automation_update" ON marketing_automation_rules;
CREATE POLICY "marketing_automation_update" ON marketing_automation_rules AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_automation_write" ON marketing_automation_rules;
CREATE POLICY "marketing_automation_write" ON marketing_automation_rules AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "marketing_content_delete" ON marketing_content_ideas;
CREATE POLICY "marketing_content_delete" ON marketing_content_ideas AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_content_select" ON marketing_content_ideas;
CREATE POLICY "marketing_content_select" ON marketing_content_ideas AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_content_update" ON marketing_content_ideas;
CREATE POLICY "marketing_content_update" ON marketing_content_ideas AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_content_write" ON marketing_content_ideas;
CREATE POLICY "marketing_content_write" ON marketing_content_ideas AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "marketing_integration_delete" ON marketing_integration_items;
CREATE POLICY "marketing_integration_delete" ON marketing_integration_items AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_integration_select" ON marketing_integration_items;
CREATE POLICY "marketing_integration_select" ON marketing_integration_items AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_integration_update" ON marketing_integration_items;
CREATE POLICY "marketing_integration_update" ON marketing_integration_items AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_integration_write" ON marketing_integration_items;
CREATE POLICY "marketing_integration_write" ON marketing_integration_items AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "marketing_kampagnen_delete" ON marketing_kampagnen;
CREATE POLICY "marketing_kampagnen_delete" ON marketing_kampagnen AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_kampagnen_select" ON marketing_kampagnen;
CREATE POLICY "marketing_kampagnen_select" ON marketing_kampagnen AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_kampagnen_update" ON marketing_kampagnen;
CREATE POLICY "marketing_kampagnen_update" ON marketing_kampagnen AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_kampagnen_write" ON marketing_kampagnen;
CREATE POLICY "marketing_kampagnen_write" ON marketing_kampagnen AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "marketing_leads_delete" ON marketing_leads;
CREATE POLICY "marketing_leads_delete" ON marketing_leads AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_leads_select" ON marketing_leads;
CREATE POLICY "marketing_leads_select" ON marketing_leads AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_leads_update" ON marketing_leads;
CREATE POLICY "marketing_leads_update" ON marketing_leads AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_leads_write" ON marketing_leads;
CREATE POLICY "marketing_leads_write" ON marketing_leads AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "marketing_newsletter_delete" ON marketing_newsletter;
CREATE POLICY "marketing_newsletter_delete" ON marketing_newsletter AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_newsletter_select" ON marketing_newsletter;
CREATE POLICY "marketing_newsletter_select" ON marketing_newsletter AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_newsletter_update" ON marketing_newsletter;
CREATE POLICY "marketing_newsletter_update" ON marketing_newsletter AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_newsletter_write" ON marketing_newsletter;
CREATE POLICY "marketing_newsletter_write" ON marketing_newsletter AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "marketing_posting_delete" ON marketing_posting_plans;
CREATE POLICY "marketing_posting_delete" ON marketing_posting_plans AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_posting_select" ON marketing_posting_plans;
CREATE POLICY "marketing_posting_select" ON marketing_posting_plans AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_posting_update" ON marketing_posting_plans;
CREATE POLICY "marketing_posting_update" ON marketing_posting_plans AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_posting_write" ON marketing_posting_plans;
CREATE POLICY "marketing_posting_write" ON marketing_posting_plans AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "marketing_seo_delete" ON marketing_seo_keywords;
CREATE POLICY "marketing_seo_delete" ON marketing_seo_keywords AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_seo_select" ON marketing_seo_keywords;
CREATE POLICY "marketing_seo_select" ON marketing_seo_keywords AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "marketing_seo_update" ON marketing_seo_keywords;
CREATE POLICY "marketing_seo_update" ON marketing_seo_keywords AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "marketing_seo_write" ON marketing_seo_keywords;
CREATE POLICY "marketing_seo_write" ON marketing_seo_keywords AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "Users can manage their pilot documents" ON pilot_documents;
CREATE POLICY "Users can manage their pilot documents" ON pilot_documents AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = created_by));

DROP POLICY IF EXISTS "planung_aufgaben_delete" ON planung_aufgaben;
CREATE POLICY "planung_aufgaben_delete" ON planung_aufgaben AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_aufgaben_select" ON planung_aufgaben;
CREATE POLICY "planung_aufgaben_select" ON planung_aufgaben AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "planung_aufgaben_update" ON planung_aufgaben;
CREATE POLICY "planung_aufgaben_update" ON planung_aufgaben AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_aufgaben_write" ON planung_aufgaben;
CREATE POLICY "planung_aufgaben_write" ON planung_aufgaben AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "planung_projekte_delete" ON planung_projekte;
CREATE POLICY "planung_projekte_delete" ON planung_projekte AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_projekte_select" ON planung_projekte;
CREATE POLICY "planung_projekte_select" ON planung_projekte AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "planung_projekte_update" ON planung_projekte;
CREATE POLICY "planung_projekte_update" ON planung_projekte AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_projekte_write" ON planung_projekte;
CREATE POLICY "planung_projekte_write" ON planung_projekte AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "planung_ressourcen_delete" ON planung_ressourcen;
CREATE POLICY "planung_ressourcen_delete" ON planung_ressourcen AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_ressourcen_select" ON planung_ressourcen;
CREATE POLICY "planung_ressourcen_select" ON planung_ressourcen AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "planung_ressourcen_update" ON planung_ressourcen;
CREATE POLICY "planung_ressourcen_update" ON planung_ressourcen AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_ressourcen_write" ON planung_ressourcen;
CREATE POLICY "planung_ressourcen_write" ON planung_ressourcen AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "planung_termine_delete" ON planung_termine;
CREATE POLICY "planung_termine_delete" ON planung_termine AS PERMISSIVE FOR DELETE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_termine_select" ON planung_termine;
CREATE POLICY "planung_termine_select" ON planung_termine AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "planung_termine_update" ON planung_termine;
CREATE POLICY "planung_termine_update" ON planung_termine AS PERMISSIVE FOR UPDATE
  USING ((((select auth.uid()) = user_id) AND pk_can_write()))
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));
DROP POLICY IF EXISTS "planung_termine_write" ON planung_termine;
CREATE POLICY "planung_termine_write" ON planung_termine AS PERMISSIVE FOR INSERT
  WITH CHECK ((((select auth.uid()) = user_id) AND pk_can_write()));

DROP POLICY IF EXISTS "pondruff_bt_delete" ON pondruff_bauteile;
CREATE POLICY "pondruff_bt_delete" ON pondruff_bauteile AS PERMISSIVE FOR DELETE
  USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_bt_insert" ON pondruff_bauteile;
CREATE POLICY "pondruff_bt_insert" ON pondruff_bauteile AS PERMISSIVE FOR INSERT
  WITH CHECK ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_bt_select" ON pondruff_bauteile;
CREATE POLICY "pondruff_bt_select" ON pondruff_bauteile AS PERMISSIVE FOR SELECT
  USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_bt_update" ON pondruff_bauteile;
CREATE POLICY "pondruff_bt_update" ON pondruff_bauteile AS PERMISSIVE FOR UPDATE
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "pondruff_feature_flags_select_self" ON pondruff_feature_flags;
CREATE POLICY "pondruff_feature_flags_select_self" ON pondruff_feature_flags AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "pondruff_preise_delete_own" ON pondruff_preisauftraege;
CREATE POLICY "pondruff_preise_delete_own" ON pondruff_preisauftraege AS PERMISSIVE FOR DELETE
  USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_preise_insert_own" ON pondruff_preisauftraege;
CREATE POLICY "pondruff_preise_insert_own" ON pondruff_preisauftraege AS PERMISSIVE FOR INSERT
  WITH CHECK ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_preise_select_own" ON pondruff_preisauftraege;
CREATE POLICY "pondruff_preise_select_own" ON pondruff_preisauftraege AS PERMISSIVE FOR SELECT
  USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_preise_update_own" ON pondruff_preisauftraege;
CREATE POLICY "pondruff_preise_update_own" ON pondruff_preisauftraege AS PERMISSIVE FOR UPDATE
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "pondruff_we_delete_own" ON pondruff_wareneingaenge;
CREATE POLICY "pondruff_we_delete_own" ON pondruff_wareneingaenge AS PERMISSIVE FOR DELETE
  USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_we_insert_own" ON pondruff_wareneingaenge;
CREATE POLICY "pondruff_we_insert_own" ON pondruff_wareneingaenge AS PERMISSIVE FOR INSERT
  WITH CHECK ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_we_select_own" ON pondruff_wareneingaenge;
CREATE POLICY "pondruff_we_select_own" ON pondruff_wareneingaenge AS PERMISSIVE FOR SELECT
  USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "pondruff_we_update_own" ON pondruff_wareneingaenge;
CREATE POLICY "pondruff_we_update_own" ON pondruff_wareneingaenge AS PERMISSIVE FOR UPDATE
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users manage their push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage their push subscriptions" ON push_subscriptions AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "qm_fotos_owner_all" ON qm_fotos;
CREATE POLICY "qm_fotos_owner_all" ON qm_fotos AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM qm_pruefberichte p
  WHERE ((p.id = qm_fotos.pruefbericht_id) AND (p.user_id = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM qm_pruefberichte p
  WHERE ((p.id = qm_fotos.pruefbericht_id) AND (p.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "qm_messmittel_delete" ON qm_messmittel;
CREATE POLICY "qm_messmittel_delete" ON qm_messmittel AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "qm_messmittel_insert" ON qm_messmittel;
CREATE POLICY "qm_messmittel_insert" ON qm_messmittel AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "qm_messmittel_select" ON qm_messmittel;
CREATE POLICY "qm_messmittel_select" ON qm_messmittel AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "qm_messmittel_update" ON qm_messmittel;
CREATE POLICY "qm_messmittel_update" ON qm_messmittel AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "qm_messwerte_owner_all" ON qm_messwerte;
CREATE POLICY "qm_messwerte_owner_all" ON qm_messwerte AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM qm_pruefberichte p
  WHERE ((p.id = qm_messwerte.pruefbericht_id) AND (p.user_id = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM qm_pruefberichte p
  WHERE ((p.id = qm_messwerte.pruefbericht_id) AND (p.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "qm_pruefberichte_owner_all" ON qm_pruefberichte;
CREATE POLICY "qm_pruefberichte_owner_all" ON qm_pruefberichte AS PERMISSIVE FOR ALL
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "qm_team_del" ON qm_team_mitglieder;
CREATE POLICY "qm_team_del" ON qm_team_mitglieder AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "qm_team_ins" ON qm_team_mitglieder;
CREATE POLICY "qm_team_ins" ON qm_team_mitglieder AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "qm_team_sel" ON qm_team_mitglieder;
CREATE POLICY "qm_team_sel" ON qm_team_mitglieder AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "qm_team_upd" ON qm_team_mitglieder;
CREATE POLICY "qm_team_upd" ON qm_team_mitglieder AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "qm_zeichnungen_owner_all" ON qm_zeichnungen;
CREATE POLICY "qm_zeichnungen_owner_all" ON qm_zeichnungen AS PERMISSIVE FOR ALL
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "steuer_anschaffungen_owner" ON steuer_anschaffungen;
CREATE POLICY "steuer_anschaffungen_owner" ON steuer_anschaffungen AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "steuer_belege_delete" ON steuer_belege;
CREATE POLICY "steuer_belege_delete" ON steuer_belege AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_belege_insert" ON steuer_belege;
CREATE POLICY "steuer_belege_insert" ON steuer_belege AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_belege_select" ON steuer_belege;
CREATE POLICY "steuer_belege_select" ON steuer_belege AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_belege_update" ON steuer_belege;
CREATE POLICY "steuer_belege_update" ON steuer_belege AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "steuer_belege_uploads_delete" ON steuer_belege_uploads;
CREATE POLICY "steuer_belege_uploads_delete" ON steuer_belege_uploads AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_belege_uploads_insert" ON steuer_belege_uploads;
CREATE POLICY "steuer_belege_uploads_insert" ON steuer_belege_uploads AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_belege_uploads_select" ON steuer_belege_uploads;
CREATE POLICY "steuer_belege_uploads_select" ON steuer_belege_uploads AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_belege_uploads_update" ON steuer_belege_uploads;
CREATE POLICY "steuer_belege_uploads_update" ON steuer_belege_uploads AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "steuer_betriebsausgaben_owner" ON steuer_betriebsausgaben;
CREATE POLICY "steuer_betriebsausgaben_owner" ON steuer_betriebsausgaben AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "steuer_buchungen_delete" ON steuer_buchungen;
CREATE POLICY "steuer_buchungen_delete" ON steuer_buchungen AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_buchungen_insert" ON steuer_buchungen;
CREATE POLICY "steuer_buchungen_insert" ON steuer_buchungen AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_buchungen_select" ON steuer_buchungen;
CREATE POLICY "steuer_buchungen_select" ON steuer_buchungen AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_buchungen_update" ON steuer_buchungen;
CREATE POLICY "steuer_buchungen_update" ON steuer_buchungen AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "steuer_fixkosten_owner" ON steuer_fixkosten;
CREATE POLICY "steuer_fixkosten_owner" ON steuer_fixkosten AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "steuer_konten_delete" ON steuer_konten;
CREATE POLICY "steuer_konten_delete" ON steuer_konten AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_konten_insert" ON steuer_konten;
CREATE POLICY "steuer_konten_insert" ON steuer_konten AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_konten_select" ON steuer_konten;
CREATE POLICY "steuer_konten_select" ON steuer_konten AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_konten_update" ON steuer_konten;
CREATE POLICY "steuer_konten_update" ON steuer_konten AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "steuer_ustva_delete" ON steuer_ustva;
CREATE POLICY "steuer_ustva_delete" ON steuer_ustva AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_ustva_insert" ON steuer_ustva;
CREATE POLICY "steuer_ustva_insert" ON steuer_ustva AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_ustva_select" ON steuer_ustva;
CREATE POLICY "steuer_ustva_select" ON steuer_ustva AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "steuer_ustva_update" ON steuer_ustva;
CREATE POLICY "steuer_ustva_update" ON steuer_ustva AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can manage their tax receipts" ON tax_receipts;
CREATE POLICY "Users can manage their tax receipts" ON tax_receipts AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = created_by));

DROP POLICY IF EXISTS "user_only_insert" ON user_audit_log;
CREATE POLICY "user_only_insert" ON user_audit_log AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_only_select" ON user_audit_log;
CREATE POLICY "user_only_select" ON user_audit_log AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "user_design_prefs_delete_own" ON user_design_prefs;
CREATE POLICY "user_design_prefs_delete_own" ON user_design_prefs AS PERMISSIVE FOR DELETE
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_design_prefs_insert_own" ON user_design_prefs;
CREATE POLICY "user_design_prefs_insert_own" ON user_design_prefs AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_design_prefs_select_own" ON user_design_prefs;
CREATE POLICY "user_design_prefs_select_own" ON user_design_prefs AS PERMISSIVE FOR SELECT
  USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_design_prefs_update_own" ON user_design_prefs;
CREATE POLICY "user_design_prefs_update_own" ON user_design_prefs AS PERMISSIVE FOR UPDATE
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "user_messages_insert" ON user_messages;
CREATE POLICY "user_messages_insert" ON user_messages AS PERMISSIVE FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_messages_select" ON user_messages;
CREATE POLICY "user_messages_select" ON user_messages AS PERMISSIVE FOR SELECT
  USING ((((select auth.uid()) = user_id) OR pk_is_owner()));

DROP POLICY IF EXISTS "werkstatt_bereiche_user" ON werkstatt_bereiche;
CREATE POLICY "werkstatt_bereiche_user" ON werkstatt_bereiche AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "werkstatt_karten_user" ON werkstatt_karten;
CREATE POLICY "werkstatt_karten_user" ON werkstatt_karten AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "werkstatt_material_user" ON werkstatt_material;
CREATE POLICY "werkstatt_material_user" ON werkstatt_material AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "werkstatt_mitarbeiter_user" ON werkstatt_mitarbeiter;
CREATE POLICY "werkstatt_mitarbeiter_user" ON werkstatt_mitarbeiter AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "werkstatt_pruefprotokolle_user" ON werkstatt_pruefprotokolle;
CREATE POLICY "werkstatt_pruefprotokolle_user" ON werkstatt_pruefprotokolle AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "werkstatt_stoerungen_user" ON werkstatt_stoerungen;
CREATE POLICY "werkstatt_stoerungen_user" ON werkstatt_stoerungen AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "werkstatt_wartungen_user" ON werkstatt_wartungen;
CREATE POLICY "werkstatt_wartungen_user" ON werkstatt_wartungen AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "werkstatt_zeitbuchungen_user" ON werkstatt_zeitbuchungen;
CREATE POLICY "werkstatt_zeitbuchungen_user" ON werkstatt_zeitbuchungen AS PERMISSIVE FOR ALL
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));
