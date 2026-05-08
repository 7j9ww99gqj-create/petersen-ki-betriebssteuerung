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

// ── LAGER ────────────────────────────────────────────────────────────────────

export async function getLagerArtikel() {
  const { data, error } = await db().from('lager_artikel').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export async function upsertLagerArtikel(artikel: {
  id: string; name: string; kategorie?: string; bestand?: number
  einheit?: string; lagerplatz?: string; status?: string
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
