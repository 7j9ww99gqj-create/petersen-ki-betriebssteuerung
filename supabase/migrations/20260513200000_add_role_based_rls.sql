-- ── Rollenbasierte RLS-Policies ─────────────────────────────────────────────
-- Liest die App-Rolle aus dem JWT (app_metadata.role).
-- Fallback: 'Mitarbeiter', damit bestehende User ohne explizite Rolle weiter
-- lesen und schreiben können. Delete/Create wird auf Admin+Mitarbeiter+Büro
-- eingeschränkt; reine Lager/Werkstatt-Rollen erhalten nur Lesezugriff.

create or replace function pk_get_role()
returns text
language sql
stable security definer
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    'Mitarbeiter'
  );
$$;

-- Hilfsfunktion: Darf der aktuelle User schreiben (Insert/Update/Delete)?
create or replace function pk_can_write()
returns boolean
language sql
stable security definer
as $$
  select pk_get_role() in ('Admin', 'Mitarbeiter', 'Büro');
$$;

-- ── BüroPilot ────────────────────────────────────────────────────────────────

-- buero_kunden
drop policy if exists "buero_kunden_user" on buero_kunden;
create policy "buero_kunden_select" on buero_kunden
  for select using (auth.uid() = user_id);
create policy "buero_kunden_insert" on buero_kunden
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "buero_kunden_update" on buero_kunden
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "buero_kunden_delete" on buero_kunden
  for delete using (auth.uid() = user_id and pk_can_write());

-- buero_angebote
drop policy if exists "buero_angebote_user" on buero_angebote;
create policy "buero_angebote_select" on buero_angebote
  for select using (auth.uid() = user_id);
create policy "buero_angebote_insert" on buero_angebote
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "buero_angebote_update" on buero_angebote
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "buero_angebote_delete" on buero_angebote
  for delete using (auth.uid() = user_id and pk_can_write());

-- buero_auftraege
drop policy if exists "buero_auftraege_user" on buero_auftraege;
create policy "buero_auftraege_select" on buero_auftraege
  for select using (auth.uid() = user_id);
create policy "buero_auftraege_insert" on buero_auftraege
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "buero_auftraege_update" on buero_auftraege
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "buero_auftraege_delete" on buero_auftraege
  for delete using (auth.uid() = user_id and pk_can_write());

-- buero_rechnungen
drop policy if exists "buero_rechnungen_user" on buero_rechnungen;
create policy "buero_rechnungen_select" on buero_rechnungen
  for select using (auth.uid() = user_id);
create policy "buero_rechnungen_insert" on buero_rechnungen
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "buero_rechnungen_update" on buero_rechnungen
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "buero_rechnungen_delete" on buero_rechnungen
  for delete using (auth.uid() = user_id and pk_can_write());

-- buero_eingangsrechnungen
drop policy if exists "buero_eingangsrechnungen_user" on buero_eingangsrechnungen;
create policy "buero_eingangsrechnungen_select" on buero_eingangsrechnungen
  for select using (auth.uid() = user_id);
create policy "buero_eingangsrechnungen_insert" on buero_eingangsrechnungen
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "buero_eingangsrechnungen_update" on buero_eingangsrechnungen
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "buero_eingangsrechnungen_delete" on buero_eingangsrechnungen
  for delete using (auth.uid() = user_id and pk_can_write());

-- buero_dokumente
drop policy if exists "buero_dokumente_user" on buero_dokumente;
create policy "buero_dokumente_select" on buero_dokumente
  for select using (auth.uid() = user_id);
create policy "buero_dokumente_insert" on buero_dokumente
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "buero_dokumente_update" on buero_dokumente
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "buero_dokumente_delete" on buero_dokumente
  for delete using (auth.uid() = user_id and pk_can_write());

-- ── Einkauf ──────────────────────────────────────────────────────────────────

-- einkauf_lieferanten
drop policy if exists "einkauf_lieferanten_user" on einkauf_lieferanten;
create policy "einkauf_lieferanten_select" on einkauf_lieferanten
  for select using (auth.uid() = user_id);
create policy "einkauf_lieferanten_insert" on einkauf_lieferanten
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "einkauf_lieferanten_update" on einkauf_lieferanten
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "einkauf_lieferanten_delete" on einkauf_lieferanten
  for delete using (auth.uid() = user_id and pk_can_write());

-- einkauf_bestellungen
drop policy if exists "einkauf_bestellungen_user" on einkauf_bestellungen;
create policy "einkauf_bestellungen_select" on einkauf_bestellungen
  for select using (auth.uid() = user_id);
create policy "einkauf_bestellungen_insert" on einkauf_bestellungen
  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "einkauf_bestellungen_update" on einkauf_bestellungen
  for update using (auth.uid() = user_id and pk_can_write())
  with check (auth.uid() = user_id and pk_can_write());
create policy "einkauf_bestellungen_delete" on einkauf_bestellungen
  for delete using (auth.uid() = user_id and pk_can_write());

-- einkauf_wareneingaenge (kein Delete vorgesehen – bleibt Append-only)
drop policy if exists "einkauf_wareneingaenge_user" on einkauf_wareneingaenge;
create policy "einkauf_wareneingaenge_select" on einkauf_wareneingaenge
  for select using (auth.uid() = user_id);
create policy "einkauf_wareneingaenge_insert" on einkauf_wareneingaenge
  for insert with check (auth.uid() = user_id and pk_get_role() in ('Admin', 'Mitarbeiter', 'Lager', 'Werkstatt', 'Büro'));

-- ── Marketing ────────────────────────────────────────────────────────────────

drop policy if exists "marketing_kampagnen_user"          on marketing_kampagnen;
drop policy if exists "marketing_leads_user"              on marketing_leads;
drop policy if exists "marketing_newsletter_user"         on marketing_newsletter;
drop policy if exists "marketing_seo_keywords_user"       on marketing_seo_keywords;
drop policy if exists "marketing_content_ideas_user"      on marketing_content_ideas;
drop policy if exists "marketing_posting_plans_user"      on marketing_posting_plans;
drop policy if exists "marketing_automation_rules_user"   on marketing_automation_rules;
drop policy if exists "marketing_integration_items_user"  on marketing_integration_items;

create policy "marketing_kampagnen_select"    on marketing_kampagnen    for select using (auth.uid() = user_id);
create policy "marketing_kampagnen_write"     on marketing_kampagnen    for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_kampagnen_update"    on marketing_kampagnen    for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_kampagnen_delete"    on marketing_kampagnen    for delete using (auth.uid() = user_id and pk_can_write());

create policy "marketing_leads_select"        on marketing_leads        for select using (auth.uid() = user_id);
create policy "marketing_leads_write"         on marketing_leads        for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_leads_update"        on marketing_leads        for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_leads_delete"        on marketing_leads        for delete using (auth.uid() = user_id and pk_can_write());

create policy "marketing_newsletter_select"   on marketing_newsletter   for select using (auth.uid() = user_id);
create policy "marketing_newsletter_write"    on marketing_newsletter   for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_newsletter_update"   on marketing_newsletter   for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_newsletter_delete"   on marketing_newsletter   for delete using (auth.uid() = user_id and pk_can_write());

create policy "marketing_seo_select"          on marketing_seo_keywords      for select using (auth.uid() = user_id);
create policy "marketing_seo_write"           on marketing_seo_keywords      for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_seo_update"          on marketing_seo_keywords      for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_seo_delete"          on marketing_seo_keywords      for delete using (auth.uid() = user_id and pk_can_write());

create policy "marketing_content_select"      on marketing_content_ideas     for select using (auth.uid() = user_id);
create policy "marketing_content_write"       on marketing_content_ideas     for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_content_update"      on marketing_content_ideas     for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_content_delete"      on marketing_content_ideas     for delete using (auth.uid() = user_id and pk_can_write());

create policy "marketing_posting_select"      on marketing_posting_plans     for select using (auth.uid() = user_id);
create policy "marketing_posting_write"       on marketing_posting_plans     for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_posting_update"      on marketing_posting_plans     for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_posting_delete"      on marketing_posting_plans     for delete using (auth.uid() = user_id and pk_can_write());

create policy "marketing_automation_select"   on marketing_automation_rules  for select using (auth.uid() = user_id);
create policy "marketing_automation_write"    on marketing_automation_rules  for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_automation_update"   on marketing_automation_rules  for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_automation_delete"   on marketing_automation_rules  for delete using (auth.uid() = user_id and pk_can_write());

create policy "marketing_integration_select"  on marketing_integration_items for select using (auth.uid() = user_id);
create policy "marketing_integration_write"   on marketing_integration_items for insert with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_integration_update"  on marketing_integration_items for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "marketing_integration_delete"  on marketing_integration_items for delete using (auth.uid() = user_id and pk_can_write());

-- ── Planung ──────────────────────────────────────────────────────────────────

drop policy if exists "planung_projekte_user"   on planung_projekte;
drop policy if exists "planung_aufgaben_user"   on planung_aufgaben;
drop policy if exists "planung_termine_user"    on planung_termine;
drop policy if exists "planung_ressourcen_user" on planung_ressourcen;

create policy "planung_projekte_select"   on planung_projekte   for select using (auth.uid() = user_id);
create policy "planung_projekte_write"    on planung_projekte   for insert with check (auth.uid() = user_id and pk_can_write());
create policy "planung_projekte_update"   on planung_projekte   for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "planung_projekte_delete"   on planung_projekte   for delete using (auth.uid() = user_id and pk_can_write());

create policy "planung_aufgaben_select"   on planung_aufgaben   for select using (auth.uid() = user_id);
create policy "planung_aufgaben_write"    on planung_aufgaben   for insert with check (auth.uid() = user_id and pk_can_write());
create policy "planung_aufgaben_update"   on planung_aufgaben   for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "planung_aufgaben_delete"   on planung_aufgaben   for delete using (auth.uid() = user_id and pk_can_write());

create policy "planung_termine_select"    on planung_termine    for select using (auth.uid() = user_id);
create policy "planung_termine_write"     on planung_termine    for insert with check (auth.uid() = user_id and pk_can_write());
create policy "planung_termine_update"    on planung_termine    for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "planung_termine_delete"    on planung_termine    for delete using (auth.uid() = user_id and pk_can_write());

create policy "planung_ressourcen_select" on planung_ressourcen for select using (auth.uid() = user_id);
create policy "planung_ressourcen_write"  on planung_ressourcen for insert with check (auth.uid() = user_id and pk_can_write());
create policy "planung_ressourcen_update" on planung_ressourcen for update using (auth.uid() = user_id and pk_can_write()) with check (auth.uid() = user_id and pk_can_write());
create policy "planung_ressourcen_delete" on planung_ressourcen for delete using (auth.uid() = user_id and pk_can_write());
