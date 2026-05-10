/**
 * Petersen KI – Supabase Daten-Layer
 * Alle CRUD-Operationen für die Piloten.
 * Demo-Nutzer (hasDemoCookie) verwenden statische Daten in den Pilots.
 */
import { createSupabaseClient } from './supabase'

function db() { return createSupabaseClient() }

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export type FirmaEinstellungen = {
  id?: string
  user_id?: string
  firmenname: string
  logo_url?: string
  adresse?: string
  plz?: string
  ort?: string
  land?: string
  email?: string
  telefon?: string
  website?: string
  ansprechpartner?: string
  slogan?: string
  branche?: string
  ust_id?: string
  steuernummer?: string
  handelsregister?: string
  geschaeftsfuehrer?: string
  bankname?: string
  iban?: string
  bic?: string
  zahlungsziel_tage?: number
  standard_mwst?: number
  standard_waehrung?: string
  dokument_footer?: string
  briefpapier_layout?: Record<string, unknown>
  onboarding_completed?: boolean
  created_at?: string
  updated_at?: string
}

// ── FIRMA / MANDANT ───────────────────────────────────────────────────────────

export async function getFirmaEinstellungen() {
  const { data, error } = await db()
    .from('firma_einstellungen')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data as FirmaEinstellungen | null
}

export async function upsertFirmaEinstellungen(data: FirmaEinstellungen) {
  const { data: saved, error } = await db()
    .from('firma_einstellungen')
    .upsert({
      ...data,
      land: data.land || 'Deutschland',
      standard_waehrung: data.standard_waehrung || 'EUR',
      onboarding_completed: data.onboarding_completed ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return saved as FirmaEinstellungen
}

export async function uploadFirmenLogo(file: File) {
  const supabase = db()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Kein Benutzer für Logo-Upload gefunden.')
  const ext = file.name.split('.').pop() || 'png'
  const path = `${userId}/firma/logo_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('dokumente').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = await supabase.storage.from('dokumente').createSignedUrl(path, 60 * 60 * 24 * 365)
  return { path, url: data?.signedUrl ?? path }
}

export async function deleteFirmenLogo(pathOrUrl: string) {
  const marker = '/object/sign/dokumente/'
  const path = pathOrUrl.includes(marker)
    ? decodeURIComponent(pathOrUrl.split(marker)[1]?.split('?')[0] ?? '')
    : pathOrUrl
  if (!path) return
  const { error } = await db().storage.from('dokumente').remove([path])
  if (error) throw error
}

export async function markFirmaOnboardingCompleted() {
  const current = await getFirmaEinstellungen()
  if (!current) throw new Error('Keine Firmendaten vorhanden.')
  return upsertFirmaEinstellungen({ ...current, onboarding_completed: true })
}

// ── LAGER ────────────────────────────────────────────────────────────────────

export async function getLagerArtikel() {
  const { data, error } = await db().from('lager_artikel').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export async function upsertLagerArtikel(artikel: {
  id: string; name: string; kategorie?: string; bestand?: number
  einheit?: string; lagerplatz?: string; status?: string; mindestbestand?: number
}) {
  const { data, error } = await db()
    .from('lager_artikel')
    .upsert({ ...artikel, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteLagerArtikel(id: string) {
  const { error } = await db().from('lager_artikel').delete().eq('id', id)
  if (error) throw error
}

export async function getLagerBewegungen() {
  const { data, error } = await db()
    .from('lager_bewegungen')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function insertLagerBewegung(b: {
  typ: string; artikel: string; menge: number
  mitarbeiter?: string; status?: string
}) {
  const { data, error } = await db()
    .from('lager_bewegungen')
    .insert({ ...b, datum: today() })
    .select()
  if (error) throw error
  return data
}

// ── BÜRO ─────────────────────────────────────────────────────────────────────

export async function getBueroKunden() {
  const { data, error } = await db().from('buero_kunden').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export async function upsertBueroKunde(k: {
  id: string; name: string; typ?: string; ansprechpartner?: string
  email?: string; telefon?: string; ort?: string; umsatz?: string; status?: string
}) {
  const { data, error } = await db()
    .from('buero_kunden')
    .upsert({ ...k, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteBueroKunde(id: string) {
  const { error } = await db().from('buero_kunden').delete().eq('id', id)
  if (error) throw error
}

export async function getBueroAngebote() {
  const { data, error } = await db().from('buero_angebote').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertBueroAngebot(a: {
  id: string; kunde?: string; titel?: string; betrag?: string
  datum?: string; gueltig?: string; status?: string
}) {
  const { data, error } = await db()
    .from('buero_angebote')
    .upsert({ ...a, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getBueroAuftraege() {
  const { data, error } = await db().from('buero_auftraege').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertBueroAuftrag(a: {
  id: string; kunde?: string; beschreibung?: string; wert?: string
  start?: string; ende?: string; status?: string; fortschritt?: number
}) {
  const { data, error } = await db()
    .from('buero_auftraege')
    .upsert({ ...a, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getBueroRechnungen() {
  const { data, error } = await db().from('buero_rechnungen').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertBueroRechnung(r: {
  id: string; kunde?: string; betrag?: string; faellig?: string
  erstellt?: string; status?: string; bezahlt_am?: string
}) {
  const { data, error } = await db()
    .from('buero_rechnungen')
    .upsert({ ...r, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getBueroEingangsrechnungen() {
  const { data, error } = await db()
    .from('buero_eingangsrechnungen')
    .select('*')
    .order('faelligkeit', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertBueroEingangsrechnung(r: {
  id: string
  lieferant: string
  rechnungsnummer?: string
  rechnungsdatum?: string
  faelligkeit?: string
  betrag_netto?: number
  mwst?: number
  betrag_brutto?: number
  status?: string
  kategorie?: string
  iban?: string
  verwendungszweck?: string
  notiz?: string
  dokument_url?: string
  dokument_id?: string
  bezahlt_am?: string
}) {
  const { data, error } = await db()
    .from('buero_eingangsrechnungen')
    .upsert({ ...r, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteBueroEingangsrechnung(id: string) {
  const { error } = await db().from('buero_eingangsrechnungen').delete().eq('id', id)
  if (error) throw error
}

export async function markEingangsrechnungBezahlt(id: string, bezahlt_am?: string) {
  const { data, error } = await db()
    .from('buero_eingangsrechnungen')
    .update({
      status: 'bezahlt',
      bezahlt_am: bezahlt_am ?? new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
  if (error) throw error
  return data
}

export async function updateEingangsrechnungStatus(id: string, status: string) {
  const { data, error } = await db()
    .from('buero_eingangsrechnungen')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data
}

export async function getBueroDokumente() {
  const { data, error } = await db().from('buero_dokumente').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insertBueroDokument(d: {
  id: string; name: string; typ?: string; groesse?: string
  datum?: string; kategorie?: string; bezug?: string; storage_path?: string
}) {
  const { data, error } = await db().from('buero_dokumente').insert(d).select()
  if (error) throw error
  return data
}

export async function deleteBueroDokument(id: string) {
  const { error } = await db().from('buero_dokumente').delete().eq('id', id)
  if (error) throw error
}

// Datei in Storage hochladen
export async function uploadDokument(file: File, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}_${file.name}`
  const { error } = await db().storage.from('dokumente').upload(path, file)
  if (error) throw error
  return path
}

export async function getDokumentUrl(path: string): Promise<string> {
  const { data } = await db().storage.from('dokumente').createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

// ── WERKSTATT ────────────────────────────────────────────────────────────────

export async function getWerkstattKarten() {
  const { data, error } = await db().from('werkstatt_karten').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertWerkstattKarte(k: {
  id: string; auftragsnr?: string; beschreibung?: string; mitarbeiter?: string
  prioritaet?: string; status?: string; erstellt?: string; geplant?: string
  stunden?: number; fortschritt?: number; maschine?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_karten')
    .upsert({ ...k, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteWerkstattKarte(id: string) {
  const { error } = await db().from('werkstatt_karten').delete().eq('id', id)
  if (error) throw error
}

export async function getWerkstattZeitbuchungen() {
  const { data, error } = await db()
    .from('werkstatt_zeitbuchungen')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function insertWerkstattZeitbuchung(z: {
  mitarbeiter: string; auftragsnr: string; stunden: number
  datum?: string; taetigkeit?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_zeitbuchungen')
    .insert({ ...z, datum: z.datum ?? today() })
    .select()
  if (error) throw error
  return data
}

export async function getWerkstattMaterial() {
  const { data, error } = await db()
    .from('werkstatt_material')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function insertWerkstattMaterial(m: {
  artikel: string; menge: number; einheit?: string
  auftragsnr?: string; mitarbeiter?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_material')
    .insert({ ...m, datum: today() })
    .select()
  if (error) throw error
  return data
}

export async function getWerkstattPruefprotokolle() {
  const { data, error } = await db()
    .from('werkstatt_pruefprotokolle')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insertWerkstattPruefprotokoll(p: {
  auftragsnr: string; pruefpunkt: string; ergebnis?: string
  pruefer?: string; datum?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_pruefprotokolle')
    .insert({ ...p, datum: p.datum ?? today() })
    .select()
  if (error) throw error
  return data
}

// ── MARKETING ────────────────────────────────────────────────────────────────

export async function getMarketingKampagnen() {
  const { data, error } = await db().from('marketing_kampagnen').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingKampagne(k: {
  id: string; name: string; typ?: string; status?: string; zielgruppe?: string
  start?: string; ende?: string; empfaenger?: number; geoeffnet?: number
  geklickt?: number; konversionen?: number; budget?: string
}) {
  const { data, error } = await db()
    .from('marketing_kampagnen')
    .upsert({ ...k, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingLeads() {
  const { data, error } = await db().from('marketing_leads').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingLead(l: {
  id: string; name: string; firma?: string; email?: string; telefon?: string
  quelle?: string; status?: string; wert?: string; erstellt?: string; betreuer?: string
}) {
  const { data, error } = await db()
    .from('marketing_leads')
    .upsert({ ...l, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingNewsletter() {
  const { data, error } = await db().from('marketing_newsletter').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingNewsletter(n: {
  id: string; betreff: string; vorschau?: string; empfaenger?: number
  datum?: string; status?: string; oeffnungsrate?: number; klickrate?: number
}) {
  const { data, error } = await db()
    .from('marketing_newsletter')
    .upsert({ ...n, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

// ── PLANUNG ──────────────────────────────────────────────────────────────────

export async function getPlanungProjekte() {
  const { data, error } = await db().from('planung_projekte').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungProjekt(p: {
  id: string; name: string; kunde?: string; status?: string; start?: string
  ende?: string; budget?: string; fortschritt?: number; beschreibung?: string
  verantwortlich?: string; meilensteine?: object[]
}) {
  const { data, error } = await db()
    .from('planung_projekte')
    .upsert({ ...p, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deletePlanungProjekt(id: string) {
  const { error } = await db().from('planung_projekte').delete().eq('id', id)
  if (error) throw error
}

export async function getPlanungAufgaben() {
  const { data, error } = await db().from('planung_aufgaben').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungAufgabe(a: {
  id: string; titel: string; projekt?: string; verantwortlich?: string
  prioritaet?: string; status?: string; faellig?: string; erstellt?: string
}) {
  const { data, error } = await db()
    .from('planung_aufgaben')
    .upsert({ ...a, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deletePlanungAufgabe(id: string) {
  const { error } = await db().from('planung_aufgaben').delete().eq('id', id)
  if (error) throw error
}

export async function getPlanungTermine() {
  const { data, error } = await db().from('planung_termine').select('*').order('datum')
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungTermin(t: {
  id: string; titel: string; datum?: string; uhrzeit?: string
  typ?: string; projekt?: string; teilnehmer?: string
}) {
  const { data, error } = await db().from('planung_termine').upsert(t).select()
  if (error) throw error
  return data
}

export async function deletePlanungTermin(id: string) {
  const { error } = await db().from('planung_termine').delete().eq('id', id)
  if (error) throw error
}

// ── EINKAUF / LIEFERANTEN ────────────────────────────────────────────────────

export async function getEinkaufLieferanten() {
  const { data, error } = await db().from('einkauf_lieferanten').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertEinkaufLieferant(l: {
  id: string; name: string; kontakt?: string; email?: string; telefon?: string
  ort?: string; kategorie?: string; zahlungsziel?: string; status?: string; bewertung?: number
}) {
  const { data, error } = await db()
    .from('einkauf_lieferanten')
    .upsert({ ...l, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteEinkaufLieferant(id: string) {
  const { error } = await db().from('einkauf_lieferanten').delete().eq('id', id)
  if (error) throw error
}

export async function getEinkaufBestellungen() {
  const { data, error } = await db().from('einkauf_bestellungen').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertEinkaufBestellung(b: {
  id: string; lieferant?: string; artikel?: string; menge?: number; einheit?: string
  einkaufspreis?: string; gesamt?: string; status?: string; bestellt_am?: string
  erwartet_am?: string; geliefert_am?: string; notiz?: string
}) {
  const { data, error } = await db()
    .from('einkauf_bestellungen')
    .upsert({ ...b, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getEinkaufWareneingaenge() {
  const { data, error } = await db()
    .from('einkauf_wareneingaenge')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function insertEinkaufWareneingang(w: {
  id: string; bestellung_id?: string; lieferant?: string; artikel?: string
  menge?: number; einheit?: string; datum?: string; qualitaet?: string; mitarbeiter?: string
}) {
  const { data, error } = await db().from('einkauf_wareneingaenge').insert(w).select()
  if (error) throw error
  return data
}

export async function getPlanungRessourcen() {
  const { data, error } = await db().from('planung_ressourcen').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungRessource(r: {
  id: string; name: string; typ?: string; kapazitaet?: number
  genutzt?: number; projekt?: string; status?: string
}) {
  const { data, error } = await db()
    .from('planung_ressourcen')
    .upsert({ ...r, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

// ── STEUER ────────────────────────────────────────────────────────────────────

export async function getSteuerBelege() {
  const { data, error } = await db().from('steuer_belege').select('*').order('datum', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerBeleg(b: {
  id: string; lieferant: string; betrag: number; steuerbetrag: number
  steuersatz: number; datum: string; status: string; datei_url?: string; notiz?: string
}) {
  const { data, error } = await db().from('steuer_belege').upsert(b).select()
  if (error) throw error
  return data
}

export async function deleteSteuerBeleg(id: string) {
  const { error } = await db().from('steuer_belege').delete().eq('id', id)
  if (error) throw error
}

export async function getSteuerUstva() {
  const { data, error } = await db().from('steuer_ustva').select('*').order('monat', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerUstva(u: {
  id: string; monat: string; umsatzsteuer: number; vorsteuer: number
  zahllast: number; status: string
}) {
  const { data, error } = await db().from('steuer_ustva').upsert(u).select()
  if (error) throw error
  return data
}

export async function uploadSteuerBeleg(file: File, userId: string): Promise<string> {
  const supabase = createSupabaseClient()
  const ext = file.name.split('.').pop()
  const path = `steuer/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('dokumente').upload(path, file)
  if (error) throw error
  return path
}

// ── STEUER BUCHUNGEN ──────────────────────────────────────────────────────────

export async function getSteuerBuchungen() {
  const { data, error } = await db().from('steuer_buchungen').select('*').order('datum', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerBuchung(b: {
  id: string; datum: string; buchungstext: string; betrag: number
  soll_konto?: string; haben_konto?: string; steuerkonto?: string
  steuersatz?: number; beleg_id?: string; status?: string
}) {
  const { data, error } = await db().from('steuer_buchungen').upsert(b).select()
  if (error) throw error
  return data
}

// ── STEUER KONTEN ─────────────────────────────────────────────────────────────

export async function getSteuerKonten() {
  const { data, error } = await db().from('steuer_konten').select('*').order('kontonummer')
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerKonto(k: {
  id: string; kontonummer: string; name: string; typ?: string; steuersatz?: number; aktiv?: boolean
}) {
  const { data, error } = await db().from('steuer_konten').upsert(k).select()
  if (error) throw error
  return data
}

// ── IMPORT PROTOKOLLE ─────────────────────────────────────────────────────────

export async function getImportProtokolle() {
  const { data, error } = await db().from('import_protokolle').select('*').order('erstellt_am', { ascending: false }).limit(50)
  if (error) throw error
  return data ?? []
}

export async function insertImportProtokoll(p: {
  id: string; quelle: string; datentyp: string; dateiname: string; status: string
  anzahl_gesamt: number; anzahl_erfolgreich: number; anzahl_fehlerhaft: number; fehler?: object
}) {
  const { data, error } = await db().from('import_protokolle').insert(p).select()
  if (error) throw error
  return data
}

// ── BULK INSERT HELPERS ────────────────────────────────────────────────────────

export async function bulkImportLagerArtikel(rows: Array<{
  id: string; name: string; artikelnummer?: string; beschreibung?: string
  bestand?: number; mindestbestand?: number; einkaufspreis?: number
  verkaufspreis?: number; einheit?: string; lagerort?: string
}>) {
  const { data, error } = await db().from('lager_artikel').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportBueroKunden(rows: Array<{
  id: string; name: string; email?: string; telefon?: string
  adresse?: string; kundennummer?: string; notizen?: string
}>) {
  const { data, error } = await db().from('buero_kunden').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportEinkaufLieferanten(rows: Array<{
  id: string; name: string; email?: string; telefon?: string
  ort?: string; kategorie?: string; zahlungsziel?: string; notiz?: string
}>) {
  const { data, error } = await db().from('einkauf_lieferanten').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportBueroRechnungen(rows: Array<{
  id: string; nummer: string; kunde?: string; datum?: string
  faellig_am?: string; summe?: number; status?: string; notiz?: string
}>) {
  const { data, error } = await db().from('buero_rechnungen').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportSteuerBelege(rows: Array<{
  id: string; lieferant: string; betrag: number; datum: string
  steuerbetrag?: number; steuersatz?: number; belegnummer?: string
  kategorie?: string; status?: string; notiz?: string
}>) {
  const { data, error } = await db().from('steuer_belege').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportSteuerBuchungen(rows: Array<{
  id: string; datum: string; buchungstext: string; betrag: number
  soll_konto?: string; haben_konto?: string; steuerkonto?: string
  steuersatz?: number; beleg_id?: string; status?: string
}>) {
  const { data, error } = await db().from('steuer_buchungen').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportSteuerKonten(rows: Array<{
  id: string; kontonummer: string; name: string; typ?: string; steuersatz?: number; aktiv?: boolean
}>) {
  const { data, error } = await db().from('steuer_konten').insert(rows).select()
  if (error) throw error
  return data
}

// ── LAGER STELLPLÄTZE ─────────────────────────────────────────────────────────

export async function getLagerStellplaetze() {
  const { data, error } = await db()
    .from('lager_stellplaetze')
    .select('*')
    .order('code')
  if (error) throw error
  return data ?? []
}

export async function upsertLagerStellplatz(s: {
  id: string; code: string; name?: string; bereich?: string; zone?: string
  gang?: string; regal?: string; ebene?: string; fach?: string; typ?: string
  warengruppe?: string; warenobergruppe?: string; temperaturzone?: string
  max_gewicht?: number; max_volumen?: number; aktiv?: boolean; notiz?: string
}) {
  const { data, error } = await db()
    .from('lager_stellplaetze')
    .upsert({ ...s, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteLagerStellplatz(id: string) {
  const { error } = await db().from('lager_stellplaetze').delete().eq('id', id)
  if (error) throw error
}

// ── LAGER STELLPLATZ-BESTAND ──────────────────────────────────────────────────

export async function getLagerStellplatzBestand() {
  const { data, error } = await db()
    .from('lager_stellplatz_bestand')
    .select('*, lager_stellplaetze(code, bereich, warengruppe, warenobergruppe)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertLagerStellplatzBestand(b: {
  id: string; stellplatz_id: string; artikel_id?: string
  artikelnummer?: string; artikelname?: string; charge?: string
  mhd?: string; menge: number; einheit?: string; status?: string
  eingelagert_am?: string; notiz?: string
}) {
  const { data, error } = await db()
    .from('lager_stellplatz_bestand')
    .upsert(b)
    .select()
  if (error) throw error
  return data
}

export async function deleteLagerStellplatzBestand(id: string) {
  const { error } = await db().from('lager_stellplatz_bestand').delete().eq('id', id)
  if (error) throw error
}

// ── LAGER UMLAGERUNGEN ────────────────────────────────────────────────────────

export async function getLagerUmlagerungen() {
  const { data, error } = await db()
    .from('lager_umlagerungen')
    .select('*')
    .order('datum', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function insertLagerUmlagerung(u: {
  id: string; artikel_id?: string; artikelnummer?: string; artikelname?: string
  von_stellplatz_id?: string; nach_stellplatz_id?: string; charge?: string
  mhd?: string; menge: number; grund?: string; datum?: string; notiz?: string
}) {
  const { data, error } = await db()
    .from('lager_umlagerungen')
    .insert(u)
    .select()
  if (error) throw error
  return data
}

export async function umlagerArtikel(params: {
  vonBestandId: string
  nachStellplatzId: string
  menge: number
  charge?: string
  mhd?: string
  grund?: string
  notiz?: string
  artikelname?: string
  artikelnummer?: string
  artikelId?: string
  vonStellplatzId?: string
}) {
  const supabase = db()

  // 1. Quell-Bestand laden
  const { data: von, error: vonErr } = await supabase
    .from('lager_stellplatz_bestand')
    .select('*')
    .eq('id', params.vonBestandId)
    .single()
  if (vonErr || !von) throw new Error('Quell-Bestand nicht gefunden')
  if (von.menge < params.menge) throw new Error(`Nur ${von.menge} ${von.einheit ?? 'Stk'} verfügbar`)

  // 2. Quell-Menge reduzieren oder Datensatz löschen
  if (von.menge === params.menge) {
    await supabase.from('lager_stellplatz_bestand').delete().eq('id', params.vonBestandId)
  } else {
    await supabase.from('lager_stellplatz_bestand')
      .update({ menge: von.menge - params.menge })
      .eq('id', params.vonBestandId)
  }

  // 3. Ziel-Bestand suchen (gleicher Artikel+Charge+MHD am Ziel-Stellplatz)
  const { data: zielRows } = await supabase
    .from('lager_stellplatz_bestand')
    .select('*')
    .eq('stellplatz_id', params.nachStellplatzId)
    .eq('artikelnummer', von.artikelnummer ?? '')
    .eq('charge', params.charge ?? von.charge ?? '')

  if (zielRows && zielRows.length > 0) {
    await supabase.from('lager_stellplatz_bestand')
      .update({ menge: zielRows[0].menge + params.menge })
      .eq('id', zielRows[0].id)
  } else {
    await supabase.from('lager_stellplatz_bestand').insert({
      id: crypto.randomUUID(),
      stellplatz_id: params.nachStellplatzId,
      artikel_id: von.artikel_id,
      artikelnummer: von.artikelnummer,
      artikelname: von.artikelname,
      charge: params.charge ?? von.charge,
      mhd: params.mhd ?? von.mhd,
      menge: params.menge,
      einheit: von.einheit,
      status: 'Verfügbar',
      eingelagert_am: new Date().toISOString().slice(0, 10),
    })
  }

  // 4. Umlagerung dokumentieren
  await supabase.from('lager_umlagerungen').insert({
    id: `UML-${Date.now().toString(36).toUpperCase()}`,
    artikel_id: von.artikel_id,
    artikelnummer: von.artikelnummer,
    artikelname: von.artikelname,
    von_stellplatz_id: von.stellplatz_id,
    nach_stellplatz_id: params.nachStellplatzId,
    charge: params.charge ?? von.charge,
    mhd: params.mhd ?? von.mhd,
    menge: params.menge,
    grund: params.grund,
    notiz: params.notiz,
    datum: new Date().toISOString(),
  })
}
