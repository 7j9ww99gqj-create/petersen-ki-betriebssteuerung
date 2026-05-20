/**
 * lib/db/qm.ts — QM-Pilot Daten-Layer (Phase 1)
 *
 * Tabellen: qm_zeichnungen, qm_pruefberichte, qm_messwerte, qm_fotos
 * Storage:  qm-zeichnungen, qm-fotos
 */
import { db, getCurrentUserId } from './_shared'

// ─────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────

export type QmErkanntesMass = {
  name: string
  wert: number
  einheit: string
  toleranz_plus?: number | null
  toleranz_minus?: number | null
  kritisch?: boolean
  konfidenz?: number
}

export type QmZeichnung = {
  id: string
  user_id: string
  name: string
  zeichnungsnummer: string | null
  revision: string | null
  datei_pfad: string | null
  material: string | null
  oberflaeche_anforderung: string | null
  beschichtung: string | null
  sonderanforderungen: string[] | null
  ki_konfidenz: number | null
  erkannte_masse: QmErkanntesMass[] | null
  erstellt_am: string
}

export type QmGesamtstatus = 'bestanden' | 'nachbesserung' | 'ausschuss' | 'offen'

export type QmPruefbericht = {
  id: string
  user_id: string
  zeichnung_id: string | null
  pruefbericht_nr: string
  bauteil_id: string | null
  chargennummer: string | null
  anzahl_geprueft: number | null
  pruef_datum: string | null
  pruefer_name: string | null
  gesamtstatus: QmGesamtstatus | null
  bemerkungen: string | null
  unterschrift_initialen: string | null
  gesperrt: boolean
  erstellt_am: string
}

export type QmMesswertStatus = 'gruen' | 'orange' | 'rot' | 'offen'

export type QmMesswert = {
  id: string
  pruefbericht_id: string
  messstelle: string
  sollwert: number | null
  toleranz_plus: number | null
  toleranz_minus: number | null
  istwert: number | null
  abweichung: number | null
  einheit: string | null
  status: QmMesswertStatus | null
  pruefmittel: string | null
  reihenfolge: number | null
}

export type QmFotoTyp = 'gesamt' | 'detail' | 'oberflaeche' | 'referenz'

export type QmKiSichtBefund = {
  typ: 'kratzer' | 'delle' | 'grat' | 'verschmutzung' | 'polierfehler' | 'beschaedigung' | 'sonstiges'
  schwere: 'leicht' | 'mittel' | 'schwer'
  position: string
  beschreibung: string
}

export type QmKiSichtErgebnis = {
  gesamtbewertung: 'ok' | 'mangelhaft' | 'ausschuss'
  konfidenz: number
  befunde: QmKiSichtBefund[]
  empfehlung: string
  hinweise: string[]
}

export type QmFoto = {
  id: string
  pruefbericht_id: string
  typ: QmFotoTyp | null
  datei_pfad: string
  beschreibung: string | null
  ki_analyse_ergebnis: QmKiSichtErgebnis | null
  erstellt_am: string
}

// ─────────────────────────────────────────────────────────────────────
// Zeichnungen
// ─────────────────────────────────────────────────────────────────────

export async function getQmZeichnungen(): Promise<QmZeichnung[]> {
  const { data, error } = await db()
    .from('qm_zeichnungen')
    .select('*')
    .order('erstellt_am', { ascending: false })
  if (error) throw error
  return (data ?? []) as QmZeichnung[]
}

export async function getQmZeichnung(id: string): Promise<QmZeichnung | null> {
  const { data, error } = await db()
    .from('qm_zeichnungen')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as QmZeichnung) ?? null
}

export type UpsertQmZeichnungInput = {
  id?: string
  name: string
  zeichnungsnummer?: string | null
  revision?: string | null
  datei_pfad?: string | null
  material?: string | null
  oberflaeche_anforderung?: string | null
  beschichtung?: string | null
  sonderanforderungen?: string[] | null
  ki_konfidenz?: number | null
  erkannte_masse?: QmErkanntesMass[] | null
}

export async function upsertQmZeichnung(input: UpsertQmZeichnungInput): Promise<QmZeichnung> {
  const userId = await getCurrentUserId()
  const payload = { ...input, user_id: userId }
  const { data, error } = await db()
    .from('qm_zeichnungen')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return data as QmZeichnung
}

export async function deleteQmZeichnung(id: string): Promise<void> {
  const { error } = await db().from('qm_zeichnungen').delete().eq('id', id)
  if (error) throw error
}

export async function uploadQmZeichnungsDatei(file: File | Blob, filename: string): Promise<string> {
  const supabase = db()
  const userId = await getCurrentUserId()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from('qm-zeichnungen').upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export async function getQmZeichnungsSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  const { data } = await db().storage.from('qm-zeichnungen').createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}

export async function deleteQmZeichnungsDatei(path: string): Promise<void> {
  if (!path) return
  const { error } = await db().storage.from('qm-zeichnungen').remove([path])
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────
// Prüfberichte
// ─────────────────────────────────────────────────────────────────────

export async function getQmPruefberichte(): Promise<QmPruefbericht[]> {
  const { data, error } = await db()
    .from('qm_pruefberichte')
    .select('*')
    .order('erstellt_am', { ascending: false })
  if (error) throw error
  return (data ?? []) as QmPruefbericht[]
}

export async function getQmPruefbericht(id: string): Promise<QmPruefbericht | null> {
  const { data, error } = await db()
    .from('qm_pruefberichte')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as QmPruefbericht) ?? null
}

export type UpsertQmPruefberichtInput = {
  id?: string
  zeichnung_id?: string | null
  pruefbericht_nr: string
  bauteil_id?: string | null
  chargennummer?: string | null
  anzahl_geprueft?: number | null
  pruef_datum?: string | null
  pruefer_name?: string | null
  gesamtstatus?: QmGesamtstatus | null
  bemerkungen?: string | null
  unterschrift_initialen?: string | null
  gesperrt?: boolean
}

export async function upsertQmPruefbericht(input: UpsertQmPruefberichtInput): Promise<QmPruefbericht> {
  const userId = await getCurrentUserId()
  const payload = { ...input, user_id: userId }
  const { data, error } = await db()
    .from('qm_pruefberichte')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return data as QmPruefbericht
}

export async function deleteQmPruefbericht(id: string): Promise<void> {
  const { error } = await db().from('qm_pruefberichte').delete().eq('id', id)
  if (error) throw error
}

/**
 * Generiert die nächste Prüfbericht-Nummer im Format PB-{YYYY}-{NNN}
 * basierend auf den Berichten des aktuellen Users im aktuellen Jahr.
 */
export async function nextQmPruefberichtNummer(): Promise<string> {
  const userId = await getCurrentUserId()
  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const { count, error } = await db()
    .from('qm_pruefberichte')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('pruef_datum', yearStart)
  if (error) throw error
  const next = (count ?? 0) + 1
  return `PB-${year}-${String(next).padStart(3, '0')}`
}

// ─────────────────────────────────────────────────────────────────────
// Messwerte
// ─────────────────────────────────────────────────────────────────────

export async function getQmMesswerte(pruefberichtId: string): Promise<QmMesswert[]> {
  const { data, error } = await db()
    .from('qm_messwerte')
    .select('*')
    .eq('pruefbericht_id', pruefberichtId)
    .order('reihenfolge', { ascending: true })
  if (error) throw error
  return (data ?? []) as QmMesswert[]
}

export type UpsertQmMesswertInput = {
  id?: string
  pruefbericht_id: string
  messstelle: string
  sollwert?: number | null
  toleranz_plus?: number | null
  toleranz_minus?: number | null
  istwert?: number | null
  einheit?: string | null
  status?: QmMesswertStatus | null
  pruefmittel?: string | null
  reihenfolge?: number | null
}

export async function upsertQmMesswert(input: UpsertQmMesswertInput): Promise<QmMesswert> {
  const { data, error } = await db()
    .from('qm_messwerte')
    .upsert(input, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return data as QmMesswert
}

export async function deleteQmMesswert(id: string): Promise<void> {
  const { error } = await db().from('qm_messwerte').delete().eq('id', id)
  if (error) throw error
}

/**
 * Ampel-Logik: berechnet den Status anhand Soll/Ist/Toleranz.
 *   Grün   → |Abw| ≤ 80% Toleranzband
 *   Orange → 80% < |Abw| ≤ 100%
 *   Rot    → |Abw| > Toleranzband
 *   Offen  → Istwert fehlt oder Toleranz fehlt
 */
export function ampelStatus(args: {
  sollwert: number | null | undefined
  istwert: number | null | undefined
  toleranz_plus: number | null | undefined
  toleranz_minus: number | null | undefined
}): QmMesswertStatus {
  const { sollwert, istwert, toleranz_plus, toleranz_minus } = args
  if (istwert === null || istwert === undefined || sollwert === null || sollwert === undefined) return 'offen'
  const band = (toleranz_plus ?? 0) + (toleranz_minus ?? 0)
  if (band <= 0) return 'offen'
  const abw = Math.abs(istwert - sollwert)
  if (abw > band) return 'rot'
  if (abw > band * 0.8) return 'orange'
  return 'gruen'
}

// ─────────────────────────────────────────────────────────────────────
// Fotos
// ─────────────────────────────────────────────────────────────────────

export async function getQmFotos(pruefberichtId: string): Promise<QmFoto[]> {
  const { data, error } = await db()
    .from('qm_fotos')
    .select('*')
    .eq('pruefbericht_id', pruefberichtId)
    .order('erstellt_am', { ascending: true })
  if (error) throw error
  return (data ?? []) as QmFoto[]
}

export type InsertQmFotoInput = {
  pruefbericht_id: string
  typ?: QmFotoTyp | null
  datei_pfad: string
  beschreibung?: string | null
}

export async function insertQmFoto(input: InsertQmFotoInput): Promise<QmFoto> {
  const { data, error } = await db()
    .from('qm_fotos')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data as QmFoto
}

export async function deleteQmFoto(id: string): Promise<void> {
  const { error } = await db().from('qm_fotos').delete().eq('id', id)
  if (error) throw error
}

export async function updateQmFotoKiAnalyse(id: string, ergebnis: QmKiSichtErgebnis): Promise<void> {
  const { error } = await db()
    .from('qm_fotos')
    .update({ ki_analyse_ergebnis: ergebnis })
    .eq('id', id)
  if (error) throw error
}

export async function getQmPruefberichtHatKiAnalyse(pruefberichtId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('qm_fotos')
    .select('id')
    .eq('pruefbericht_id', pruefberichtId)
    .not('ki_analyse_ergebnis', 'is', null)
    .limit(1)
  if (error) return false
  return (data?.length ?? 0) > 0
}

export async function getQmPruefberichtIdsMitKiAnalyse(): Promise<string[]> {
  const { data, error } = await db()
    .from('qm_fotos')
    .select('pruefbericht_id')
    .not('ki_analyse_ergebnis', 'is', null)
  if (error) return []
  return Array.from(new Set((data ?? []).map(r => r.pruefbericht_id as string)))
}

export async function uploadQmFoto(file: File | Blob, pruefberichtId: string, filename: string): Promise<string> {
  const supabase = db()
  const userId = await getCurrentUserId()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/${pruefberichtId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from('qm-fotos').upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export async function uploadQmFotoTemp(file: File | Blob, filename: string): Promise<string> {
  const supabase = db()
  const userId = await getCurrentUserId()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/temp_${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from('qm-fotos').upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export async function getQmFotoSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  const { data } = await db().storage.from('qm-fotos').createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}

export async function deleteQmFotoDatei(path: string): Promise<void> {
  if (!path) return
  const { error } = await db().storage.from('qm-fotos').remove([path])
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────
// Team-Mitglieder (Phase 2A)
// ─────────────────────────────────────────────────────────────────────

export type QmTeamRolle = 'admin' | 'pruefer' | 'viewer'

export type QmTeamMitglied = {
  id: string
  user_id: string
  name: string
  email: string | null
  rolle: QmTeamRolle
  aktiv: boolean
  erstellt_am: string
}

export async function getQmTeamMitglieder(): Promise<QmTeamMitglied[]> {
  const { data, error } = await db()
    .from('qm_team_mitglieder')
    .select('*')
    .order('erstellt_am', { ascending: true })
  if (error) throw error
  return (data ?? []) as QmTeamMitglied[]
}

export type UpsertQmTeamMitgliedInput = {
  id?: string
  name: string
  email?: string | null
  rolle?: QmTeamRolle
  aktiv?: boolean
}

export async function upsertQmTeamMitglied(m: UpsertQmTeamMitgliedInput): Promise<QmTeamMitglied> {
  const userId = await getCurrentUserId()
  const payload = { ...m, user_id: userId }
  const { data, error } = await db()
    .from('qm_team_mitglieder')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return data as QmTeamMitglied
}

export async function deleteQmTeamMitglied(id: string): Promise<void> {
  const { error } = await db().from('qm_team_mitglieder').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────
// Statistik-Queries (Phase 2A)
// ─────────────────────────────────────────────────────────────────────

export type QmStatistikZeitraum = 'woche' | 'monat' | 'quartal' | 'gesamt'

function zeitraumStart(z: QmStatistikZeitraum): string | null {
  const now = new Date()
  if (z === 'woche')   { const d = new Date(now); d.setDate(d.getDate() - 7);   return d.toISOString() }
  if (z === 'monat')   { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString() }
  if (z === 'quartal') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d.toISOString() }
  return null
}

export type QmStatusVerteilung = { gesamtstatus: string; anzahl: number }[]

export async function getQmStatusVerteilung(zeitraum: QmStatistikZeitraum): Promise<QmStatusVerteilung> {
  let q = db().from('qm_pruefberichte').select('gesamtstatus')
  const since = zeitraumStart(zeitraum)
  if (since) q = q.gte('pruef_datum', since.slice(0, 10))
  const { data, error } = await q
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of (data ?? [])) {
    const s = row.gesamtstatus ?? 'offen'
    counts[s] = (counts[s] ?? 0) + 1
  }
  return Object.entries(counts).map(([gesamtstatus, anzahl]) => ({ gesamtstatus, anzahl }))
}

export type QmFehlerquoteTrend = { woche: string; fehler: number; gesamt: number }[]

export async function getQmFehlerquoteTrend(): Promise<QmFehlerquoteTrend> {
  const since = new Date()
  since.setDate(since.getDate() - 56) // 8 Wochen
  const { data, error } = await db()
    .from('qm_pruefberichte')
    .select('pruef_datum, gesamtstatus')
    .gte('pruef_datum', since.toISOString().slice(0, 10))
    .order('pruef_datum', { ascending: true })
  if (error) throw error

  const weekMap = new Map<string, { fehler: number; gesamt: number }>()
  for (const row of (data ?? [])) {
    const d = new Date(row.pruef_datum ?? '')
    const day = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const wk = mon.toISOString().slice(0, 10)
    if (!weekMap.has(wk)) weekMap.set(wk, { fehler: 0, gesamt: 0 })
    const entry = weekMap.get(wk)!
    entry.gesamt++
    if (row.gesamtstatus === 'nachbesserung' || row.gesamtstatus === 'ausschuss') entry.fehler++
  }
  return Array.from(weekMap.entries()).map(([woche, v]) => ({ woche, ...v }))
}

export type QmHaeufigsteAbweichung = { messstelle: string; anzahl: number }[]

export async function getQmHaeufigsteAbweichungen(zeitraum: QmStatistikZeitraum): Promise<QmHaeufigsteAbweichung> {
  const since = zeitraumStart(zeitraum)
  let berichtQ = db().from('qm_pruefberichte').select('id')
  if (since) berichtQ = berichtQ.gte('pruef_datum', since.slice(0, 10))
  const { data: berichte, error: be } = await berichtQ
  if (be) throw be
  if (!berichte?.length) return []

  const berichtIds = berichte.map(b => b.id)
  const { data, error } = await db()
    .from('qm_messwerte')
    .select('messstelle')
    .in('pruefbericht_id', berichtIds)
    .eq('status', 'rot')
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of (data ?? [])) {
    const m = row.messstelle ?? 'Unbekannt'
    counts[m] = (counts[m] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([messstelle, anzahl]) => ({ messstelle, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl)
    .slice(0, 5)
}

export type QmPrueferPerformance = { pruefer_name: string; gesamt: number; bestanden: number }[]

export async function getQmPrueferPerformance(zeitraum: QmStatistikZeitraum): Promise<QmPrueferPerformance> {
  let q = db().from('qm_pruefberichte').select('pruefer_name, gesamtstatus')
  const since = zeitraumStart(zeitraum)
  if (since) q = q.gte('pruef_datum', since.slice(0, 10))
  const { data, error } = await q
  if (error) throw error

  const stats: Record<string, { gesamt: number; bestanden: number }> = {}
  for (const row of (data ?? [])) {
    const p = row.pruefer_name ?? 'Unbekannt'
    if (!stats[p]) stats[p] = { gesamt: 0, bestanden: 0 }
    stats[p].gesamt++
    if (row.gesamtstatus === 'bestanden') stats[p].bestanden++
  }
  return Object.entries(stats).map(([pruefer_name, v]) => ({ pruefer_name, ...v }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Messmittel-Kalibrierungs-Tracking (ISO 9001 §7.1.5)
// ─────────────────────────────────────────────────────────────────────────────

export type QmMessmittelStatus = 'ok' | 'faellig' | 'ueberfaellig'
export type QmMessmittelTyp = 'Schieblehre' | 'Mikrometer' | 'Rauheitsmesser' | 'Lehrdorn' | 'Sonstiges'

export type QmMessmittel = {
  id: string
  user_id: string
  name: string
  seriennummer: string | null
  hersteller: string | null
  typ: string | null
  messbereich: string | null
  aufloesung: string | null
  kalibriert_am: string | null
  kalibrierung_faellig_am: string | null
  kalibrierungs_intervall_tage: number | null
  status: QmMessmittelStatus
  notiz: string | null
  aktiv: boolean
  erstellt_am: string
}

function computeMessmittelStatus(m: QmMessmittel): QmMessmittelStatus {
  if (!m.kalibrierung_faellig_am) return 'ok'
  const heute = new Date()
  const faellig = new Date(m.kalibrierung_faellig_am)
  const bald = new Date(heute)
  bald.setDate(bald.getDate() + 30)
  if (faellig < heute) return 'ueberfaellig'
  if (faellig < bald) return 'faellig'
  return 'ok'
}

export async function getQmMessmittel(): Promise<QmMessmittel[]> {
  const { data, error } = await db()
    .from('qm_messmittel')
    .select('*')
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false })
  if (error) throw error
  return ((data ?? []) as QmMessmittel[]).map(m => ({ ...m, status: computeMessmittelStatus(m) }))
}

export type UpsertQmMessmittelInput = {
  id?: string
  name: string
  seriennummer?: string | null
  hersteller?: string | null
  typ?: string | null
  messbereich?: string | null
  aufloesung?: string | null
  kalibriert_am?: string | null
  kalibrierung_faellig_am?: string | null
  kalibrierungs_intervall_tage?: number | null
  notiz?: string | null
  aktiv?: boolean
}

export async function upsertQmMessmittel(m: UpsertQmMessmittelInput): Promise<QmMessmittel> {
  const payload = { ...m, id: m.id ?? undefined }
  const { data, error } = await db()
    .from('qm_messmittel')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  const row = data as QmMessmittel
  return { ...row, status: computeMessmittelStatus(row) }
}

export async function deleteQmMessmittel(id: string): Promise<void> {
  const { error } = await db().from('qm_messmittel').delete().eq('id', id)
  if (error) throw error
}
