import { getDokumentUrl, getBueroDokumentById } from '@/lib/db'
import { normalizeDocumentStoragePath, type StoredDocumentLink } from '@/lib/documents'

// ── Typen ───────────────────────────────────────────────────────────────────

export type Kunde = {
  id: string; name: string; typ: 'Firma' | 'Privat'; ansprechpartner: string
  email: string; telefon: string; ort: string; umsatz: string; status: 'Aktiv' | 'Inaktiv'
}

export type Angebot = {
  id: string; kunde_id?: string; kunde: string; titel: string; betrag: string; datum: string
  gueltig: string; status: 'Entwurf' | 'Erstellt' | 'Versendet' | 'Akzeptiert' | 'Abgelehnt'
  nummer?: string; verschickt_am?: string
  positionen?: Position[]
}

export type Auftrag = {
  id: string; kunde_id?: string; kunde: string; beschreibung: string; wert: string
  start: string; ende: string; status: 'AB erforderlich' | 'AB erstellt' | 'AB versendet' | 'In Bearbeitung' | 'Abgeschlossen' | 'Geplant' | 'Pausiert'
  fortschritt: number; angebot_id?: string; ab_verschickt_am?: string; ab_nummer?: string
  positionen?: Position[]
}

export type Position = { id: string; beschreibung: string; menge: number; einheit: string; einzelpreis: number }

export type Rechnung = {
  id: string; nummer?: string; kunde_id?: string; kunde: string; betrag: string; faellig: string
  erstellt: string; status: 'Erstellt' | 'Offen' | 'Bezahlt' | 'Überfällig' | 'Mahnung'
  bezahltAm?: string; mahnung_count?: number; positionen?: Position[]
}

export type Dokument = {
  id: string; name: string; typ: string; groesse: string; datum: string
  kategorie: 'Angebot' | 'Rechnung' | 'Vertrag' | 'Sonstiges'; bezug: string
  storage_path?: string
  eingangsrechnung_id?: string
  rechnung_id?: string
  angebot_id?: string
  auftrag_id?: string
}

export type EingangsrechnungStatus = 'offen' | 'geprüft' | 'freigegeben' | 'bezahlt' | 'überfällig' | 'abgelehnt'

export type Eingangsrechnung = {
  id: string
  lieferant_id?: string
  lieferant: string
  rechnungsnummer?: string
  rechnungsdatum?: string
  faelligkeit?: string
  betrag_netto?: number
  mwst?: number
  betrag_brutto?: number
  status: EingangsrechnungStatus
  kategorie?: string
  iban?: string
  verwendungszweck?: string
  notiz?: string
  dokument_url?: string
  dokument_id?: string
  bezahlt_am?: string
  created_at?: string
  updated_at?: string
}

export type DocumentRelationField = 'eingangsrechnung_id' | 'rechnung_id' | 'angebot_id' | 'auftrag_id'
export const documentRelationFields: DocumentRelationField[] = ['eingangsrechnung_id', 'rechnung_id', 'angebot_id', 'auftrag_id']

export type Tab = 'kunden' | 'angebote' | 'auftraege' | 'rechnungen' | 'eingangsrechnungen' | 'dokumente' | 'einkauf' | 'alerts' | 'pipeline'

// Einkauf/Lieferanten-Typen
export type Lieferant = {
  id: string; name: string; kontakt: string; email: string; telefon: string
  ort: string; kategorie: string; zahlungsziel: string; status: 'Aktiv' | 'Inaktiv'; bewertung: number
}
export type EinkaufsBestellung = {
  id: string; lieferant_id?: string; lieferant: string; artikel: string; menge: number; einheit: string
  einkaufspreis: string; gesamt: string; status: 'Entwurf' | 'Bestellt' | 'Teillieferung' | 'Geliefert' | 'Storniert'
  bestellt_am: string; erwartet_am: string; geliefert_am?: string; notiz?: string
}
export type Wareneingang = {
  id: string; bestellung_id: string; lieferant: string; artikel: string
  menge: number; einheit: string; datum: string; qualitaet: 'OK' | 'Mängel' | 'Abgelehnt'; mitarbeiter: string
}

export type EinkaufSubTab = 'lieferanten' | 'bestellungen' | 'wareneingaenge'

// ── Demo-Daten ──────────────────────────────────────────────────────────────

export const demoKunden: Kunde[] = [
  { id: 'K-001', name: 'Müller Bau GmbH', typ: 'Firma', ansprechpartner: 'Thomas Müller', email: 't.mueller@muellerbu.de', telefon: '040 12345-0', ort: 'Hamburg', umsatz: '84.200 €', status: 'Aktiv' },
  { id: 'K-002', name: 'Schmidt & Partner', typ: 'Firma', ansprechpartner: 'Anna Schmidt', email: 'a.schmidt@sp-kg.de', telefon: '030 98765-10', ort: 'Berlin', umsatz: '31.500 €', status: 'Aktiv' },
  { id: 'K-003', name: 'Technik Nord AG', typ: 'Firma', ansprechpartner: 'Lars Brandt', email: 'l.brandt@techniknord.de', telefon: '0511 44400', ort: 'Hannover', umsatz: '127.800 €', status: 'Aktiv' },
  { id: 'K-004', name: 'Hans Werner', typ: 'Privat', ansprechpartner: 'Hans Werner', email: 'h.werner@web.de', telefon: '0172 5551234', ort: 'Bremen', umsatz: '4.600 €', status: 'Aktiv' },
  { id: 'K-005', name: 'Delta Logistik KG', typ: 'Firma', ansprechpartner: 'Sandra Koch', email: 's.koch@delta-log.de', telefon: '0211 3330', ort: 'Düsseldorf', umsatz: '56.100 €', status: 'Aktiv' },
  { id: 'K-006', name: 'Ritter Elektro GmbH', typ: 'Firma', ansprechpartner: 'Jens Ritter', email: 'j.ritter@ritter-e.de', telefon: '089 10203', ort: 'München', umsatz: '19.200 €', status: 'Inaktiv' },
]

export const demoAngebote: Angebot[] = [
  { id: 'ANG-2025-042', kunde: 'Müller Bau GmbH', titel: 'Stahlkonstruktion Hallenerweiterung', betrag: '18.400,00 €', datum: '02.05.2025', gueltig: '01.06.2025', status: 'Versendet' },
  { id: 'ANG-2025-041', kunde: 'Technik Nord AG', titel: 'Wartungsvertrag 2025/26', betrag: '7.200,00 €', datum: '28.04.2025', gueltig: '28.05.2025', status: 'Akzeptiert' },
  { id: 'ANG-2025-040', kunde: 'Delta Logistik KG', titel: 'Regalanlage Lager Ost', betrag: '12.850,00 €', datum: '25.04.2025', gueltig: '25.05.2025', status: 'Entwurf' },
  { id: 'ANG-2025-039', kunde: 'Schmidt & Partner', titel: 'Büromöbel Ausstattung', betrag: '5.640,00 €', datum: '18.04.2025', gueltig: '18.05.2025', status: 'Abgelehnt' },
  { id: 'ANG-2025-038', kunde: 'Hans Werner', titel: 'Carport Montage', betrag: '3.100,00 €', datum: '10.04.2025', gueltig: '10.05.2025', status: 'Akzeptiert' },
  { id: 'ANG-2025-037', kunde: 'Ritter Elektro GmbH', titel: 'Elektroinstallation Erweiterung', betrag: '9.300,00 €', datum: '03.04.2025', gueltig: '03.05.2025', status: 'Versendet' },
]

export const demoAuftraege: Auftrag[] = [
  { id: 'A-2025-034', kunde: 'Technik Nord AG', beschreibung: 'Wartungsvertrag – Q2 Durchführung', wert: '1.800,00 €', start: '01.05.2025', ende: '31.05.2025', status: 'In Bearbeitung', fortschritt: 65 },
  { id: 'A-2025-033', kunde: 'Müller Bau GmbH', beschreibung: 'Lieferung Stahlträger Charge 1', wert: '6.200,00 €', start: '15.04.2025', ende: '15.05.2025', status: 'In Bearbeitung', fortschritt: 80 },
  { id: 'A-2025-032', kunde: 'Hans Werner', beschreibung: 'Carport Montage & Fundament', wert: '3.100,00 €', start: '28.04.2025', ende: '10.05.2025', status: 'Geplant', fortschritt: 0 },
  { id: 'A-2025-031', kunde: 'Delta Logistik KG', beschreibung: 'Instandhaltung Förderanlage', wert: '4.400,00 €', start: '01.04.2025', ende: '30.04.2025', status: 'Abgeschlossen', fortschritt: 100 },
  { id: 'A-2025-030', kunde: 'Schmidt & Partner', beschreibung: 'Druckluftleitungen verlegen', wert: '2.700,00 €', start: '20.03.2025', ende: '10.04.2025', status: 'Abgeschlossen', fortschritt: 100 },
  { id: 'A-2025-029', kunde: 'Ritter Elektro GmbH', beschreibung: 'Schaltschrankbau Sonderanfertigung', wert: '8.900,00 €', start: '10.05.2025', ende: '30.06.2025', status: 'Pausiert', fortschritt: 30 },
]

export const demoRechnungen: Rechnung[] = [
  { id: 'RE-2025-078', kunde: 'Delta Logistik KG', betrag: '4.400,00 €', faellig: '10.05.2025', erstellt: '10.04.2025', status: 'Offen' },
  { id: 'RE-2025-077', kunde: 'Schmidt & Partner', betrag: '2.700,00 €', faellig: '08.05.2025', erstellt: '08.04.2025', status: 'Überfällig' },
  { id: 'RE-2025-076', kunde: 'Technik Nord AG', betrag: '7.200,00 €', faellig: '30.05.2025', erstellt: '30.04.2025', status: 'Offen' },
  { id: 'RE-2025-075', kunde: 'Müller Bau GmbH', betrag: '12.600,00 €', faellig: '25.04.2025', erstellt: '25.03.2025', status: 'Bezahlt', bezahltAm: '22.04.2025' },
  { id: 'RE-2025-074', kunde: 'Hans Werner', betrag: '1.500,00 €', faellig: '01.04.2025', erstellt: '01.03.2025', status: 'Mahnung' },
  { id: 'RE-2025-073', kunde: 'Delta Logistik KG', betrag: '3.800,00 €', faellig: '20.03.2025', erstellt: '20.02.2025', status: 'Bezahlt', bezahltAm: '18.03.2025' },
]

export const demoEingangsrechnungen: Eingangsrechnung[] = [
  { id: 'ER-2025-001', lieferant: 'Stahl & Mehr GmbH', rechnungsnummer: 'SM-2025-7781', rechnungsdatum: '2025-04-30', faelligkeit: '2025-05-30', betrag_netto: 850, mwst: 161.5, betrag_brutto: 1011.5, status: 'freigegeben', kategorie: 'Rohstoffe', iban: 'DE02120300000000202051', verwendungszweck: 'SM-2025-7781', notiz: 'Stahlrohr Lieferung April' },
  { id: 'ER-2025-002', lieferant: 'TechnikTeile KG', rechnungsnummer: 'TT-99342', rechnungsdatum: '2025-04-28', faelligkeit: '2025-05-08', betrag_netto: 400, mwst: 76, betrag_brutto: 476, status: 'überfällig', kategorie: 'Kleinteile', verwendungszweck: 'TT-99342 Schrauben', notiz: 'Zahlungsziel prüfen' },
  { id: 'ER-2025-003', lieferant: 'Schmierstoff Nord AG', rechnungsnummer: 'SN-2025-118', rechnungsdatum: '2025-05-05', faelligkeit: '2025-06-04', betrag_netto: 210, mwst: 39.9, betrag_brutto: 249.9, status: 'offen', kategorie: 'Betriebsstoffe', verwendungszweck: 'Hydrauliköl Mai' },
  { id: 'ER-2025-004', lieferant: 'Büromaterial GmbH', rechnungsnummer: 'BM-2025-041', rechnungsdatum: '2025-04-12', faelligkeit: '2025-04-26', betrag_netto: 238, mwst: 45.22, betrag_brutto: 283.22, status: 'bezahlt', kategorie: 'Büro', bezahlt_am: '2025-04-23' },
]

export const demoLieferanten: Lieferant[] = [
  { id: 'LF-001', name: 'Stahl & Mehr GmbH', kontakt: 'Peter Maier', email: 'p.maier@stahlmehr.de', telefon: '040 88997-0', ort: 'Hamburg', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto', status: 'Aktiv', bewertung: 5 },
  { id: 'LF-002', name: 'TechnikTeile KG', kontakt: 'Sandra Wolf', email: 's.wolf@technikteile.de', telefon: '089 22334-10', ort: 'München', kategorie: 'Kleinteile', zahlungsziel: '14 Tage 2% Skonto', status: 'Aktiv', bewertung: 4 },
  { id: 'LF-003', name: 'Schmierstoff Nord AG', kontakt: 'Lars Becker', email: 'l.becker@schmiernord.de', telefon: '0511 55600', ort: 'Hannover', kategorie: 'Betriebsstoffe', zahlungsziel: '30 Tage netto', status: 'Aktiv', bewertung: 4 },
  { id: 'LF-004', name: 'Sicherheits-Depot GmbH', kontakt: 'Anna Berger', email: 'a.berger@sicherheitsdepot.de', telefon: '030 77120', ort: 'Berlin', kategorie: 'Schutzausrüstung', zahlungsziel: '21 Tage netto', status: 'Inaktiv', bewertung: 3 },
]

export const demoEinkaufsBestellungen: EinkaufsBestellung[] = [
  { id: 'EB-2025-012', lieferant: 'Stahl & Mehr GmbH', artikel: 'Stahlrohr 40x40', menge: 100, einheit: 'Stk', einkaufspreis: '8,50 €', gesamt: '850,00 €', status: 'Geliefert', bestellt_am: '25.04.2025', erwartet_am: '02.05.2025', geliefert_am: '30.04.2025' },
  { id: 'EB-2025-013', lieferant: 'TechnikTeile KG', artikel: 'Schrauben M8x30', menge: 5000, einheit: 'Stk', einkaufspreis: '0,08 €', gesamt: '400,00 €', status: 'Geliefert', bestellt_am: '28.04.2025', erwartet_am: '05.05.2025', geliefert_am: '03.05.2025' },
  { id: 'EB-2025-014', lieferant: 'Schmierstoff Nord AG', artikel: 'Hydrauliköl HLP46', menge: 50, einheit: 'Liter', einkaufspreis: '4,20 €', gesamt: '210,00 €', status: 'Bestellt', bestellt_am: '05.05.2025', erwartet_am: '12.05.2025' },
  { id: 'EB-2025-015', lieferant: 'TechnikTeile KG', artikel: 'Dichtungsring 50mm', menge: 500, einheit: 'Stk', einkaufspreis: '0,35 €', gesamt: '175,00 €', status: 'Entwurf', bestellt_am: '07.05.2025', erwartet_am: '15.05.2025', notiz: 'Preisverhandlung ausstehend' },
  { id: 'EB-2025-016', lieferant: 'Sicherheits-Depot GmbH', artikel: 'Schutzhandschuhe Gr. L', menge: 48, einheit: 'Paar', einkaufspreis: '3,20 €', gesamt: '153,60 €', status: 'Teillieferung', bestellt_am: '01.05.2025', erwartet_am: '08.05.2025' },
]

export const demoWareneingaenge: Wareneingang[] = [
  { id: 'WE-001', bestellung_id: 'EB-2025-012', lieferant: 'Stahl & Mehr GmbH', artikel: 'Stahlrohr 40x40', menge: 100, einheit: 'Stk', datum: '30.04.2025', qualitaet: 'OK', mitarbeiter: 'K. Petersen' },
  { id: 'WE-002', bestellung_id: 'EB-2025-013', lieferant: 'TechnikTeile KG', artikel: 'Schrauben M8x30', menge: 5000, einheit: 'Stk', datum: '03.05.2025', qualitaet: 'OK', mitarbeiter: 'M. Fischer' },
  { id: 'WE-003', bestellung_id: 'EB-2025-016', lieferant: 'Sicherheits-Depot GmbH', artikel: 'Schutzhandschuhe Gr. L', menge: 24, einheit: 'Paar', datum: '06.05.2025', qualitaet: 'Mängel', mitarbeiter: 'K. Petersen' },
]

export const demoDokumente: Dokument[] = [
  { id: 'DOK-001', name: 'Angebot_ANG-2025-042.pdf', typ: 'PDF', groesse: '284 KB', datum: '02.05.2025', kategorie: 'Angebot', bezug: 'Müller Bau GmbH' },
  { id: 'DOK-002', name: 'Rechnung_RE-2025-078.pdf', typ: 'PDF', groesse: '198 KB', datum: '10.04.2025', kategorie: 'Rechnung', bezug: 'Delta Logistik KG' },
  { id: 'DOK-003', name: 'Wartungsvertrag_TechnikNord_2025.pdf', typ: 'PDF', groesse: '1,2 MB', datum: '28.04.2025', kategorie: 'Vertrag', bezug: 'Technik Nord AG' },
  { id: 'DOK-004', name: 'Angebot_ANG-2025-041.pdf', typ: 'PDF', groesse: '312 KB', datum: '28.04.2025', kategorie: 'Angebot', bezug: 'Technik Nord AG' },
  { id: 'DOK-005', name: 'Auftragsbestätigung_A-2025-032.pdf', typ: 'PDF', groesse: '156 KB', datum: '25.04.2025', kategorie: 'Sonstiges', bezug: 'Hans Werner' },
  { id: 'DOK-006', name: 'Lieferschein_A-2025-033_Ch1.pdf', typ: 'PDF', groesse: '89 KB', datum: '15.04.2025', kategorie: 'Sonstiges', bezug: 'Müller Bau GmbH' },
  { id: 'DOK-007', name: 'Rahmenvertrag_DeltaLogistik.pdf', typ: 'PDF', groesse: '2,4 MB', datum: '01.01.2025', kategorie: 'Vertrag', bezug: 'Delta Logistik KG' },
  { id: 'DOK-008', name: 'Mahnung_RE-2025-074.pdf', typ: 'PDF', groesse: '112 KB', datum: '15.04.2025', kategorie: 'Rechnung', bezug: 'Hans Werner' },
]

// ── Hilfs-Funktionen ────────────────────────────────────────────────────────

export function parseBetrag(s: string): number {
  const cleaned = s.replace(/[^\d,\.]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

export async function resolveDocumentViewUrl(doc: StoredDocumentLink): Promise<string> {
  const directPath = normalizeDocumentStoragePath(doc.storage_path)
  if (directPath) {
    const signedUrl = await getDokumentUrl(directPath)
    if (signedUrl) return signedUrl
  }

  const legacyPath = normalizeDocumentStoragePath(doc.dokument_url)
  if (legacyPath) {
    const signedUrl = await getDokumentUrl(legacyPath)
    if (signedUrl) return signedUrl
  }

  if (doc.dokument_id) {
    const linked = await getBueroDokumentById(doc.dokument_id)
    const linkedPath = normalizeDocumentStoragePath((linked as { storage_path?: string | null } | null)?.storage_path)
    if (linkedPath) {
      const signedUrl = await getDokumentUrl(linkedPath)
      if (signedUrl) return signedUrl
    }
  }

  throw new Error('Für diesen Eintrag wurde keine gültige Datei gefunden. Bitte Speicherpfad, Dokumenten-ID oder Upload prüfen.')
}

export function getLocalFirmaDefaults() {
  if (typeof window === 'undefined') return { zahlungsziel_tage: 30, standard_mwst: 19 }
  try {
    const raw = localStorage.getItem('pk_firma_einstellungen')
    const data = raw ? JSON.parse(raw) as { zahlungsziel_tage?: number; standard_mwst?: number } : {}
    return {
      zahlungsziel_tage: Number(data.zahlungsziel_tage ?? 30),
      standard_mwst: Number(data.standard_mwst ?? 19),
    }
  } catch {
    return { zahlungsziel_tage: 30, standard_mwst: 19 }
  }
}

export function getDocumentRelationLabel(doc: Dokument) {
  if (doc.eingangsrechnung_id) return `Eingangsrechnung ${doc.eingangsrechnung_id}`
  if (doc.rechnung_id) return `Rechnung ${doc.rechnung_id}`
  if (doc.angebot_id) return `Angebot ${doc.angebot_id}`
  if (doc.auftrag_id) return `Auftrag ${doc.auftrag_id}`
  return 'Keine Verknüpfung'
}

export function getLinkedDokument(dokumente: Dokument[], field: DocumentRelationField, value?: string | null) {
  if (!value) return undefined
  return dokumente.find(doc => doc[field] === value)
}

export function isDokumentAvailableForRelation(dokument: Dokument, field: DocumentRelationField, currentId?: string | null) {
  if (!dokument.storage_path) return false
  return documentRelationFields.every(relationField => {
    const relationValue = dokument[relationField]
    if (!relationValue) return true
    return relationField === field && relationValue === currentId
  })
}

export function applyDokumentRelationToState(
  dokument: Dokument,
  field: DocumentRelationField,
  value?: string,
  meta?: Pick<Dokument, 'kategorie' | 'bezug'>,
): Dokument {
  const nextDokument = { ...dokument }
  documentRelationFields.forEach(relationField => {
    nextDokument[relationField] = relationField === field ? value : undefined
  })
  if (meta) {
    nextDokument.kategorie = meta.kategorie
    nextDokument.bezug = meta.bezug
  }
  return nextDokument
}
