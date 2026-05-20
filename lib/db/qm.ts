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

export type QmFoto = {
  id: string
  pruefbericht_id: string
  typ: QmFotoTyp | null
  datei_pfad: string
  beschreibung: string | null
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

export async function uploadQmFoto(file: File | Blob, pruefberichtId: string, filename: string): Promise<string> {
  const supabase = db()
  const userId = await getCurrentUserId()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/${pruefberichtId}/${Date.now()}_${safeName}`
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
