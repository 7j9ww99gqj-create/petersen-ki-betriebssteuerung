'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import {
  getBueroKunden, upsertBueroKunde, deleteBueroKunde, anonymisiereBueroKunde, checkBueroKundeDuplicate,
  getBueroAngebote, upsertBueroAngebot, deleteBueroAngebot,
  getBueroAuftraege, upsertBueroAuftrag, deleteBueroAuftrag,
  getBueroRechnungen, upsertBueroRechnung, deleteBueroRechnung, getNextInvoiceNumber, getNextAngebotNumber,
  getBueroEingangsrechnungen, upsertBueroEingangsrechnung, deleteBueroEingangsrechnung,
  markEingangsrechnungBezahlt, updateEingangsrechnungStatus, upsertSteuerBeleg,
  getBueroDokumente, getBueroDokumentById, getDokumentUrl, insertBueroDokument, updateBueroDokument, deleteBueroDokument, uploadDokument,
  getEinkaufLieferanten, upsertEinkaufLieferant, deleteEinkaufLieferant,
  getEinkaufBestellungen, upsertEinkaufBestellung,
  getEinkaufWareneingaenge, insertEinkaufWareneingang,
} from '@/lib/db'
import { generateRechnungPDF, generateAngebotPDF, generateAuftragsbestaetigungPDF } from '@/lib/pdf'
import { createSupabaseClient } from '@/lib/supabase'
import { normalizeDocumentStoragePath, type StoredDocumentLink } from '@/lib/documents'
import { genId } from '@/lib/ids'
import { useRole, PERMISSIONS } from '@/lib/roles'
import { PACKAGE_PRICING, EMPLOYEE_TIERS, type PackageId, type EmployeeTierId } from '@/lib/pricingConfig'
import DocumentPreviewModal from '@/components/DocumentPreviewModal'

// ── Typen ───────────────────────────────────────────────────────────────────

type Kunde = {
  id: string; name: string; typ: 'Firma' | 'Privat'; ansprechpartner: string
  email: string; telefon: string; ort: string; umsatz: string; status: 'Aktiv' | 'Inaktiv'
}

type Angebot = {
  id: string; kunde_id?: string; kunde: string; titel: string; betrag: string; datum: string
  gueltig: string; status: 'Entwurf' | 'Erstellt' | 'Versendet' | 'Akzeptiert' | 'Abgelehnt'
  nummer?: string; verschickt_am?: string
  positionen?: Position[]
}

type Auftrag = {
  id: string; kunde_id?: string; kunde: string; beschreibung: string; wert: string
  start: string; ende: string; status: 'AB erforderlich' | 'AB erstellt' | 'AB versendet' | 'In Bearbeitung' | 'Abgeschlossen' | 'Geplant' | 'Pausiert'
  fortschritt: number; angebot_id?: string; ab_verschickt_am?: string; ab_nummer?: string
  positionen?: Position[]
}

type Position = { id: string; beschreibung: string; menge: number; einheit: string; einzelpreis: number }

type Rechnung = {
  id: string; nummer?: string; kunde_id?: string; kunde: string; betrag: string; faellig: string
  erstellt: string; status: 'Erstellt' | 'Offen' | 'Bezahlt' | 'Überfällig' | 'Mahnung'
  bezahltAm?: string; mahnung_count?: number; positionen?: Position[]
}

type Dokument = {
  id: string; name: string; typ: string; groesse: string; datum: string
  kategorie: 'Angebot' | 'Rechnung' | 'Vertrag' | 'Sonstiges'; bezug: string
  storage_path?: string
  eingangsrechnung_id?: string
  rechnung_id?: string
  angebot_id?: string
  auftrag_id?: string
}

type EingangsrechnungStatus = 'offen' | 'geprüft' | 'freigegeben' | 'bezahlt' | 'überfällig' | 'abgelehnt'

type Eingangsrechnung = {
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

type DocumentRelationField = 'eingangsrechnung_id' | 'rechnung_id' | 'angebot_id' | 'auftrag_id'
const documentRelationFields: DocumentRelationField[] = ['eingangsrechnung_id', 'rechnung_id', 'angebot_id', 'auftrag_id']

// ── Demo-Daten ──────────────────────────────────────────────────────────────

const demoKunden: Kunde[] = [
  { id: 'K-001', name: 'Müller Bau GmbH', typ: 'Firma', ansprechpartner: 'Thomas Müller', email: 't.mueller@muellerbu.de', telefon: '040 12345-0', ort: 'Hamburg', umsatz: '84.200 €', status: 'Aktiv' },
  { id: 'K-002', name: 'Schmidt & Partner', typ: 'Firma', ansprechpartner: 'Anna Schmidt', email: 'a.schmidt@sp-kg.de', telefon: '030 98765-10', ort: 'Berlin', umsatz: '31.500 €', status: 'Aktiv' },
  { id: 'K-003', name: 'Technik Nord AG', typ: 'Firma', ansprechpartner: 'Lars Brandt', email: 'l.brandt@techniknord.de', telefon: '0511 44400', ort: 'Hannover', umsatz: '127.800 €', status: 'Aktiv' },
  { id: 'K-004', name: 'Hans Werner', typ: 'Privat', ansprechpartner: 'Hans Werner', email: 'h.werner@web.de', telefon: '0172 5551234', ort: 'Bremen', umsatz: '4.600 €', status: 'Aktiv' },
  { id: 'K-005', name: 'Delta Logistik KG', typ: 'Firma', ansprechpartner: 'Sandra Koch', email: 's.koch@delta-log.de', telefon: '0211 3330', ort: 'Düsseldorf', umsatz: '56.100 €', status: 'Aktiv' },
  { id: 'K-006', name: 'Ritter Elektro GmbH', typ: 'Firma', ansprechpartner: 'Jens Ritter', email: 'j.ritter@ritter-e.de', telefon: '089 10203', ort: 'München', umsatz: '19.200 €', status: 'Inaktiv' },
]

const demoAngebote: Angebot[] = [
  { id: 'ANG-2025-042', kunde: 'Müller Bau GmbH', titel: 'Stahlkonstruktion Hallenerweiterung', betrag: '18.400,00 €', datum: '02.05.2025', gueltig: '01.06.2025', status: 'Versendet' },
  { id: 'ANG-2025-041', kunde: 'Technik Nord AG', titel: 'Wartungsvertrag 2025/26', betrag: '7.200,00 €', datum: '28.04.2025', gueltig: '28.05.2025', status: 'Akzeptiert' },
  { id: 'ANG-2025-040', kunde: 'Delta Logistik KG', titel: 'Regalanlage Lager Ost', betrag: '12.850,00 €', datum: '25.04.2025', gueltig: '25.05.2025', status: 'Entwurf' },
  { id: 'ANG-2025-039', kunde: 'Schmidt & Partner', titel: 'Büromöbel Ausstattung', betrag: '5.640,00 €', datum: '18.04.2025', gueltig: '18.05.2025', status: 'Abgelehnt' },
  { id: 'ANG-2025-038', kunde: 'Hans Werner', titel: 'Carport Montage', betrag: '3.100,00 €', datum: '10.04.2025', gueltig: '10.05.2025', status: 'Akzeptiert' },
  { id: 'ANG-2025-037', kunde: 'Ritter Elektro GmbH', titel: 'Elektroinstallation Erweiterung', betrag: '9.300,00 €', datum: '03.04.2025', gueltig: '03.05.2025', status: 'Versendet' },
]

const demoAuftraege: Auftrag[] = [
  { id: 'A-2025-034', kunde: 'Technik Nord AG', beschreibung: 'Wartungsvertrag – Q2 Durchführung', wert: '1.800,00 €', start: '01.05.2025', ende: '31.05.2025', status: 'In Bearbeitung', fortschritt: 65 },
  { id: 'A-2025-033', kunde: 'Müller Bau GmbH', beschreibung: 'Lieferung Stahlträger Charge 1', wert: '6.200,00 €', start: '15.04.2025', ende: '15.05.2025', status: 'In Bearbeitung', fortschritt: 80 },
  { id: 'A-2025-032', kunde: 'Hans Werner', beschreibung: 'Carport Montage & Fundament', wert: '3.100,00 €', start: '28.04.2025', ende: '10.05.2025', status: 'Geplant', fortschritt: 0 },
  { id: 'A-2025-031', kunde: 'Delta Logistik KG', beschreibung: 'Instandhaltung Förderanlage', wert: '4.400,00 €', start: '01.04.2025', ende: '30.04.2025', status: 'Abgeschlossen', fortschritt: 100 },
  { id: 'A-2025-030', kunde: 'Schmidt & Partner', beschreibung: 'Druckluftleitungen verlegen', wert: '2.700,00 €', start: '20.03.2025', ende: '10.04.2025', status: 'Abgeschlossen', fortschritt: 100 },
  { id: 'A-2025-029', kunde: 'Ritter Elektro GmbH', beschreibung: 'Schaltschrankbau Sonderanfertigung', wert: '8.900,00 €', start: '10.05.2025', ende: '30.06.2025', status: 'Pausiert', fortschritt: 30 },
]

const demoRechnungen: Rechnung[] = [
  { id: 'RE-2025-078', kunde: 'Delta Logistik KG', betrag: '4.400,00 €', faellig: '10.05.2025', erstellt: '10.04.2025', status: 'Offen' },
  { id: 'RE-2025-077', kunde: 'Schmidt & Partner', betrag: '2.700,00 €', faellig: '08.05.2025', erstellt: '08.04.2025', status: 'Überfällig' },
  { id: 'RE-2025-076', kunde: 'Technik Nord AG', betrag: '7.200,00 €', faellig: '30.05.2025', erstellt: '30.04.2025', status: 'Offen' },
  { id: 'RE-2025-075', kunde: 'Müller Bau GmbH', betrag: '12.600,00 €', faellig: '25.04.2025', erstellt: '25.03.2025', status: 'Bezahlt', bezahltAm: '22.04.2025' },
  { id: 'RE-2025-074', kunde: 'Hans Werner', betrag: '1.500,00 €', faellig: '01.04.2025', erstellt: '01.03.2025', status: 'Mahnung' },
  { id: 'RE-2025-073', kunde: 'Delta Logistik KG', betrag: '3.800,00 €', faellig: '20.03.2025', erstellt: '20.02.2025', status: 'Bezahlt', bezahltAm: '18.03.2025' },
]

const demoEingangsrechnungen: Eingangsrechnung[] = [
  { id: 'ER-2025-001', lieferant: 'Stahl & Mehr GmbH', rechnungsnummer: 'SM-2025-7781', rechnungsdatum: '2025-04-30', faelligkeit: '2025-05-30', betrag_netto: 850, mwst: 161.5, betrag_brutto: 1011.5, status: 'freigegeben', kategorie: 'Rohstoffe', iban: 'DE02120300000000202051', verwendungszweck: 'SM-2025-7781', notiz: 'Stahlrohr Lieferung April' },
  { id: 'ER-2025-002', lieferant: 'TechnikTeile KG', rechnungsnummer: 'TT-99342', rechnungsdatum: '2025-04-28', faelligkeit: '2025-05-08', betrag_netto: 400, mwst: 76, betrag_brutto: 476, status: 'überfällig', kategorie: 'Kleinteile', verwendungszweck: 'TT-99342 Schrauben', notiz: 'Zahlungsziel prüfen' },
  { id: 'ER-2025-003', lieferant: 'Schmierstoff Nord AG', rechnungsnummer: 'SN-2025-118', rechnungsdatum: '2025-05-05', faelligkeit: '2025-06-04', betrag_netto: 210, mwst: 39.9, betrag_brutto: 249.9, status: 'offen', kategorie: 'Betriebsstoffe', verwendungszweck: 'Hydrauliköl Mai' },
  { id: 'ER-2025-004', lieferant: 'Büromaterial GmbH', rechnungsnummer: 'BM-2025-041', rechnungsdatum: '2025-04-12', faelligkeit: '2025-04-26', betrag_netto: 238, mwst: 45.22, betrag_brutto: 283.22, status: 'bezahlt', kategorie: 'Büro', bezahlt_am: '2025-04-23' },
]

const demoLieferanten: Lieferant[] = [
  { id: 'LF-001', name: 'Stahl & Mehr GmbH', kontakt: 'Peter Maier', email: 'p.maier@stahlmehr.de', telefon: '040 88997-0', ort: 'Hamburg', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto', status: 'Aktiv', bewertung: 5 },
  { id: 'LF-002', name: 'TechnikTeile KG', kontakt: 'Sandra Wolf', email: 's.wolf@technikteile.de', telefon: '089 22334-10', ort: 'München', kategorie: 'Kleinteile', zahlungsziel: '14 Tage 2% Skonto', status: 'Aktiv', bewertung: 4 },
  { id: 'LF-003', name: 'Schmierstoff Nord AG', kontakt: 'Lars Becker', email: 'l.becker@schmiernord.de', telefon: '0511 55600', ort: 'Hannover', kategorie: 'Betriebsstoffe', zahlungsziel: '30 Tage netto', status: 'Aktiv', bewertung: 4 },
  { id: 'LF-004', name: 'Sicherheits-Depot GmbH', kontakt: 'Anna Berger', email: 'a.berger@sicherheitsdepot.de', telefon: '030 77120', ort: 'Berlin', kategorie: 'Schutzausrüstung', zahlungsziel: '21 Tage netto', status: 'Inaktiv', bewertung: 3 },
]

const demoEinkaufsBestellungen: EinkaufsBestellung[] = [
  { id: 'EB-2025-012', lieferant: 'Stahl & Mehr GmbH', artikel: 'Stahlrohr 40x40', menge: 100, einheit: 'Stk', einkaufspreis: '8,50 €', gesamt: '850,00 €', status: 'Geliefert', bestellt_am: '25.04.2025', erwartet_am: '02.05.2025', geliefert_am: '30.04.2025' },
  { id: 'EB-2025-013', lieferant: 'TechnikTeile KG', artikel: 'Schrauben M8x30', menge: 5000, einheit: 'Stk', einkaufspreis: '0,08 €', gesamt: '400,00 €', status: 'Geliefert', bestellt_am: '28.04.2025', erwartet_am: '05.05.2025', geliefert_am: '03.05.2025' },
  { id: 'EB-2025-014', lieferant: 'Schmierstoff Nord AG', artikel: 'Hydrauliköl HLP46', menge: 50, einheit: 'Liter', einkaufspreis: '4,20 €', gesamt: '210,00 €', status: 'Bestellt', bestellt_am: '05.05.2025', erwartet_am: '12.05.2025' },
  { id: 'EB-2025-015', lieferant: 'TechnikTeile KG', artikel: 'Dichtungsring 50mm', menge: 500, einheit: 'Stk', einkaufspreis: '0,35 €', gesamt: '175,00 €', status: 'Entwurf', bestellt_am: '07.05.2025', erwartet_am: '15.05.2025', notiz: 'Preisverhandlung ausstehend' },
  { id: 'EB-2025-016', lieferant: 'Sicherheits-Depot GmbH', artikel: 'Schutzhandschuhe Gr. L', menge: 48, einheit: 'Paar', einkaufspreis: '3,20 €', gesamt: '153,60 €', status: 'Teillieferung', bestellt_am: '01.05.2025', erwartet_am: '08.05.2025' },
]

const demoWareneingaenge: Wareneingang[] = [
  { id: 'WE-001', bestellung_id: 'EB-2025-012', lieferant: 'Stahl & Mehr GmbH', artikel: 'Stahlrohr 40x40', menge: 100, einheit: 'Stk', datum: '30.04.2025', qualitaet: 'OK', mitarbeiter: 'K. Petersen' },
  { id: 'WE-002', bestellung_id: 'EB-2025-013', lieferant: 'TechnikTeile KG', artikel: 'Schrauben M8x30', menge: 5000, einheit: 'Stk', datum: '03.05.2025', qualitaet: 'OK', mitarbeiter: 'M. Fischer' },
  { id: 'WE-003', bestellung_id: 'EB-2025-016', lieferant: 'Sicherheits-Depot GmbH', artikel: 'Schutzhandschuhe Gr. L', menge: 24, einheit: 'Paar', datum: '06.05.2025', qualitaet: 'Mängel', mitarbeiter: 'K. Petersen' },
]

const demoDokumente: Dokument[] = [
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

function parseBetrag(s: string): number {
  const cleaned = s.replace(/[^\d,\.]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

async function resolveDocumentViewUrl(doc: StoredDocumentLink): Promise<string> {
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

function getLocalFirmaDefaults() {
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

function getDocumentRelationLabel(doc: Dokument) {
  if (doc.eingangsrechnung_id) return `Eingangsrechnung ${doc.eingangsrechnung_id}`
  if (doc.rechnung_id) return `Rechnung ${doc.rechnung_id}`
  if (doc.angebot_id) return `Angebot ${doc.angebot_id}`
  if (doc.auftrag_id) return `Auftrag ${doc.auftrag_id}`
  return 'Keine Verknüpfung'
}

function getLinkedDokument(dokumente: Dokument[], field: DocumentRelationField, value?: string | null) {
  if (!value) return undefined
  return dokumente.find(doc => doc[field] === value)
}

function isDokumentAvailableForRelation(dokument: Dokument, field: DocumentRelationField, currentId?: string | null) {
  if (!dokument.storage_path) return false
  return documentRelationFields.every(relationField => {
    const relationValue = dokument[relationField]
    if (!relationValue) return true
    return relationField === field && relationValue === currentId
  })
}

function applyDokumentRelationToState(
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

// ── Hilfs-Komponenten ───────────────────────────────────────────────────────

type Tab = 'kunden' | 'angebote' | 'auftraege' | 'rechnungen' | 'eingangsrechnungen' | 'dokumente' | 'einkauf' | 'alerts' | 'pipeline'

// Einkauf/Lieferanten-Typen
type Lieferant = {
  id: string; name: string; kontakt: string; email: string; telefon: string
  ort: string; kategorie: string; zahlungsziel: string; status: 'Aktiv' | 'Inaktiv'; bewertung: number
}
type EinkaufsBestellung = {
  id: string; lieferant_id?: string; lieferant: string; artikel: string; menge: number; einheit: string
  einkaufspreis: string; gesamt: string; status: 'Entwurf' | 'Bestellt' | 'Teillieferung' | 'Geliefert' | 'Storniert'
  bestellt_am: string; erwartet_am: string; geliefert_am?: string; notiz?: string
}
type Wareneingang = {
  id: string; bestellung_id: string; lieferant: string; artikel: string
  menge: number; einheit: string; datum: string; qualitaet: 'OK' | 'Mängel' | 'Abgelehnt'; mitarbeiter: string
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'kunden', label: '👥 Kunden' },
    { id: 'angebote', label: '📋 Angebote' },
    { id: 'auftraege', label: '✅ Aufträge' },
    { id: 'rechnungen', label: '💶 Rechnungen' },
    { id: 'eingangsrechnungen', label: '📥 Eingangsrechnungen' },
    { id: 'dokumente', label: '🗂️ Dokumente' },
    { id: 'einkauf', label: '🏭 Einkauf / Lieferanten' },
    { id: 'alerts', label: '⚠️ Alerts' },
    { id: 'pipeline', label: '🔀 Pipeline' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: 'transparent', borderBottom: tab === t.id ? '2px solid #20c8ff' : '2px solid transparent',
          color: tab === t.id ? '#20c8ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s', whiteSpace: 'nowrap',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// Fixed-position Toast (bottom-right)
function Toast({ msg, error }: { msg: string; error?: boolean }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
      padding: '14px 18px', borderRadius: 12, maxWidth: 360,
      background: error ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)',
      border: `1px solid ${error ? 'rgba(255,80,80,.3)' : 'rgba(37,211,102,.3)'}`,
      color: error ? '#ff8080' : '#4ddb7e',
      fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      animation: 'fadeIn .2s ease',
    }}>{msg}</div>
  )
}

// Modal-Komponente (nach PlanungPilot-Pattern)
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Inline-Löschbestätigung
function DeleteConfirm({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.2)' }}>
      <span style={{ fontSize: 12, color: '#ff8080', fontWeight: 600 }}>{label} löschen?</span>
      <button onClick={onConfirm} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.15)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
      <button onClick={onCancel} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
    </div>
  )
}

function StatusBadgeAngebot({ status }: { status: Angebot['status'] }) {
  const map = {
    Entwurf: 'badge-gray',
    Erstellt: 'badge-orange',
    Versendet: 'badge-blue',
    Akzeptiert: 'badge-green',
    Abgelehnt: 'badge-orange',
  }
  return <span className={`badge ${map[status]}`}>{status}</span>
}

function StatusBadgeAuftrag({ status }: { status: Auftrag['status'] }) {
  const map = {
    'AB erforderlich': 'badge-orange',
    'AB erstellt': 'badge-blue',
    'AB versendet': 'badge-green',
    'In Bearbeitung': 'badge-blue',
    Abgeschlossen: 'badge-green',
    Geplant: 'badge-gray',
    Pausiert: 'badge-orange',
  }
  return <span className={`badge ${map[status]}`}>{status}</span>
}

function StatusBadgeRechnung({ status }: { status: Rechnung['status'] }) {
  const map = {
    Erstellt: 'badge-orange',
    Offen: 'badge-blue',
    Bezahlt: 'badge-green',
    Überfällig: 'badge-orange',
    Mahnung: 'badge-gray',
  }
  const icons = { Erstellt: '📝', Offen: '⏳', Bezahlt: '✅', Überfällig: '⚠️', Mahnung: '📮' }
  return <span className={`badge ${map[status]}`}>{icons[status]} {status}</span>
}

function StatusBadgeEingangsrechnung({ status }: { status: EingangsrechnungStatus }) {
  const map: Record<EingangsrechnungStatus, string> = {
    offen: 'badge-blue',
    geprüft: 'badge-gray',
    freigegeben: 'badge-orange',
    bezahlt: 'badge-green',
    überfällig: 'badge-red',
    abgelehnt: 'badge-gray',
  }
  const icons: Record<EingangsrechnungStatus, string> = {
    offen: '⏳',
    geprüft: '🔎',
    freigegeben: '✅',
    bezahlt: '💚',
    überfällig: '⚠️',
    abgelehnt: '✕',
  }
  return <span className={`badge ${map[status]}`}>{icons[status]} {status}</span>
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#aeb9c8', minWidth: 32 }}>{value}%</span>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }

// ── Kunden-Tab ──────────────────────────────────────────────────────────────

function KundenTab({ isDemo, auftraege, rechnungen, angebote }: { isDemo: boolean; auftraege: Auftrag[]; rechnungen: Rechnung[]; angebote: Angebot[] }) {
  const [kunden, setKunden] = useState<Kunde[]>(isDemo ? demoKunden : [])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Kunde | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [form, setForm] = useState({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '' })
  const [cockpitTab, setCockpitTab] = useState<'angebote' | 'auftraege' | 'rechnungen'>('auftraege')
  const [anonConfirm, setAnonConfirm] = useState<string | null>(null)
  const [duplikatWarnung, setDuplikatWarnung] = useState<string | null>(null)
  const [editKunde, setEditKunde] = useState<Kunde | null>(null)
  const [editKundeForm, setEditKundeForm] = useState({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '', status: 'Aktiv' as Kunde['status'] })
  const [deleteKundeConfirm, setDeleteKundeConfirm] = useState<string | null>(null)
  const { role } = useRole()

  useEffect(() => {
    if (isDemo) return
    setLoading(true); setLoadError('')
    getBueroKunden()
      .then(data => setKunden(data as Kunde[]))
      .catch(() => setLoadError('Kunden konnten nicht geladen werden. Bitte Verbindung prüfen.'))
      .finally(() => setLoading(false))
  }, [isDemo, retryKey])

  const filtered = kunden.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.id.toLowerCase().includes(search.toLowerCase()) ||
    k.ort.toLowerCase().includes(search.toLowerCase())
  )

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleEmailChange = async (email: string) => {
    setForm(p => ({ ...p, email }))
    setDuplikatWarnung(null)
    if (!email || isDemo) return
    try {
      const dup = await checkBueroKundeDuplicate(email)
      if (dup) setDuplikatWarnung(`⚠️ Kunde mit dieser E-Mail existiert bereits: ${dup.name}`)
    } catch { /* ignorieren */ }
  }

  const handleSave = async () => {
    if (!form.name || !form.email) return
    const newKunde: Kunde = {
      id: genId('K'),
      name: form.name, typ: form.typ as Kunde['typ'],
      ansprechpartner: form.ansprechpartner || form.name,
      email: form.email, telefon: form.telefon, ort: form.ort,
      umsatz: '0 €', status: 'Aktiv',
    }
    if (!isDemo) {
      try { await upsertBueroKunde(newKunde) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKunden(prev => [newKunde, ...prev])
    setForm({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '' })
    setDuplikatWarnung(null)
    setShowForm(false)
    showToast(`✅ Kunde "${newKunde.name}" wurde erfolgreich angelegt (${newKunde.id})`)
  }

  const openEditKunde = (k: Kunde) => {
    setEditKunde(k)
    setEditKundeForm({ name: k.name, typ: k.typ, ansprechpartner: k.ansprechpartner, email: k.email, telefon: k.telefon, ort: k.ort, status: k.status })
  }

  const handleEditKundeSave = async () => {
    if (!editKunde || !editKundeForm.name || !editKundeForm.email) return
    const updated: Kunde = { ...editKunde, ...editKundeForm, typ: editKundeForm.typ as Kunde['typ'] }
    if (!isDemo) {
      try { await upsertBueroKunde(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKunden(prev => prev.map(k => k.id === updated.id ? updated : k))
    if (selected?.id === updated.id) setSelected(updated)
    setEditKunde(null)
    showToast(`✅ Kunde "${updated.name}" wurde aktualisiert`)
  }

  const handleDeleteKunde = async (id: string) => {
    setDeleteKundeConfirm(null)
    if (!isDemo) {
      try { await deleteBueroKunde(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setKunden(prev => prev.filter(k => k.id !== id))
    if (selected?.id === id) setSelected(null)
    showToast('🗑️ Kunde wurde gelöscht')
  }

  const handleAnonymize = async (id: string) => {
    if (isDemo) {
      setKunden(prev => prev.map(k => k.id === id ? { ...k, name: '[Anonym]', email: 'anonym@geloescht.de', telefon: '', ansprechpartner: '', ort: '' } : k))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, name: '[Anonym]', email: 'anonym@geloescht.de', telefon: '', ansprechpartner: '', ort: '' } : null)
      setAnonConfirm(null); showToast('🔒 Kunde anonymisiert'); return
    }
    try {
      await anonymisiereBueroKunde(id)
      const anon: Partial<Kunde> = { name: '[Anonym]', email: 'anonym@geloescht.de', telefon: '', ansprechpartner: '', ort: '' }
      setKunden(prev => prev.map(k => k.id === id ? { ...k, ...anon } : k))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...anon } as Kunde : null)
      setAnonConfirm(null); showToast('🔒 Kunde DSGVO-konform anonymisiert')
    } catch { showToast('Fehler beim Anonymisieren', true) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Kunden…</div>
      </div>
    </div>
  )

  if (loadError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div className="pk-card" style={{ textAlign: 'center', padding: 36, maxWidth: 420 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#f8fbff' }}>Laden fehlgeschlagen</div>
        <div style={{ color: '#aeb9c8', fontSize: 13, marginBottom: 18 }}>{loadError}</div>
        <button onClick={() => setRetryKey(k => k + 1)} className="pk-btn" style={{ fontSize: 13 }}>↺ Erneut laden</button>
      </div>
    </div>
  )

  if (editKunde) {
    return (
      <div>
        <Toast msg={toast} error={toastError} />
        <Modal title={`👤 Kunde bearbeiten – ${editKunde.id}`} onClose={() => setEditKunde(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name / Firma *</label>
              <input className="pk-input" value={editKundeForm.name} onChange={e => setEditKundeForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select className="pk-input" value={editKundeForm.typ} onChange={e => setEditKundeForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option>Firma</option>
                <option>Privat</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ansprechpartner</label>
              <input className="pk-input" value={editKundeForm.ansprechpartner} onChange={e => setEditKundeForm(p => ({ ...p, ansprechpartner: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>E-Mail *</label>
              <input className="pk-input" type="email" value={editKundeForm.email} onChange={e => setEditKundeForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input className="pk-input" value={editKundeForm.telefon} onChange={e => setEditKundeForm(p => ({ ...p, telefon: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" value={editKundeForm.ort} onChange={e => setEditKundeForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editKundeForm.status} onChange={e => setEditKundeForm(p => ({ ...p, status: e.target.value as Kunde['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Aktiv</option>
                <option>Inaktiv</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditKundeSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditKunde(null)}>Abbrechen</button>
          </div>
        </Modal>
      </div>
    )
  }

  if (selected) {
    const matchKunde = (item: { kunde_id?: string; kunde?: string }) =>
      (item.kunde_id && item.kunde_id === selected.id) || item.kunde === selected.name
    const kundAngebote = angebote.filter(matchKunde)
    const kundAuftraege = auftraege.filter(matchKunde)
    const kundRechnungen = rechnungen.filter(matchKunde)
    const umsatzBezahlt = kundRechnungen
      .filter(r => r.status === 'Bezahlt')
      .reduce((s, r) => s + parseBetrag(r.betrag), 0)
    const offeneReCount = kundRechnungen.filter(r => r.status !== 'Bezahlt').length

    return (
      <div className="fade-in">
        <Toast msg={toast} error={toastError} />
        <button className="pk-btn-ghost" onClick={() => setSelected(null)} style={{ marginBottom: 16, fontSize: 13 }}>
          ← Zurück zur Übersicht
        </button>

        {/* Cockpit Header */}
        <div className="pk-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(32,200,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {selected.typ === 'Firma' ? '🏢' : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{selected.name}</div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>{selected.id} · {selected.typ} · {selected.ort}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 2 }}>{selected.ansprechpartner} · {selected.email} · {selected.telefon}</div>
            </div>
            <span className={`badge ${selected.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{selected.status}</span>
            {PERMISSIONS.canEdit(role) && (
              <button onClick={() => openEditKunde(selected)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.08)', color: '#20c8ff', cursor: 'pointer', fontWeight: 600 }}>✏️ Bearbeiten</button>
            )}
            {PERMISSIONS.canDelete(role) && (
              deleteKundeConfirm === selected.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#ff8080' }}>Wirklich löschen?</span>
                  <button onClick={() => handleDeleteKunde(selected.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja, löschen</button>
                  <button onClick={() => setDeleteKundeConfirm(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Abbrechen</button>
                </div>
              ) : (
                <button onClick={() => setDeleteKundeConfirm(selected.id)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,.3)', background: 'rgba(255,80,80,.08)', color: '#ff8080', cursor: 'pointer', fontWeight: 600 }}>🗑️ Löschen</button>
              )
            )}
            {PERMISSIONS.canDelete(role) && (
              anonConfirm === selected.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#f59e0b' }}>Wirklich anonymisieren?</span>
                  <button onClick={() => handleAnonymize(selected.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja, anonymisieren</button>
                  <button onClick={() => setAnonConfirm(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Abbrechen</button>
                </div>
              ) : (
                <button onClick={() => setAnonConfirm(selected.id)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,.3)', background: 'rgba(255,80,80,.08)', color: '#ff8080', cursor: 'pointer', fontWeight: 600 }}>🔒 Anonymisieren</button>
              )
            )}
          </div>
          {/* KPI-Zeile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 16 }}>
            {[
              { label: 'Umsatz (bezahlt)', value: umsatzBezahlt.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €', color: '#25d366' },
              { label: 'Angebote', value: String(kundAngebote.length), color: '#1684ff' },
              { label: 'Aufträge', value: String(kundAuftraege.length), color: '#20c8ff' },
              { label: 'Offene Rechnungen', value: String(offeneReCount), color: offeneReCount > 0 ? '#f59e0b' : '#aeb9c8' },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cockpit Tabs */}
        <div className="pk-tab-bar" style={{ marginBottom: 14 }}>
          {([['auftraege', `Aufträge (${kundAuftraege.length})`], ['angebote', `Angebote (${kundAngebote.length})`], ['rechnungen', `Rechnungen (${kundRechnungen.length})`]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setCockpitTab(t)}
              className={cockpitTab === t ? 'pk-btn' : 'pk-btn-ghost'}
              style={{ fontSize: 13, padding: '8px 14px' }}>
              {label}
            </button>
          ))}
        </div>

        <div className="pk-card" style={{ padding: 0 }}>
          {cockpitTab === 'angebote' && (
            <table className="pk-table">
              <thead><tr><th>Nr.</th><th>Titel</th><th>Betrag</th><th>Datum</th><th>Status</th></tr></thead>
              <tbody>
                {kundAngebote.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: '#aeb9c8', textAlign: 'center', padding: 24 }}>Keine Angebote vorhanden</td></tr>
                ) : kundAngebote.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{a.nummer || a.id}</td>
                    <td style={{ fontWeight: 600 }}>{a.titel}</td>
                    <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.betrag}</td>
                    <td style={{ color: '#aeb9c8' }}>{a.datum}</td>
                    <td><StatusBadgeAngebot status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cockpitTab === 'auftraege' && (
            <table className="pk-table">
              <thead><tr><th>Nr.</th><th>Beschreibung</th><th>Wert</th><th>Zeitraum</th><th>Status</th></tr></thead>
              <tbody>
                {kundAuftraege.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: '#aeb9c8', textAlign: 'center', padding: 24 }}>Keine Aufträge vorhanden</td></tr>
                ) : kundAuftraege.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{a.id}</td>
                    <td style={{ fontWeight: 600 }}>{a.beschreibung}</td>
                    <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.wert}</td>
                    <td style={{ color: '#aeb9c8', fontSize: 12 }}>{a.start} – {a.ende}</td>
                    <td><StatusBadgeAuftrag status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cockpitTab === 'rechnungen' && (
            <table className="pk-table">
              <thead><tr><th>Nr.</th><th>Betrag</th><th>Erstellt</th><th>Fällig</th><th>Status</th></tr></thead>
              <tbody>
                {kundRechnungen.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: '#aeb9c8', textAlign: 'center', padding: 24 }}>Keine Rechnungen vorhanden</td></tr>
                ) : kundRechnungen.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{r.nummer || r.id}</td>
                    <td style={{ fontWeight: 700, color: '#20c8ff' }}>{r.betrag}</td>
                    <td style={{ color: '#aeb9c8' }}>{r.erstellt}</td>
                    <td style={{ color: '#aeb9c8' }}>{r.faellig}</td>
                    <td><StatusBadgeRechnung status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Toast msg={toast} error={toastError} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Kunden suchen (Name, Nummer, Ort)…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        <button className="pk-btn" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Kunde'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>👥 Neuen Kunden anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name / Firma *</label>
              <input className="pk-input" placeholder="z.B. Müller GmbH" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option>Firma</option>
                <option>Privat</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ansprechpartner</label>
              <input className="pk-input" placeholder="Vor- und Nachname" value={form.ansprechpartner} onChange={e => setForm(p => ({ ...p, ansprechpartner: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>E-Mail *</label>
              <input className="pk-input" placeholder="email@beispiel.de" type="email" value={form.email} onChange={e => handleEmailChange(e.target.value)} />
              {duplikatWarnung && (
                <div style={{ marginTop: 4, padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.35)', color: '#f59e0b', fontSize: 12 }}>{duplikatWarnung}</div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input className="pk-input" placeholder="040 123456" value={form.telefon} onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" placeholder="Stadt" value={form.ort} onChange={e => setForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleSave} style={{ fontWeight: 700 }}>Kunden anlegen</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Kd.-Nr.</th>
              <th>Name</th>
              <th>Ansprechpartner</th>
              <th>Ort</th>
              <th>Typ</th>
              <th>Umsatz</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(k => (
              <tr key={k.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(k)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{k.id}</td>
                <td style={{ fontWeight: 700 }}>{k.typ === 'Firma' ? '🏢' : '👤'} {k.name}</td>
                <td style={{ color: '#aeb9c8' }}>{k.ansprechpartner}</td>
                <td style={{ color: '#aeb9c8' }}>{k.ort}</td>
                <td><span className="badge badge-gray">{k.typ}</span></td>
                <td style={{ fontWeight: 700, color: '#20c8ff' }}>{k.umsatz}</td>
                <td><span className={`badge ${k.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{k.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {PERMISSIONS.canEdit(role) && (
                      <button onClick={() => openEditKunde(k)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>✏️</button>
                    )}
                    {PERMISSIONS.canDelete(role) && (
                      deleteKundeConfirm === k.id ? (
                        <>
                          <button onClick={() => handleDeleteKunde(k.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                          <button onClick={() => setDeleteKundeConfirm(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteKundeConfirm(k.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.2)', background: 'rgba(255,80,80,.05)', color: '#ff8080', cursor: 'pointer' }}>🗑️</button>
                      )
                    )}
                    <span style={{ color: '#aeb9c8', fontSize: 16 }}>›</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {kunden.length} Kunden</div>
    </div>
  )
}

// ── Angebote-Tab ────────────────────────────────────────────────────────────

function AngeboteTab({ isDemo, kunden, auftraege, setAuftraege, initialFilterStatus, isOwner, setTab: setParentTab, setRechnungen }: { isDemo: boolean; kunden: Kunde[]; auftraege: Auftrag[]; setAuftraege: React.Dispatch<React.SetStateAction<Auftrag[]>>; initialFilterStatus?: string; isOwner?: boolean; setTab?: React.Dispatch<React.SetStateAction<Tab>>; setRechnungen?: React.Dispatch<React.SetStateAction<Rechnung[]>> }) {
  const [angebote, setAngebote] = useState<Angebot[]>(isDemo ? demoAngebote : [])
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [filterErinnerung, setFilterErinnerung] = useState(false)
  const [form, setForm] = useState({ kunde: '', titel: '', betrag: '', gueltig: '', dokumentId: '', paketId: '' as PackageId | '', tier: '' as EmployeeTierId | '' })

  // Edit-Modal
  const [editAngebot, setEditAngebot] = useState<Angebot | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', titel: '', betrag: '', datum: '', gueltig: '', status: 'Entwurf' as Angebot['status'], dokumentId: '' })

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Mail-Versand
  const [angebotMailTarget, setAngebotMailTarget] = useState<{ id: string; email: string } | null>(null)
  const [angebotMailSending, setAngebotMailSending] = useState(false)

  // KI-Angebotstext
  const [kiTextLoading, setKiTextLoading] = useState(false)
  const [kiText, setKiText] = useState('')

  // Positionen-Editor (Angebot Edit-Modal)
  const [editPositionen, setEditPositionen] = useState<Position[]>([])

  const handleGenerateKiText = async () => {
    if (!form.kunde && !form.titel) { showToast('Bitte zuerst Kunde und Titel ausfüllen', true); return }
    setKiTextLoading(true)
    try {
      const res = await fetch('/api/generate-angebot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kunde: form.kunde, titel: form.titel, betrag: form.betrag }),
      })
      const data = await res.json()
      if (data.text) setKiText(data.text)
      else showToast('KI-Text konnte nicht generiert werden', true)
    } catch { showToast('Fehler bei KI-Anfrage', true) }
    finally { setKiTextLoading(false) }
  }

  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroAngebote(), getBueroDokumente()])
      .then(([angeboteData, dokumenteData]) => {
        setAngebote(angeboteData as Angebot[])
        setDokumente(dokumenteData as Dokument[])
      })
      .catch(() => showToast('Fehler beim Laden der Angebote', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    if (!initialFilterStatus) return
    if (['Alle', 'Entwurf', 'Erstellt', 'Versendet', 'Akzeptiert', 'Abgelehnt'].includes(initialFilterStatus)) {
      setFilterStatus(initialFilterStatus)
    }
  }, [initialFilterStatus])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleAngebotMailSend = async (email: string, angebot: Angebot) => {
    setAngebotMailSending(true)
    try {
      const subject = `Ihr Angebot ${angebot.id} von Petersen KI`
      const body = [
        'Guten Tag,',
        '',
        `anbei erhalten Sie unser Angebot ${angebot.id}.`,
        `Titel: ${angebot.titel}`,
        `Betrag: ${angebot.betrag}`,
        '',
        'Viele Gruesse',
      ].join('\n')
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      const today = new Date().toISOString().split('T')[0]
      const ang = angebote.find(a => a.id === angebot.id)
      if (ang && !isDemo) {
        try { await upsertBueroAngebot({ ...ang, status: 'Versendet', verschickt_am: today }) } catch { /* silent */ }
      }
      setAngebote(prev => prev.map(a => a.id === angebot.id ? { ...a, status: 'Versendet', verschickt_am: today } : a))
      showToast(`Mailentwurf fuer ${email} geoeffnet.`)
    } catch {
      showToast('Mailentwurf konnte nicht geoeffnet werden.', true)
    } finally {
      setAngebotMailSending(false)
      setAngebotMailTarget(null)
    }
  }

  const filtered = angebote.filter(a => {
    if (filterErinnerung) return needsReminder(a)
    return filterStatus === 'Alle' || a.status === filterStatus
  })
  const dokumentOptionen = dokumente.filter(doc => isDokumentAvailableForRelation(doc, 'angebot_id', editAngebot?.id))

  const syncDokumentVerknuepfung = async (angebot: Angebot, dokumentId: string, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = dokumentId || null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { angebot_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      angebot_id: angebot.id,
      eingangsrechnung_id: null,
      rechnung_id: null,
      auftrag_id: null,
      kategorie: 'Angebot',
      bezug: angebot.kunde,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'angebot_id', angebot.id, { kategorie: 'Angebot', bezug: angebot.kunde })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'angebot_id')
          : doc
    )))
  }

  const handleSave = async () => {
    if (!form.kunde || !form.titel || !form.betrag) return
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const kunde = kunden.find(entry => entry.name === form.kunde)
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    // Positionen aus Paket-Auswahl ableiten
    let autoPositionen: Position[] = []
    if (form.paketId && form.tier) {
      const pkg = PACKAGE_PRICING[form.paketId as PackageId]
      const price = pkg?.prices[form.tier as EmployeeTierId]
      if (pkg && price && typeof price === 'number') {
        const tierLabel = EMPLOYEE_TIERS.find(t => t.id === form.tier)?.label ?? form.tier
        autoPositionen = [{
          id: `POS-${Date.now()}`,
          beschreibung: `${pkg.name} Paket (${tierLabel}) – ${pkg.included.join(', ')}`,
          menge: 1,
          einheit: 'Abo/Monat',
          einzelpreis: price,
        }]
      }
    }
    const newAng: Angebot = {
      id: genId('ANG'),
      kunde_id: kunde?.id,
      kunde: form.kunde, titel: form.titel,
      betrag: form.betrag.includes('€') ? form.betrag : `${form.betrag} €`,
      datum: fmt(today),
      gueltig: form.gueltig || fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      status: 'Entwurf',
      positionen: autoPositionen.length > 0 ? autoPositionen : undefined,
    }
    if (!isDemo) {
      try {
        await upsertBueroAngebot(newAng)
        await syncDokumentVerknuepfung(newAng, form.dokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAngebote(prev => [newAng, ...prev])
    setForm({ kunde: '', titel: '', betrag: '', gueltig: '', dokumentId: '', paketId: '', tier: '' })
    setShowForm(false)
    showToast(`✅ Angebot "${newAng.id}" wurde als Entwurf erstellt`)
  }

  const handleFreigeben = async (id: string) => {
    const ang = angebote.find(a => a.id === id)
    if (!ang) return
    if (!isDemo) {
      try { await upsertBueroAngebot({ ...ang, status: 'Erstellt' }) } catch { showToast('Fehler beim Freigeben', true); return }
    }
    setAngebote(prev => prev.map(a => a.id === id ? { ...a, status: 'Erstellt' } : a))
    showToast(`✅ Angebot ${id} freigegeben – bitte verschicken`)
  }

  const handleStatusChange = async (id: string, status: Angebot['status']) => {
    if (!isDemo) {
      const ang = angebote.find(a => a.id === id)
      if (ang) {
        try { await upsertBueroAngebot({ ...ang, status }) } catch { showToast('Fehler beim Speichern', true); return }
      }
    }
    setAngebote(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    showToast(`✅ Angebot ${id} wurde auf "${status}" gesetzt`)
  }

  const openEdit = (a: Angebot) => {
    setEditAngebot(a)
    setEditForm({
      kunde: a.kunde,
      titel: a.titel,
      betrag: a.betrag,
      datum: a.datum,
      gueltig: a.gueltig,
      status: a.status,
      dokumentId: getLinkedDokument(dokumente, 'angebot_id', a.id)?.id ?? '',
    })
    setEditPositionen(Array.isArray(a.positionen) ? a.positionen : [])
  }

  const handleEditSave = async () => {
    if (!editAngebot) return
    const previousDokumentId = getLinkedDokument(dokumente, 'angebot_id', editAngebot.id)?.id
    // Betrag aus Positionen berechnen, wenn vorhanden
    const positionenSumme = editPositionen.length > 0
      ? editPositionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0)
      : null
    const betragStr = positionenSumme !== null
      ? `${positionenSumme.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : (editForm.betrag.includes('€') ? editForm.betrag : `${editForm.betrag} €`)
    const updated: Angebot = { ...editAngebot, ...editForm, betrag: betragStr, positionen: editPositionen }
    if (!isDemo) {
      try {
        await upsertBueroAngebot({ ...updated, positionen: editPositionen })
        await syncDokumentVerknuepfung(updated, editForm.dokumentId, previousDokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAngebote(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditAngebot(null)
    showToast(`✅ Angebot ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try {
        const linkedDokument = getLinkedDokument(dokumente, 'angebot_id', id)
        if (linkedDokument) await updateBueroDokument(linkedDokument.id, { angebot_id: null })
        await deleteBueroAngebot(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setAngebote(prev => prev.filter(a => a.id !== id))
    setDokumente(prev => prev.map(doc => doc.angebot_id === id ? { ...doc, angebot_id: undefined } : doc))
    showToast(`🗑️ Angebot ${id} wurde gelöscht`)
  }

  // Angebot → Auftrag konvertieren
  const handleKonvertieren = async (a: Angebot) => {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const newAuftrag: Auftrag = {
      id: genId('A'),
      kunde_id: a.kunde_id,
      kunde: a.kunde,
      beschreibung: a.titel,
      wert: a.betrag,
      start: fmt(today),
      ende: a.gueltig,
      status: 'AB erforderlich',
      fortschritt: 0,
      angebot_id: a.id,
      positionen: a.positionen,
    }
    if (!isDemo) {
      try {
        await upsertBueroAuftrag(newAuftrag)
        await upsertBueroAngebot({ ...a, status: 'Akzeptiert' })
      } catch { showToast('Fehler beim Erstellen des Auftrags', true); return }
    }
    setAuftraege(prev => [newAuftrag, ...prev])
    setAngebote(prev => prev.map(ang => ang.id === a.id ? { ...ang, status: 'Akzeptiert' } : ang))
    showToast(`✅ Auftrag ${newAuftrag.id} aus Angebot ${a.id} erstellt`)
    if (setParentTab) setParentTab('auftraege' as Tab)
  }

  const handleAngebotZuRechnung = async (a: Angebot) => {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const reId = genId('RE')
    const nummer = isDemo
      ? `RE-${today.getFullYear()}-DEMO`
      : await getNextInvoiceNumber().catch(() => reId)
    const newRe = {
      id: reId, nummer,
      kunde_id: a.kunde_id,
      kunde: a.kunde,
      betrag: a.betrag,
      faellig: fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      erstellt: fmt(today),
      status: 'Erstellt' as const,
      positionen: a.positionen,
    }
    if (!isDemo) {
      try { await upsertBueroRechnung(newRe) } catch { showToast('Fehler beim Erstellen der Rechnung', true); return }
    }
    if (setRechnungen) {
      setRechnungen(prev => [{ ...newRe, kunde_id: newRe.kunde_id ?? undefined }, ...prev])
    }
    showToast(`✅ Rechnung ${newRe.nummer || newRe.id} erstellt – jetzt im Tab "Rechnungen" sichtbar`)
    if (setParentTab) setParentTab('rechnungen' as Tab)
  }

  const needsReminder = (a: Angebot): boolean => {
    if (a.status !== 'Versendet' || !a.verschickt_am) return false
    const days = (Date.now() - new Date(a.verschickt_am).getTime()) / (1000 * 60 * 60 * 24)
    return days >= 7
  }

  const angebotAgingDays = (a: Angebot): number | null => {
    if (a.status === 'Akzeptiert' || a.status === 'Abgelehnt') return null
    const ref = a.verschickt_am ?? a.datum
    if (!ref) return null
    let refDate: Date
    if (ref.includes('.')) {
      const [d, m, y] = ref.split('.').map(Number)
      refDate = new Date(y, m - 1, d)
    } else {
      refDate = new Date(ref)
    }
    if (isNaN(refDate.getTime())) return null
    return Math.floor((Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  const statusCounts: Record<string, number> = { Alle: angebote.length, Entwurf: 0, Erstellt: 0, Versendet: 0, Akzeptiert: 0, Abgelehnt: 0 }
  angebote.forEach(a => { statusCounts[a.status]++ })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Angebote…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editAngebot && (
        <Modal title={`📋 Angebot bearbeiten – ${editAngebot.id}`} onClose={() => setEditAngebot(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Titel / Leistung *</label>
              <input className="pk-input" value={editForm.titel} onChange={e => setEditForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Betrag (€)</label>
              <input className="pk-input" value={editForm.betrag} onChange={e => setEditForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Datum</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.datum} onChange={e => setEditForm(p => ({ ...p, datum: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Gültig bis</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.gueltig} onChange={e => setEditForm(p => ({ ...p, gueltig: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Angebot['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Entwurf</option>
                <option>Erstellt</option>
                <option>Versendet</option>
                <option>Akzeptiert</option>
                <option>Abgelehnt</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={editForm.dokumentId} onChange={e => setEditForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          {/* ── Positionen-Editor ── */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#aeb9c8' }}>Positionen</label>
              <button
                onClick={() => setEditPositionen(prev => [...prev, { id: `POS-${Date.now()}`, beschreibung: '', menge: 1, einheit: 'Stk', einzelpreis: 0 }])}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.4)', background: 'rgba(32,200,255,.08)', color: '#20c8ff', cursor: 'pointer', fontWeight: 700 }}
              >
                + Position hinzufügen
              </button>
            </div>
            {editPositionen.length === 0 ? (
              <div style={{ fontSize: 12, color: '#aeb9c8', padding: '10px 0' }}>Keine Positionen – Betrag wird manuell eingegeben.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editPositionen.map((pos, idx) => (
                  <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 36px', gap: 6, alignItems: 'center' }}>
                    <input
                      className="pk-input"
                      placeholder="Beschreibung"
                      value={pos.beschreibung}
                      style={{ fontSize: 12 }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, beschreibung: e.target.value } : p))}
                    />
                    <input
                      className="pk-input"
                      placeholder="Menge"
                      type="number"
                      min={0}
                      value={pos.menge}
                      style={{ fontSize: 12 }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, menge: parseFloat(e.target.value) || 0 } : p))}
                    />
                    <select
                      className="pk-input"
                      value={pos.einheit}
                      style={{ fontSize: 12, cursor: 'pointer' }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, einheit: e.target.value } : p))}
                    >
                      {['Stk', 'h', 'm', 'm²', 'm³', 'kg', 'l', 'Psch', 'Set'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input
                      className="pk-input"
                      placeholder="Einzelpreis €"
                      type="number"
                      min={0}
                      step={0.01}
                      value={pos.einzelpreis}
                      style={{ fontSize: 12 }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, einzelpreis: parseFloat(e.target.value) || 0 } : p))}
                    />
                    <button
                      onClick={() => setEditPositionen(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: 14, padding: '4px' }}
                    >🗑️</button>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#20c8ff', marginTop: 4 }}>
                  Gesamt: {editPositionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  <span style={{ color: '#aeb9c8', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>(überschreibt Betrag-Feld)</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditAngebot(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      {(() => {
        const today = new Date()
        const expiredOffers = angebote.filter(a => {
          if (a.status === 'Akzeptiert' || a.status === 'Abgelehnt') return false
          try {
            const [d, m, y] = a.gueltig.split('.').map(Number)
            const gueltigDate = new Date(y, m - 1, d)
            return gueltigDate < today
          } catch { return false }
        })
        const reminderOffers = angebote.filter(a => needsReminder(a))
        if (expiredOffers.length === 0 && reminderOffers.length === 0) return null
        return (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', color: '#fbbf24' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>⏰ Angebots-Hinweise</div>
            {expiredOffers.length > 0 && (
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>{expiredOffers.length}</strong> Angebot{expiredOffers.length > 1 ? 'e' : ''} abgelaufen (Gültigkeitsdatum überschritten)
              </div>
            )}
            {reminderOffers.length > 0 && (
              <div style={{ fontSize: 13 }}>
                <strong>{reminderOffers.length}</strong> Angebot{reminderOffers.length > 1 ? 'e' : ''} seit 10+ Tagen ohne Rückmeldung
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Entwurf', 'Erstellt', 'Versendet', 'Akzeptiert', 'Abgelehnt'] as const).map(s => (
            <button key={s} onClick={() => { setFilterStatus(s); setFilterErinnerung(false) }} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: !filterErinnerung && filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: !filterErinnerung && filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({statusCounts[s] ?? angebote.length})</span>
            </button>
          ))}
          {(() => {
            const erinnerungCount = angebote.filter(needsReminder).length
            if (erinnerungCount === 0) return null
            return (
              <button onClick={() => setFilterErinnerung(f => !f)} style={{
                padding: '6px 14px', borderRadius: 999, border: `1px solid ${filterErinnerung ? 'rgba(245,158,11,.6)' : 'rgba(245,158,11,.3)'}`,
                background: filterErinnerung ? 'rgba(245,158,11,.2)' : 'rgba(245,158,11,.06)',
                color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                ⏰ Erinnerung fällig ({erinnerungCount})
              </button>
            )
          })()}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neues Angebot'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📋 Neues Angebot erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde *</label>
              <select className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '14px 16px', borderRadius: 12, background: 'rgba(32,200,255,.05)', border: '1px solid rgba(32,200,255,.18)' }}>
              <div style={{ fontSize: 12, color: '#20c8ff', fontWeight: 700, marginBottom: 12 }}>📦 Paket auswählen (optional)</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 7, fontWeight: 600 }}>1. Mitarbeiterstaffel wählen</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {EMPLOYEE_TIERS.map(t => (
                    <button type="button" key={t.id} onClick={() => {
                      const pkg = form.paketId ? PACKAGE_PRICING[form.paketId as PackageId] : null
                      const price = pkg ? pkg.prices[t.id] : null
                      setForm(p => ({
                        ...p,
                        tier: t.id,
                        betrag: pkg && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.betrag,
                        titel: pkg && price && price !== 'request' ? `${pkg.name} Paket (${t.label})` : p.titel,
                      }))
                    }} style={{
                      padding: '6px 14px', borderRadius: 999,
                      border: `1px solid ${form.tier === t.id ? '#20c8ff' : 'rgba(255,255,255,.12)'}`,
                      background: form.tier === t.id ? 'rgba(32,200,255,.18)' : 'transparent',
                      color: form.tier === t.id ? '#20c8ff' : '#aeb9c8',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 7, fontWeight: 600 }}>2. Paket anklicken</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {Object.values(PACKAGE_PRICING).map(pkg => {
                  const price = form.tier ? pkg.prices[form.tier as EmployeeTierId] : null
                  const isSelected = form.paketId === pkg.id
                  return (
                    <div key={pkg.id} onClick={() => {
                      const tierLabel = EMPLOYEE_TIERS.find(t => t.id === form.tier)?.label ?? ''
                      const newSelected = !isSelected
                      setForm(p => ({
                        ...p,
                        paketId: newSelected ? pkg.id : '',
                        titel: newSelected && price && price !== 'request' ? `${pkg.name} Paket${tierLabel ? ` (${tierLabel})` : ''}` : p.titel,
                        betrag: newSelected && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.betrag,
                      }))
                    }} style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${isSelected ? '#20c8ff' : 'rgba(255,255,255,.08)'}`,
                      background: isSelected ? 'rgba(32,200,255,.12)' : 'rgba(255,255,255,.02)',
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: isSelected ? '#20c8ff' : '#f8fbff', marginBottom: 3 }}>{pkg.icon} {pkg.name}</div>
                      <div style={{ fontSize: 12, color: isSelected ? '#7ee8ff' : '#aeb9c8', fontWeight: 700 }}>
                        {price !== null ? (typeof price === 'number' ? `${price} €/Monat` : 'Auf Anfrage') : '— Staffel wählen'}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7a8d', marginTop: 5, lineHeight: 1.4 }}>
                        {pkg.included.slice(0, 3).join(' · ')}{pkg.included.length > 3 ? ' …' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Titel / Leistung *</label>
              <input className="pk-input" placeholder="z.B. Wartungsvertrag 2025" value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Betrag inkl. MwSt. (€) *</label>
              <input className="pk-input" placeholder="z.B. 89,00" value={form.betrag} onChange={e => setForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Gültig bis</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.gueltig} onChange={e => setForm(p => ({ ...p, gueltig: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={form.dokumentId} onChange={e => setForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          {/* KI-Angebotstext */}
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: kiText ? 10 : 0 }}>
              <button
                onClick={handleGenerateKiText}
                disabled={kiTextLoading}
                style={{ padding: '7px 16px', borderRadius: 999, border: '1px solid rgba(167,139,250,.4)', background: 'rgba(167,139,250,.12)', color: '#c4b5fd', fontSize: 12, fontWeight: 700, cursor: kiTextLoading ? 'wait' : 'pointer' }}
              >
                {kiTextLoading ? '⏳ Generiere…' : '✨ KI-Angebotstext generieren'}
              </button>
              <span style={{ fontSize: 11, color: '#aeb9c8' }}>Basierend auf Kunde + Titel</span>
            </div>
            {kiText && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4, fontWeight: 700 }}>Generierter Text:</div>
                <div style={{ fontSize: 13, color: '#f8fbff', lineHeight: 1.6, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', whiteSpace: 'pre-wrap' }}>{kiText}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { navigator.clipboard.writeText(kiText); showToast('Text kopiert') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(167,139,250,.3)', background: 'transparent', color: '#c4b5fd', cursor: 'pointer' }}>📋 Kopieren</button>
                  <button onClick={() => setKiText('')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>✕ Verwerfen</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleSave}>Als Entwurf speichern</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Angebots-Nr.</th>
              <th>Kunde</th>
              <th>Leistung</th>
              <th>Betrag</th>
              <th>Erstellt</th>
              <th>Gültig bis</th>
              <th>Dokument</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              (() => {
                const linkedDokument = getLinkedDokument(dokumente, 'angebot_id', a.id)
                return (
              <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(a)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.nummer || a.id}</td>
                <td style={{ fontWeight: 600 }}>{a.kunde}</td>
                <td style={{ color: '#d0d9e8' }}>{a.titel}</td>
                <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.betrag}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.datum}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.gueltig}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{linkedDokument?.name ?? '—'}</td>
                <td><StatusBadgeAngebot status={a.status} /></td>
                <td>
                  {deleteId === a.id ? (
                    <DeleteConfirm label={a.id} onConfirm={() => handleDelete(a.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {a.status === 'Entwurf' && (
                        <button onClick={e => { e.stopPropagation(); handleFreigeben(a.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.4)', background: 'rgba(245,158,11,.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                          ✅ Freigeben
                        </button>
                      )}
                      {a.status === 'Erstellt' && (
                        <button onClick={e => { e.stopPropagation(); const k = kunden.find(k => k.id === a.kunde_id || k.name === a.kunde); setAngebotMailTarget({ id: a.id, email: k?.email || '' }) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.4)', background: 'rgba(32,200,255,.12)', color: '#20c8ff', cursor: 'pointer', fontWeight: 700 }}>
                          ✉️ Verschicken
                        </button>
                      )}
                      {(() => {
                        try {
                          const [d, m, y] = a.gueltig.split('.').map(Number)
                          const gueltigDate = new Date(y, m - 1, d)
                          if (gueltigDate < new Date() && a.status !== 'Akzeptiert' && a.status !== 'Abgelehnt') {
                            return <span className="badge badge-red" style={{ fontSize: 10 }}>Abgelaufen</span>
                          }
                        } catch { /* */ }
                        return null
                      })()}
                      {a.status === 'Versendet' && (
                        <>
                          {(() => {
                            const days = angebotAgingDays(a)
                            if (days === null || days < 7) return null
                            if (days >= 14) return (
                              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(244,63,94,.12)', border: '1px solid rgba(244,63,94,.4)', color: '#fb7185', fontWeight: 700 }}>
                                ⚠️ {days}T offen
                              </span>
                            )
                            return (
                              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.4)', color: '#f59e0b', fontWeight: 700 }}>
                                ⏰ {days}T offen
                              </span>
                            )
                          })()}
                          <button onClick={e => { e.stopPropagation(); handleStatusChange(a.id, 'Akzeptiert') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>✅ Angenommen</button>
                          <button onClick={e => { e.stopPropagation(); handleStatusChange(a.id, 'Abgelehnt') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>✕ Abgelehnt</button>
                        </>
                      )}
                      {a.status === 'Akzeptiert' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleKonvertieren(a) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'rgba(37,211,102,.08)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>
                            🔄 Auftrag erstellen
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleAngebotZuRechnung(a) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                            📄 Rechnung erstellen
                          </button>
                        </>
                      )}
                      <button onClick={e => { e.stopPropagation(); generateAngebotPDF(a, a.kunde) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                        📄 PDF
                      </button>
                      <button onClick={e => { e.stopPropagation(); const k = kunden.find(k => k.id === a.kunde_id || k.name === a.kunde); setAngebotMailTarget({ id: a.id, email: k?.email || '' }) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                        ✉️ Mail
                      </button>
                      <button onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/angebote/${encodeURIComponent(a.id)}` }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                        ↗ Details
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(a) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteId(a.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
                )
              })()
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Angebote</div>

      {/* Mail-Modal Angebote */}
      {angebotMailTarget && (() => {
        const angebot = angebote.find(a => a.id === angebotMailTarget.id)
        if (!angebot) return null
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setAngebotMailTarget(null)}>
            <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>✉️ Angebot per Mail senden</h3>
                <button onClick={() => setAngebotMailTarget(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 14 }}>
                <strong style={{ color: '#f8fbff' }}>{angebot.titel || angebot.id}</strong> — {angebot.kunde} — {angebot.betrag}
              </div>
              <label style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>E-Mail-Adresse des Empfängers</label>
              <input
                className="pk-input"
                type="email"
                value={angebotMailTarget.email}
                onChange={e => setAngebotMailTarget({ ...angebotMailTarget, email: e.target.value })}
                placeholder="kunde@beispiel.de"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <button
                className="pk-btn-ghost"
                style={{ fontWeight: 700, marginBottom: 10, width: '100%' }}
                onClick={() => generateAngebotPDF(angebot, angebot.kunde)}
              >
                📄 PDF erstellen & herunterladen
              </button>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="pk-btn-ghost" onClick={() => setAngebotMailTarget(null)} disabled={angebotMailSending}>Abbrechen</button>
                <button
                  className="pk-btn"
                  disabled={angebotMailSending || !angebotMailTarget.email.includes('@')}
                  onClick={() => handleAngebotMailSend(angebotMailTarget.email, angebot)}
                >
                  {angebotMailSending ? '⏳ Sende…' : '✉️ Jetzt senden'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Aufträge-Tab ────────────────────────────────────────────────────────────

function AuftraegeTab({ isDemo, auftraege, setAuftraege, kunden, setTab, setRechnungen: setSharedRechnungen, setMailTarget: setSharedMailTarget }: { isDemo: boolean; auftraege: Auftrag[]; setAuftraege: React.Dispatch<React.SetStateAction<Auftrag[]>>; kunden: Kunde[]; setTab: React.Dispatch<React.SetStateAction<Tab>>; setRechnungen?: React.Dispatch<React.SetStateAction<Rechnung[]>>; setMailTarget?: React.Dispatch<React.SetStateAction<{ id: string; email: string; typ: 'rechnung' } | null>> }) {
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kunde: '', beschreibung: '', wert: '', start: '', ende: '', dokumentId: '', paketId: '' as PackageId | '', tier: '' as EmployeeTierId | '' })

  // Edit-Modal
  const [editAuftrag, setEditAuftrag] = useState<Auftrag | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', beschreibung: '', wert: '', start: '', ende: '', status: 'AB erforderlich' as Auftrag['status'], fortschritt: 0, dokumentId: '' })

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // AB Mail
  const [auftragMailTarget, setAuftragMailTarget] = useState<{ id: string; email: string; typ: 'ab' } | null>(null)
  const [auftragMailSending, setAuftragMailSending] = useState(false)

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  useEffect(() => {
    if (isDemo) return
    getBueroDokumente()
      .then(data => setDokumente(data as Dokument[]))
      .catch(() => showToast('Fehler beim Laden der Dokumente', true))
  }, [isDemo])

  const filtered = auftraege.filter(a => filterStatus === 'Alle' || a.status === filterStatus)
  const dokumentOptionen = dokumente.filter(doc => isDokumentAvailableForRelation(doc, 'auftrag_id', editAuftrag?.id))

  const statusColor: Record<string, string> = {
    'AB erforderlich': '#f59e0b',
    'AB erstellt': '#1684ff',
    'AB versendet': '#25d366',
    'In Bearbeitung': '#1684ff',
    Abgeschlossen: '#25d366',
    Geplant: '#aeb9c8',
    Pausiert: '#f59e0b',
  }

  const syncDokumentVerknuepfung = async (auftrag: Auftrag, dokumentId: string, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = dokumentId || null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { auftrag_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      eingangsrechnung_id: null,
      rechnung_id: null,
      angebot_id: null,
      auftrag_id: auftrag.id,
      kategorie: 'Vertrag',
      bezug: auftrag.kunde,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'auftrag_id', auftrag.id, { kategorie: 'Vertrag', bezug: auftrag.kunde })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'auftrag_id')
          : doc
    )))
  }

  const getNextABNumber = (): string => {
    const year = new Date().getFullYear()
    const existing = auftraege
      .map(a => a.ab_nummer)
      .filter(Boolean)
      .filter(n => n?.startsWith(`AB-${year}-`))
      .map(n => parseInt(n!.replace(`AB-${year}-`, ''), 10))
      .filter(n => !isNaN(n))
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
    return `AB-${year}-${String(next).padStart(3, '0')}`
  }

  const handleAbschliessen = async (id: string) => {
    const auftrag = auftraege.find(a => a.id === id)
    if (!isDemo && auftrag) {
      try { await upsertBueroAuftrag({ ...auftrag, status: 'Abgeschlossen', fortschritt: 100 }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === id ? { ...a, status: 'Abgeschlossen', fortschritt: 100 } : a))
    showToast(`✅ Auftrag ${id} wurde als abgeschlossen markiert`)
  }

  const handleABErstellen = async (id: string) => {
    const auftrag = auftraege.find(a => a.id === id)
    if (!auftrag) return
    const abNummer = isDemo ? `AB-${new Date().getFullYear()}-DEMO` : getNextABNumber()
    if (!isDemo) {
      try { await upsertBueroAuftrag({ ...auftrag, status: 'AB erstellt', ab_nummer: abNummer }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === id ? { ...a, status: 'AB erstellt', ab_nummer: abNummer } : a))
    showToast(`📋 Auftragsbestätigung ${abNummer} erstellt – bitte verschicken`)
  }

  const handleABStarten = async (id: string) => {
    const auftrag = auftraege.find(a => a.id === id)
    if (!isDemo && auftrag) {
      try { await upsertBueroAuftrag({ ...auftrag, status: 'In Bearbeitung', fortschritt: 10 }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === id ? { ...a, status: 'In Bearbeitung', fortschritt: 10 } : a))
    showToast(`▶ Auftrag ${id} gestartet`)
  }

  const handleABMailSend = async (email: string, auftrag: Auftrag) => {
    setAuftragMailSending(true)
    try {
      const subject = `Auftragsbestätigung ${auftrag.ab_nummer || auftrag.id}`
      const body = ['Guten Tag,', '', `anbei erhalten Sie die Auftragsbestätigung für Auftrag ${auftrag.id}.`, `Beschreibung: ${auftrag.beschreibung}`, `Wert: ${auftrag.wert}`, '', 'Viele Grüße'].join('\n')
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      const today = new Date().toISOString().split('T')[0]
      if (!isDemo) {
        try { await upsertBueroAuftrag({ ...auftrag, status: 'AB versendet', ab_verschickt_am: today }) } catch { /* silent */ }
      }
      setAuftraege(prev => prev.map(a => a.id === auftrag.id ? { ...a, status: 'AB versendet', ab_verschickt_am: today } : a))
      showToast(`✉️ Auftragsbestätigung verschickt`)
    } catch {
      showToast('Mailentwurf konnte nicht geöffnet werden.', true)
    } finally {
      setAuftragMailSending(false)
      setAuftragMailTarget(null)
    }
  }

  const handleAuftragZuRechnung = async (auftrag: Auftrag) => {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const reId = genId('RE')
    const nummer = isDemo
      ? `RE-${today.getFullYear()}-DEMO`
      : await getNextInvoiceNumber().catch(() => reId)
    const newRe = {
      id: reId,
      nummer,
      kunde_id: auftrag.kunde_id,
      kunde: auftrag.kunde,
      betrag: auftrag.wert,
      faellig: fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      erstellt: fmt(today),
      status: 'Erstellt' as const,
      positionen: auftrag.positionen,
    }
    if (!isDemo) {
      try { await upsertBueroRechnung(newRe) } catch { showToast('Fehler beim Erstellen der Rechnung', true); return }
    }
    if (setSharedRechnungen) {
      setSharedRechnungen(prev => [{ ...newRe, kunde_id: newRe.kunde_id ?? undefined }, ...prev])
    }
    showToast(`✅ Rechnung ${newRe.nummer || newRe.id} erstellt – jetzt im Tab "Rechnungen" sichtbar`)
    setTab('rechnungen' as Tab)
  }

  const handleNeuSave = async () => {
    if (!form.kunde || !form.beschreibung || !form.wert) return
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const kunde = kunden.find(entry => entry.name === form.kunde)
    const newA: Auftrag = {
      id: genId('A'),
      kunde_id: kunde?.id,
      kunde: form.kunde, beschreibung: form.beschreibung,
      wert: form.wert.includes('€') ? form.wert : `${form.wert} €`,
      start: form.start || fmt(today),
      ende: form.ende || fmt(new Date(today.getTime() + 30 * 86400000)),
      status: 'AB erforderlich', fortschritt: 0,
    }
    if (!isDemo) {
      try {
        await upsertBueroAuftrag(newA)
        await syncDokumentVerknuepfung(newA, form.dokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => [newA, ...prev])
    setForm({ kunde: '', beschreibung: '', wert: '', start: '', ende: '', dokumentId: '', paketId: '', tier: '' })
    setShowForm(false)
    showToast(`✅ Auftrag ${newA.id} wurde angelegt`)
  }

  const openEdit = (a: Auftrag) => {
    setEditAuftrag(a)
    setEditForm({
      kunde: a.kunde,
      beschreibung: a.beschreibung,
      wert: a.wert,
      start: a.start,
      ende: a.ende,
      status: a.status,
      fortschritt: a.fortschritt,
      dokumentId: getLinkedDokument(dokumente, 'auftrag_id', a.id)?.id ?? '',
    })
  }

  const handleEditSave = async () => {
    if (!editAuftrag) return
    const previousDokumentId = getLinkedDokument(dokumente, 'auftrag_id', editAuftrag.id)?.id
    const updated: Auftrag = { ...editAuftrag, ...editForm, wert: editForm.wert.includes('€') ? editForm.wert : `${editForm.wert} €` }
    if (!isDemo) {
      try {
        await upsertBueroAuftrag(updated)
        await syncDokumentVerknuepfung(updated, editForm.dokumentId, previousDokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditAuftrag(null)
    showToast(`✅ Auftrag ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try {
        const linkedDokument = getLinkedDokument(dokumente, 'auftrag_id', id)
        if (linkedDokument) await updateBueroDokument(linkedDokument.id, { auftrag_id: null })
        await deleteBueroAuftrag(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setAuftraege(prev => prev.filter(a => a.id !== id))
    setDokumente(prev => prev.map(doc => doc.auftrag_id === id ? { ...doc, auftrag_id: undefined } : doc))
    showToast(`🗑️ Auftrag ${id} wurde gelöscht`)
  }

  const counts: Record<string, number> = { Alle: auftraege.length }
  auftraege.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editAuftrag && (
        <Modal title={`✅ Auftrag bearbeiten – ${editAuftrag.id}`} onClose={() => setEditAuftrag(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Beschreibung *</label>
              <input className="pk-input" value={editForm.beschreibung} onChange={e => setEditForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Wert (€)</label>
              <input className="pk-input" value={editForm.wert} onChange={e => setEditForm(p => ({ ...p, wert: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Start</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.start} onChange={e => setEditForm(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ende</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.ende} onChange={e => setEditForm(p => ({ ...p, ende: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Auftrag['status'] }))} style={{ cursor: 'pointer' }}>
                <option>AB erforderlich</option>
                <option>AB erstellt</option>
                <option>AB versendet</option>
                <option>Geplant</option>
                <option>In Bearbeitung</option>
                <option>Pausiert</option>
                <option>Abgeschlossen</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fortschritt: {editForm.fortschritt}%</label>
              <input type="range" min={0} max={100} value={editForm.fortschritt} onChange={e => setEditForm(p => ({ ...p, fortschritt: Number(e.target.value) }))} style={{ width: '100%', cursor: 'pointer', accentColor: '#20c8ff' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={editForm.dokumentId} onChange={e => setEditForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditAuftrag(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {(['Alle', 'AB erforderlich', 'AB erstellt', 'AB versendet', 'In Bearbeitung', 'Geplant', 'Pausiert', 'Abgeschlossen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13 }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Auftrag'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>✅ Neuen Auftrag anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde *</label>
              <select className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '14px 16px', borderRadius: 12, background: 'rgba(32,200,255,.05)', border: '1px solid rgba(32,200,255,.18)' }}>
              <div style={{ fontSize: 12, color: '#20c8ff', fontWeight: 700, marginBottom: 12 }}>📦 Paket auswählen (optional)</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 7, fontWeight: 600 }}>1. Mitarbeiterstaffel wählen</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {EMPLOYEE_TIERS.map(t => (
                    <button type="button" key={t.id} onClick={() => {
                      const pkg = form.paketId ? PACKAGE_PRICING[form.paketId as PackageId] : null
                      const price = pkg ? pkg.prices[t.id] : null
                      setForm(p => ({
                        ...p,
                        tier: t.id,
                        wert: pkg && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.wert,
                        beschreibung: pkg && price && price !== 'request' ? `${pkg.name} Paket (${t.label})` : p.beschreibung,
                      }))
                    }} style={{
                      padding: '6px 14px', borderRadius: 999,
                      border: `1px solid ${form.tier === t.id ? '#20c8ff' : 'rgba(255,255,255,.12)'}`,
                      background: form.tier === t.id ? 'rgba(32,200,255,.18)' : 'transparent',
                      color: form.tier === t.id ? '#20c8ff' : '#aeb9c8',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 7, fontWeight: 600 }}>2. Paket anklicken</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {Object.values(PACKAGE_PRICING).map(pkg => {
                  const price = form.tier ? pkg.prices[form.tier as EmployeeTierId] : null
                  const isSelected = form.paketId === pkg.id
                  return (
                    <div key={pkg.id} onClick={() => {
                      const tierLabel = EMPLOYEE_TIERS.find(t => t.id === form.tier)?.label ?? ''
                      const newSelected = !isSelected
                      setForm(p => ({
                        ...p,
                        paketId: newSelected ? pkg.id : '',
                        beschreibung: newSelected && price && price !== 'request' ? `${pkg.name} Paket${tierLabel ? ` (${tierLabel})` : ''}` : p.beschreibung,
                        wert: newSelected && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.wert,
                      }))
                    }} style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${isSelected ? '#20c8ff' : 'rgba(255,255,255,.08)'}`,
                      background: isSelected ? 'rgba(32,200,255,.12)' : 'rgba(255,255,255,.02)',
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: isSelected ? '#20c8ff' : '#f8fbff', marginBottom: 3 }}>{pkg.icon} {pkg.name}</div>
                      <div style={{ fontSize: 12, color: isSelected ? '#7ee8ff' : '#aeb9c8', fontWeight: 700 }}>
                        {price !== null ? (typeof price === 'number' ? `${price} €/Monat` : 'Auf Anfrage') : '— Staffel wählen'}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7a8d', marginTop: 5, lineHeight: 1.4 }}>
                        {pkg.included.slice(0, 3).join(' · ')}{pkg.included.length > 3 ? ' …' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Beschreibung *</label>
              <input className="pk-input" placeholder="z.B. Wartungsarbeiten Q3" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Wert (€) *</label>
              <input className="pk-input" placeholder="z.B. 3.500,00" value={form.wert} onChange={e => setForm(p => ({ ...p, wert: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Start</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ende</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.ende} onChange={e => setForm(p => ({ ...p, ende: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={form.dokumentId} onChange={e => setForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleNeuSave}>Auftrag anlegen</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(a => (
          (() => {
            const linkedDokument = getLinkedDokument(dokumente, 'auftrag_id', a.id)
            return (
          <div key={a.id} className="pk-card" style={{ border: `1px solid ${statusColor[a.status]}20`, cursor: 'pointer' }} onClick={() => openEdit(a)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{a.id}</span>
                  <StatusBadgeAuftrag status={a.status} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{a.beschreibung}</div>
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>🏢 {a.kunde}</div>
                {a.ab_nummer && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.3)', color: '#1684ff', fontFamily: 'monospace' }}>
                      AB: {a.ab_nummer}
                    </span>
                  </div>
                )}
                <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 4 }}>Dokument: {linkedDokument?.name ?? '—'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#20c8ff' }}>{a.wert}</div>
                <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 2 }}>{a.start} – {a.ende}</div>
              </div>
            </div>
            <ProgressBar value={a.fortschritt} color={statusColor[a.status]} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {a.status === 'AB erforderlich' && (
                <button onClick={e => { e.stopPropagation(); handleABErstellen(a.id) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(245,158,11,.4)', background: 'rgba(245,158,11,.1)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                  📋 AB erstellen
                </button>
              )}
              {a.status === 'AB erstellt' && (
                <button onClick={e => { e.stopPropagation(); const k = kunden.find(k => k.id === a.kunde_id || k.name === a.kunde); setAuftragMailTarget({ id: a.id, email: k?.email || '', typ: 'ab' }) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(32,200,255,.4)', background: 'rgba(32,200,255,.1)', color: '#20c8ff', cursor: 'pointer', fontWeight: 700 }}>
                  ✉️ AB verschicken
                </button>
              )}
              {a.status === 'AB versendet' && (
                <button onClick={e => { e.stopPropagation(); handleABStarten(a.id) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'rgba(37,211,102,.08)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>
                  ▶ Auftrag starten
                </button>
              )}
              {a.ab_nummer && (
                <button onClick={e => { e.stopPropagation(); generateAuftragsbestaetigungPDF(a, a.kunde) }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(32,200,255,.25)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                  📄 AB-PDF
                </button>
              )}
              {(a.status === 'In Bearbeitung' || a.status === 'Abgeschlossen') && (
                <button onClick={e => { e.stopPropagation(); handleAuftragZuRechnung(a) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                  → Rechnung erstellen
                </button>
              )}
              {a.status === 'In Bearbeitung' && (
                <button onClick={e => { e.stopPropagation(); handleAbschliessen(a.id) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                  ✅ Abschließen
                </button>
              )}
              {(a.status === 'In Bearbeitung' || a.status === 'AB erstellt') && (
                <button onClick={e => {
                  e.stopPropagation()
                  const params = new URLSearchParams({ new: '1', auftragsnr: a.ab_nummer || a.id, kunde: a.kunde || '', titel: a.beschreibung || '' })
                  window.open(`/dashboard/werkstatt?${params.toString()}`, '_blank')
                }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(167,139,250,.35)', background: 'rgba(167,139,250,.1)', color: '#a78bfa', cursor: 'pointer', fontWeight: 700 }}>
                  🛠️ Arbeitskarte erstellen
                </button>
              )}
              <button onClick={e => { e.stopPropagation(); openEdit(a) }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                ✏️ Bearbeiten
              </button>
              <button onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/auftraege/${encodeURIComponent(a.id)}` }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                ↗ Details
              </button>
              {deleteId === a.id ? (
                <DeleteConfirm label={a.id} onConfirm={() => handleDelete(a.id)} onCancel={() => setDeleteId(null)} />
              ) : (
                <button onClick={e => { e.stopPropagation(); setDeleteId(a.id) }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                  🗑️ Löschen
                </button>
              )}
            </div>
          </div>
            )
          })()
        ))}
      </div>

      {auftragMailTarget && (() => {
        const auftrag = auftraege.find(a => a.id === auftragMailTarget.id)
        if (!auftrag) return null
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setAuftragMailTarget(null)}>
            <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>✉️ Auftragsbestätigung senden</h3>
                <button onClick={() => setAuftragMailTarget(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 14 }}>
                <strong style={{ color: '#f8fbff' }}>{auftrag.ab_nummer || auftrag.id}</strong> — {auftrag.kunde} — {auftrag.wert}
              </div>
              <label style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>E-Mail-Adresse des Empfängers</label>
              <input
                className="pk-input"
                type="email"
                value={auftragMailTarget.email}
                onChange={e => setAuftragMailTarget({ ...auftragMailTarget, email: e.target.value })}
                placeholder="kunde@beispiel.de"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <button
                className="pk-btn-ghost"
                style={{ fontWeight: 700, marginBottom: 10, width: '100%' }}
                onClick={() => generateAuftragsbestaetigungPDF(auftrag, auftrag.kunde)}
              >
                📄 PDF erstellen & herunterladen
              </button>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="pk-btn-ghost" onClick={() => setAuftragMailTarget(null)} disabled={auftragMailSending}>Abbrechen</button>
                <button
                  className="pk-btn"
                  disabled={auftragMailSending || !auftragMailTarget.email.includes('@')}
                  onClick={() => handleABMailSend(auftragMailTarget.email, auftrag)}
                >
                  {auftragMailSending ? '⏳ Sende…' : '✉️ Jetzt senden'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Rechnungen-Hilfsfunktionen ──────────────────────────────────────────────

function berechneBetragAusPositionen(pos: Position[]): string {
  const sum = pos.reduce((s, p) => s + p.menge * p.einzelpreis, 0)
  return sum.toFixed(2).replace('.', ',') + ' €'
}

function PositionenEditor({ positionen, onChange }: { positionen: Position[]; onChange: (p: Position[]) => void }) {
  const addPos = () => onChange([...positionen, { id: `POS-${Date.now()}`, beschreibung: '', menge: 1, einheit: 'Stk', einzelpreis: 0 }])
  const updPos = (idx: number, field: keyof Position, value: string | number) => onChange(positionen.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  const remPos = (idx: number) => onChange(positionen.filter((_, i) => i !== idx))
  if (positionen.length === 0) {
    return <button type="button" className="pk-btn-ghost" onClick={addPos} style={{ fontSize: 12, marginTop: 4 }}>+ Positionen hinzufügen</button>
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, marginBottom: 6 }}>Positionen</div>
      {positionen.map((pos, idx) => (
        <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <input className="pk-input" placeholder="Beschreibung" value={pos.beschreibung} onChange={e => updPos(idx, 'beschreibung', e.target.value)} style={{ fontSize: 12 }} />
          <input className="pk-input" type="number" placeholder="Menge" value={pos.menge} min={0} onChange={e => updPos(idx, 'menge', parseFloat(e.target.value) || 0)} style={{ fontSize: 12 }} />
          <input className="pk-input" placeholder="Einheit" value={pos.einheit} onChange={e => updPos(idx, 'einheit', e.target.value)} style={{ fontSize: 12 }} />
          <input className="pk-input" type="number" placeholder="Preis €" value={pos.einzelpreis} min={0} step={0.01} onChange={e => updPos(idx, 'einzelpreis', parseFloat(e.target.value) || 0)} style={{ fontSize: 12 }} />
          <button type="button" onClick={() => remPos(idx)} style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      ))}
      <button type="button" className="pk-btn-ghost" onClick={addPos} style={{ fontSize: 11, marginTop: 2 }}>+ Position</button>
    </div>
  )
}

// ── Rechnungen-Tab ──────────────────────────────────────────────────────────

function RechnungenTab({ isDemo, kunden, initialFilterStatus, sharedRechnungen, setSharedRechnungen, sharedMailTarget, setSharedMailTarget }: { isDemo: boolean; kunden: Kunde[]; initialFilterStatus?: string; sharedRechnungen?: Rechnung[]; setSharedRechnungen?: React.Dispatch<React.SetStateAction<Rechnung[]>>; sharedMailTarget?: { id: string; email: string; typ: 'rechnung' } | null; setSharedMailTarget?: React.Dispatch<React.SetStateAction<{ id: string; email: string; typ: 'rechnung' } | null>> }) {
  const [rechnungenLocal, setRechnungenLocal] = useState<Rechnung[]>(isDemo ? demoRechnungen : [])
  const rechnungen = sharedRechnungen ?? rechnungenLocal
  const setRechnungen: React.Dispatch<React.SetStateAction<Rechnung[]>> = setSharedRechnungen ?? setRechnungenLocal
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [form, setForm] = useState({ kunde: '', betrag: '', faellig: '', dokumentId: '' })

  // Edit-Modal
  const [editRechnung, setEditRechnung] = useState<Rechnung | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', betrag: '', faellig: '', status: 'Offen' as Rechnung['status'], dokumentId: '' })
  const [editPositionen, setEditPositionen] = useState<Position[]>([])

  // Positionen (Neu-Formular)
  const [formPositionen, setFormPositionen] = useState<Position[]>([])

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Mail-Versand
  const [mailTargetLocal, setMailTargetLocal] = useState<{ id: string; email: string; typ: 'rechnung' } | null>(null)
  const mailTarget = sharedMailTarget !== undefined ? sharedMailTarget : mailTargetLocal
  const setMailTarget = (setSharedMailTarget ?? setMailTargetLocal) as React.Dispatch<React.SetStateAction<{ id: string; email: string; typ: 'rechnung' } | null>>
  const [mailSending, setMailSending] = useState(false)

  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroRechnungen(), getBueroDokumente()])
      .then(([rechnungenData, dokumenteData]) => {
        setRechnungen(rechnungenData as Rechnung[])
        setDokumente(dokumenteData as Dokument[])
      })
      .catch(() => showToast('Fehler beim Laden der Rechnungen', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    if (!initialFilterStatus) return
    if (['Alle', 'Offen', 'Überfällig', 'Mahnung', 'Bezahlt'].includes(initialFilterStatus)) {
      setFilterStatus(initialFilterStatus)
    }
  }, [initialFilterStatus])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleRechnungMailSend = async (email: string, rechnung: Rechnung) => {
    setMailSending(true)
    try {
      const subject = `Ihre Rechnung ${rechnung.nummer || rechnung.id} von Petersen KI`
      const body = [
        'Guten Tag,',
        '',
        `anbei erhalten Sie die Rechnung ${rechnung.nummer || rechnung.id}.`,
        `Betrag: ${rechnung.betrag}`,
        rechnung.faellig ? `Faelligkeit: ${rechnung.faellig}` : '',
        '',
        'Viele Gruesse',
      ].filter(Boolean).join('\n')
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      showToast(`Mailentwurf fuer ${email} geoeffnet.`)
    } catch {
      showToast('Mailentwurf konnte nicht geoeffnet werden.', true)
    } finally {
      setMailSending(false)
      setMailTarget(null)
    }
  }

  const filtered = rechnungen.filter(r => filterStatus === 'Alle' || r.status === filterStatus)
  const dokumentOptionen = dokumente.filter(doc => isDokumentAvailableForRelation(doc, 'rechnung_id', editRechnung?.id))
  const counts: Record<string, number> = { Alle: rechnungen.length }
  rechnungen.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })

  // KPI-Summen
  const sumOffen = rechnungen.filter(r => r.status === 'Offen').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const sumBezahlt = rechnungen.filter(r => r.status === 'Bezahlt').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const sumUeberfaellig = rechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const fmtEur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  // OPOS: Fälligkeits-Aging-Buckets (offene + überfällige Rechnungen)
  const oposRechnungen = rechnungen.filter(r => r.status === 'Offen' || r.status === 'Überfällig' || r.status === 'Mahnung')
  const oposBuckets = oposRechnungen.reduce((acc, r) => {
    if (!r.faellig) { acc.unbekannt += parseBetrag(r.betrag); return acc }
    const faelligDate = (() => {
      const parts = r.faellig.split('.')
      if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0])
      return new Date(r.faellig)
    })()
    if (isNaN(faelligDate.getTime())) { acc.unbekannt += parseBetrag(r.betrag); return acc }
    const diffDays = Math.ceil((faelligDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diffDays > 30) acc.faelligSpaeter += parseBetrag(r.betrag)
    else if (diffDays > 0) acc.faelligBald += parseBetrag(r.betrag)
    else if (diffDays > -30) acc.ueberfaellig30 += parseBetrag(r.betrag)
    else acc.ueberfaelligAlt += parseBetrag(r.betrag)
    return acc
  }, { faelligSpaeter: 0, faelligBald: 0, ueberfaellig30: 0, ueberfaelligAlt: 0, unbekannt: 0 })

  const syncDokumentVerknuepfung = async (rechnung: Rechnung, dokumentId: string, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = dokumentId || null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { rechnung_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      eingangsrechnung_id: null,
      rechnung_id: rechnung.id,
      angebot_id: null,
      auftrag_id: null,
      kategorie: 'Rechnung',
      bezug: rechnung.kunde,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'rechnung_id', rechnung.id, { kategorie: 'Rechnung', bezug: rechnung.kunde })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'rechnung_id')
          : doc
    )))
  }

  const handleBezahlt = async (id: string) => {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo && rechnung) {
      try { await upsertBueroRechnung({ ...rechnung, status: 'Bezahlt', bezahlt_am: today }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'Bezahlt', bezahltAm: today } : r))
    showToast(`✅ Rechnung ${id} als bezahlt markiert`)
  }

  const handleMahnung = async (id: string) => {
    const rechnung = rechnungen.find(r => r.id === id)
    if (!rechnung) return
    const newCount = (rechnung.mahnung_count ?? 0) + 1
    if (!isDemo) {
      try { await upsertBueroRechnung({ ...rechnung, status: 'Mahnung', mahnung_count: newCount }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'Mahnung', mahnung_count: newCount } : r))
    const stufe = newCount === 1 ? '1. Mahnung' : newCount === 2 ? '2. Mahnung' : `${newCount}. Mahnung`
    const subject = `${stufe}: Rechnung ${rechnung.nummer || rechnung.id}`
    const body = [
      `Guten Tag ${rechnung.kunde},`,
      '',
      newCount === 1
        ? 'hiermit möchten wir Sie freundlich an die offene Zahlung folgender Rechnung erinnern:'
        : newCount === 2
          ? 'trotz unserer ersten Zahlungserinnerung haben wir noch keinen Zahlungseingang verzeichnen können. Wir bitten Sie dringend, folgenden Betrag zu begleichen:'
          : 'wir müssen Sie letztmalig zur Zahlung auffordern, da trotz mehrfacher Erinnerung noch kein Zahlungseingang erfolgt ist:',
      '',
      `Rechnungsnummer: ${rechnung.nummer || rechnung.id}`,
      `Betrag: ${rechnung.betrag}`,
      `Fälligkeitsdatum: ${rechnung.faellig}`,
      '',
      newCount >= 3
        ? 'Bitte überweisen Sie den ausstehenden Betrag innerhalb von 5 Werktagen. Bei weiterer Nichtzahlung behalten wir uns rechtliche Schritte vor.'
        : 'Bitte überweisen Sie den ausstehenden Betrag innerhalb von 7 Werktagen auf unser Konto.',
      '',
      'Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.',
      '',
      'Mit freundlichen Grüßen',
    ].join('\n')
    const k = kunden.find(k => k.id === rechnung.kunde_id || k.name === rechnung.kunde)
    if (k?.email) {
      window.location.href = `mailto:${encodeURIComponent(k.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
    showToast(`📮 ${stufe} für ${rechnung.nummer || id} erstellt – Mail-Entwurf vorbereitet`)
  }

  const handleNeu = async () => {
    const berechneterBetrag = formPositionen.length > 0 ? berechneBetragAusPositionen(formPositionen) : form.betrag
    if (!form.kunde || !berechneterBetrag) return
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const kunde = kunden.find(entry => entry.name === form.kunde)
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const reId = genId('RE')
    const nummer = isDemo
      ? `RE-${new Date().getFullYear()}-DEMO`
      : await getNextInvoiceNumber().catch(() => reId)
    const newRe: Rechnung = {
      id: reId,
      nummer,
      kunde_id: kunde?.id,
      kunde: form.kunde,
      betrag: formPositionen.length > 0 ? berechneterBetrag : (form.betrag.includes('€') ? form.betrag : `${form.betrag} €`),
      faellig: form.faellig || fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      erstellt: fmt(today),
      status: 'Offen',
      positionen: formPositionen.length > 0 ? formPositionen : undefined,
    }
    if (!isDemo) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { positionen: _pos1, ...newReDb } = newRe
        await upsertBueroRechnung(newReDb)
        await syncDokumentVerknuepfung(newRe, form.dokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => [newRe, ...prev])
    setForm({ kunde: '', betrag: '', faellig: '', dokumentId: '' })
    setFormPositionen([])
    setShowForm(false)
    showToast(`✅ Rechnung ${newRe.id} wurde erstellt`)
  }

  const openEdit = (r: Rechnung) => {
    setEditRechnung(r)
    setEditPositionen(r.positionen ?? [])
    setEditForm({
      kunde: r.kunde,
      betrag: r.betrag,
      faellig: r.faellig,
      status: r.status,
      dokumentId: getLinkedDokument(dokumente, 'rechnung_id', r.id)?.id ?? '',
    })
  }

  const handleEditSave = async () => {
    if (!editRechnung) return
    const previousDokumentId = getLinkedDokument(dokumente, 'rechnung_id', editRechnung.id)?.id
    const berechneterBetrag = editPositionen.length > 0 ? berechneBetragAusPositionen(editPositionen) : (editForm.betrag.includes('€') ? editForm.betrag : `${editForm.betrag} €`)
    const updated: Rechnung = { ...editRechnung, ...editForm, betrag: berechneterBetrag, positionen: editPositionen.length > 0 ? editPositionen : undefined }
    if (!isDemo) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { positionen: _pos2, ...updatedDb } = updated
        await upsertBueroRechnung(updatedDb)
        await syncDokumentVerknuepfung(updated, editForm.dokumentId, previousDokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditRechnung(null)
    showToast(`✅ Rechnung ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try {
        const linkedDokument = getLinkedDokument(dokumente, 'rechnung_id', id)
        if (linkedDokument) await updateBueroDokument(linkedDokument.id, { rechnung_id: null })
        await deleteBueroRechnung(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setRechnungen(prev => prev.filter(r => r.id !== id))
    setDokumente(prev => prev.map(doc => doc.rechnung_id === id ? { ...doc, rechnung_id: undefined } : doc))
    showToast(`🗑️ Rechnung ${id} wurde gelöscht`)
  }

  const offenCount = rechnungen.filter(r => r.status === 'Offen' || r.status === 'Überfällig' || r.status === 'Mahnung').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Rechnungen…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editRechnung && (
        <Modal title={`💶 Rechnung bearbeiten – ${editRechnung.id}`} onClose={() => setEditRechnung(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Betrag (€) {editPositionen.length > 0 ? '(automatisch)' : ''}</label>
              <input className="pk-input" value={editPositionen.length > 0 ? berechneBetragAusPositionen(editPositionen) : editForm.betrag} onChange={e => { if (editPositionen.length === 0) setEditForm(p => ({ ...p, betrag: e.target.value })) }} readOnly={editPositionen.length > 0} style={editPositionen.length > 0 ? { opacity: 0.6 } : {}} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <PositionenEditor positionen={editPositionen} onChange={setEditPositionen} />
            </div>
            <div>
              <label style={labelStyle}>Fällig am</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.faellig} onChange={e => setEditForm(p => ({ ...p, faellig: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Rechnung['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Offen</option>
                <option>Bezahlt</option>
                <option>Überfällig</option>
                <option>Mahnung</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={editForm.dokumentId} onChange={e => setEditForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditRechnung(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      {/* OPOS-Dashboard */}
      <div className="pk-card" style={{ marginBottom: 20, padding: 18, border: '1px solid rgba(32,200,255,.15)' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: '#20c8ff' }}>📊 OPOS-Dashboard (Offene Posten)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Offen', value: fmtEur(sumOffen), icon: '⏳', color: '#20c8ff', bg: 'rgba(32,200,255,.08)', border: 'rgba(32,200,255,.2)', filter: 'Offen' },
            { label: 'Überfällig/Mahnung', value: fmtEur(sumUeberfaellig), icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)', filter: 'Überfällig' },
            { label: 'Bezahlt', value: fmtEur(sumBezahlt), icon: '✅', color: '#4ddb7e', bg: 'rgba(37,211,102,.08)', border: 'rgba(37,211,102,.2)', filter: 'Bezahlt' },
          ].map(k => (
            <button key={k.label} onClick={() => setFilterStatus(k.filter as typeof filterStatus)} style={{ padding: '14px 16px', borderRadius: 12, background: k.bg, border: `1px solid ${k.border}`, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
            </button>
          ))}
        </div>
        {oposRechnungen.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Fälligkeits-Aging</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {[
                { label: '> 30T (noch Zeit)', val: oposBuckets.faelligSpaeter, color: '#4ddb7e' },
                { label: '≤ 30T (bald fällig)', val: oposBuckets.faelligBald, color: '#f59e0b' },
                { label: '≤ 30T überfällig', val: oposBuckets.ueberfaellig30, color: '#fb7185' },
                { label: '> 30T überfällig', val: oposBuckets.ueberfaelligAlt, color: '#f43f5e' },
              ].filter(b => b.val > 0).map(b => (
                <div key={b.label} style={{ padding: '10px 12px', borderRadius: 10, background: b.color + '10', border: `1px solid ${b.color}30` }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: b.color, fontFamily: 'monospace' }}>{fmtEur(b.val)}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {offenCount > 0 && (
        <button onClick={() => setFilterStatus('Offen')} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#ffb347' }}>
            {offenCount} offene Rechnungen – bitte prüfen und ggf. mahnen
          </span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Offen', 'Überfällig', 'Mahnung', 'Bezahlt'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Rechnung'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>💶 Neue Rechnung erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde *</label>
              <select className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Betrag (€) {formPositionen.length > 0 ? '(automatisch)' : '*'}</label>
              <input className="pk-input" placeholder="z.B. 2.400,00" value={formPositionen.length > 0 ? berechneBetragAusPositionen(formPositionen) : form.betrag} onChange={e => { if (formPositionen.length === 0) setForm(p => ({ ...p, betrag: e.target.value })) }} readOnly={formPositionen.length > 0} style={formPositionen.length > 0 ? { opacity: 0.6 } : {}} />
            </div>
            <div>
              <label style={labelStyle}>Fällig am</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.faellig} onChange={e => setForm(p => ({ ...p, faellig: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <PositionenEditor positionen={formPositionen} onChange={setFormPositionen} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={form.dokumentId} onChange={e => setForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleNeu}>Rechnung erstellen</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr.</th>
              <th>Kunde</th>
              <th>Betrag</th>
              <th>Erstellt</th>
              <th>Fällig</th>
              <th>Dokument</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              (() => {
                const linkedDokument = getLinkedDokument(dokumente, 'rechnung_id', r.id)
                return (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{r.nummer || r.id}</td>
                <td style={{ fontWeight: 600 }}>{r.kunde}</td>
                <td style={{ fontWeight: 800, fontSize: 15, color: r.status === 'Bezahlt' ? '#4ddb7e' : '#f8fbff' }}>{r.betrag}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{r.erstellt}</td>
                <td style={{ color: r.status === 'Überfällig' ? '#ffb347' : '#aeb9c8', fontSize: 13, fontWeight: r.status === 'Überfällig' ? 700 : 400 }}>
                  {r.bezahltAm ? `Bezahlt: ${r.bezahltAm}` : r.faellig}
                </td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{linkedDokument?.name ?? '—'}</td>
                <td>
                  <StatusBadgeRechnung status={r.status} />
                  {r.status === 'Mahnung' && (r.mahnung_count ?? 0) > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,165,0,.15)', color: '#ffb347', fontWeight: 700 }}>
                      {r.mahnung_count}. Mahnung
                    </span>
                  )}
                </td>
                <td>
                  {deleteId === r.id ? (
                    <DeleteConfirm label={r.id} onConfirm={() => handleDelete(r.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(r.status === 'Offen' || r.status === 'Überfällig') && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleBezahlt(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                            ✅ Bezahlt
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleMahnung(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>
                            📮 Mahnen
                          </button>
                        </>
                      )}
                      {r.status === 'Mahnung' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleBezahlt(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                            ✅ Bezahlt
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleMahnung(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>
                            📮 {(r.mahnung_count ?? 1) + 1}. Mahnung
                          </button>
                        </>
                      )}
                      <button onClick={e => { e.stopPropagation(); generateRechnungPDF(r, r.kunde) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                        📄 PDF
                      </button>
                      <button onClick={e => {
                        e.stopPropagation()
                        const k = kunden.find(k => k.id === r.kunde_id || k.name === r.kunde)
                        setMailTarget({ id: r.id, email: k?.email || '', typ: 'rechnung' })
                      }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                        ✉️ Mail
                      </button>
                      <button onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/rechnungen/${encodeURIComponent(r.id)}` }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                        ↗ Details
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(r) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteId(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
                )
              })()
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Rechnungen</div>

      {/* Mail-Modal */}
      {mailTarget && (() => {
        const rechnung = rechnungen.find(r => r.id === mailTarget.id)
        if (!rechnung) return null
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setMailTarget(null)}>
            <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>✉️ Rechnung per Mail senden</h3>
                <button onClick={() => setMailTarget(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 14 }}>
                <strong style={{ color: '#f8fbff' }}>{rechnung.nummer || rechnung.id}</strong> — {rechnung.kunde} — {rechnung.betrag}
              </div>
              <label style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>E-Mail-Adresse des Empfängers</label>
              <input
                className="pk-input"
                type="email"
                value={mailTarget.email}
                onChange={e => setMailTarget({ ...mailTarget, email: e.target.value })}
                placeholder="kunde@beispiel.de"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <button
                className="pk-btn-ghost"
                style={{ fontWeight: 700, marginBottom: 10, width: '100%' }}
                onClick={() => {
                  const r = rechnungen.find(r => r.id === mailTarget.id)
                  if (r) generateRechnungPDF(r, r.kunde)
                }}
              >
                📄 PDF erstellen & herunterladen
              </button>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="pk-btn-ghost" onClick={() => setMailTarget(null)} disabled={mailSending}>Abbrechen</button>
                <button
                  className="pk-btn"
                  disabled={mailSending || !mailTarget.email.includes('@')}
                  onClick={() => handleRechnungMailSend(mailTarget.email, rechnung)}
                >
                  {mailSending ? '⏳ Sende…' : '✉️ Jetzt senden'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Eingangsrechnungen-Tab ───────────────────────────────────────────────────

const emptyEingangsForm = {
  lieferant: '', rechnungsnummer: '', rechnungsdatum: '', faelligkeit: '',
  betrag_netto: '', mwst: '', betrag_brutto: '', status: 'offen' as EingangsrechnungStatus,
  kategorie: '', iban: '', verwendungszweck: '', notiz: '', dokument_id: '', dokument_url: '',
}

function EingangRechnungenTab({ isDemo, initialFilterStatus }: { isDemo: boolean; initialFilterStatus?: string }) {
  const [rechnungen, setRechnungen] = useState<Eingangsrechnung[]>(isDemo ? demoEingangsrechnungen : [])
  const [lieferantenStamm, setLieferantenStamm] = useState<Lieferant[]>(isDemo ? demoLieferanten : [])
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [loading, setLoading] = useState(!isDemo)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'Alle' | EingangsrechnungStatus>('Alle')
  const [filterLieferant, setFilterLieferant] = useState('Alle')
  const [showForm, setShowForm] = useState(false)
  const [editRechnung, setEditRechnung] = useState<Eingangsrechnung | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyEingangsForm)
  const [previewDoc, setPreviewDoc] = useState<StoredDocumentLink | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error); setTimeout(() => setToast(''), 3500)
  }

  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroEingangsrechnungen(), getBueroDokumente(), getEinkaufLieferanten()])
      .then(([rechnungenData, dokumenteData, lieferantenData]) => {
        setRechnungen(rechnungenData as Eingangsrechnung[])
        setDokumente(dokumenteData as Dokument[])
        setLieferantenStamm(lieferantenData as Lieferant[])
      })
      .catch(() => showToast('Fehler beim Laden der Eingangsrechnungen', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    if (!initialFilterStatus) return
    if (['Alle', 'offen', 'geprüft', 'freigegeben', 'bezahlt', 'überfällig', 'abgelehnt'].includes(initialFilterStatus)) {
      setFilterStatus(initialFilterStatus as 'Alle' | EingangsrechnungStatus)
    }
  }, [initialFilterStatus])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pk_doc_ai_eingangsrechnung')
      if (!raw) return
      const imported = JSON.parse(raw) as Partial<Eingangsrechnung>
      if (!imported.lieferant && !imported.rechnungsnummer) return
      setForm({
        lieferant: imported.lieferant ?? '',
        rechnungsnummer: imported.rechnungsnummer ?? '',
        rechnungsdatum: imported.rechnungsdatum ?? '',
        faelligkeit: imported.faelligkeit ?? '',
        betrag_netto: imported.betrag_netto != null ? String(imported.betrag_netto) : '',
        mwst: imported.mwst != null ? String(imported.mwst) : '',
        betrag_brutto: imported.betrag_brutto != null ? String(imported.betrag_brutto) : '',
        status: imported.status ?? 'offen',
        kategorie: imported.kategorie ?? 'Dokumenten-KI',
        iban: imported.iban ?? '',
        verwendungszweck: imported.verwendungszweck ?? imported.rechnungsnummer ?? '',
        notiz: imported.notiz ?? 'Aus Dokumenten-KI übernommen. Bitte prüfen.',
        dokument_id: imported.dokument_id ?? '',
        dokument_url: imported.dokument_url ?? '',
      })
      setShowForm(true)
      localStorage.removeItem('pk_doc_ai_eingangsrechnung')
      showToast('📄 Erkannte Rechnung aus dem KI-Assistenten vorbereitet')
    } catch {}
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = (r: Eingangsrechnung) => r.status !== 'bezahlt' && !!r.faelligkeit && r.faelligkeit < today
  const withDueStatus = (r: Eingangsrechnung): Eingangsrechnung => isOverdue(r) && r.status === 'offen' ? { ...r, status: 'überfällig' } : r
  const visibleRows = rechnungen.map(withDueStatus)
  const lieferanten = ['Alle', ...Array.from(new Set(visibleRows.map(r => r.lieferant).filter(Boolean)))]
  const filtered = visibleRows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || [r.lieferant, r.rechnungsnummer, r.kategorie, r.verwendungszweck].some(v => (v ?? '').toLowerCase().includes(q))
    const matchS = filterStatus === 'Alle' || r.status === filterStatus
    const matchL = filterLieferant === 'Alle' || r.lieferant === filterLieferant
    return matchQ && matchS && matchL
  })

  const offen = visibleRows.filter(r => ['offen', 'geprüft', 'freigegeben', 'überfällig'].includes(r.status)).length
  const ueberfaellig = visibleRows.filter(r => r.status === 'überfällig').length
  const bezahlt = visibleRows.filter(r => r.status === 'bezahlt').length
  const sumOffen = visibleRows.filter(r => r.status !== 'bezahlt' && r.status !== 'abgelehnt').reduce((s, r) => s + Number(r.betrag_brutto ?? 0), 0)
  const dokumentOptionen = dokumente.filter(d => isDokumentAvailableForRelation(d, 'eingangsrechnung_id', editRechnung?.id))

  const syncDokumentVerknuepfung = async (rechnung: Eingangsrechnung, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = rechnung.dokument_id ?? null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { eingangsrechnung_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      eingangsrechnung_id: rechnung.id,
      rechnung_id: null,
      angebot_id: null,
      auftrag_id: null,
      kategorie: 'Rechnung',
      bezug: rechnung.lieferant,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'eingangsrechnung_id', rechnung.id, { kategorie: 'Rechnung', bezug: rechnung.lieferant })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'eingangsrechnung_id')
          : doc
    )))
  }

  const openNew = () => { setEditRechnung(null); setForm(emptyEingangsForm); setShowForm(true) }
  const openEdit = (r: Eingangsrechnung) => {
    setEditRechnung(r)
    setForm({
      lieferant: r.lieferant ?? '', rechnungsnummer: r.rechnungsnummer ?? '', rechnungsdatum: r.rechnungsdatum ?? '',
      faelligkeit: r.faelligkeit ?? '', betrag_netto: String(r.betrag_netto ?? ''), mwst: String(r.mwst ?? ''),
      betrag_brutto: String(r.betrag_brutto ?? ''), status: r.status, kategorie: r.kategorie ?? '', iban: r.iban ?? '',
      verwendungszweck: r.verwendungszweck ?? '', notiz: r.notiz ?? '', dokument_id: r.dokument_id ?? '', dokument_url: r.dokument_url ?? '',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.lieferant.trim()) { showToast('Lieferant ist Pflicht', true); return }
    const previousDokumentId = editRechnung?.dokument_id
    const lieferant = lieferantenStamm.find(entry => entry.name === form.lieferant.trim())
    const payload: Eingangsrechnung = {
      id: editRechnung?.id ?? genId('ER'),
      lieferant_id: lieferant?.id ?? editRechnung?.lieferant_id,
      lieferant: form.lieferant.trim(),
      rechnungsnummer: form.rechnungsnummer.trim(),
      rechnungsdatum: form.rechnungsdatum || undefined,
      faelligkeit: form.faelligkeit || undefined,
      betrag_netto: parseFloat(form.betrag_netto.replace(',', '.')) || 0,
      mwst: parseFloat(form.mwst.replace(',', '.')) || 0,
      betrag_brutto: parseFloat(form.betrag_brutto.replace(',', '.')) || 0,
      status: form.status,
      kategorie: form.kategorie,
      iban: form.iban,
      verwendungszweck: form.verwendungszweck,
      notiz: form.notiz,
      dokument_id: form.dokument_id || undefined,
      dokument_url: form.dokument_url || undefined,
      bezahlt_am: form.status === 'bezahlt' ? (editRechnung?.bezahlt_am ?? today) : undefined,
    }
    if (!isDemo) {
      try {
        await upsertBueroEingangsrechnung(payload)
        await syncDokumentVerknuepfung(payload, previousDokumentId)
      } catch {
        showToast('Fehler beim Speichern', true); return
      }
    }
    setRechnungen(prev => editRechnung ? prev.map(r => r.id === payload.id ? payload : r) : [payload, ...prev])
    setShowForm(false); setEditRechnung(null); setForm(emptyEingangsForm)
    showToast(editRechnung ? '✅ Eingangsrechnung aktualisiert' : '✅ Eingangsrechnung angelegt')
  }

  const remove = async (id: string) => {
    if (deleteId !== id) { setDeleteId(id); return }
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo) {
      try {
        if (rechnung?.dokument_id) await updateBueroDokument(rechnung.dokument_id, { eingangsrechnung_id: null })
        await deleteBueroEingangsrechnung(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setRechnungen(prev => prev.filter(r => r.id !== id))
    if (rechnung?.dokument_id) {
      setDokumente(prev => prev.map(doc => doc.id === rechnung.dokument_id ? { ...doc, eingangsrechnung_id: undefined } : doc))
    }
    setDeleteId(null)
    showToast('🗑️ Eingangsrechnung gelöscht')
  }

  const markPaid = async (id: string) => {
    if (confirmPayId !== id) { setConfirmPayId(id); return }
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo) {
      try {
        await markEingangsrechnungBezahlt(id, today)
        // Sync zu SteuerPilot: Beleg anlegen
        if (rechnung) {
          const steuersatz = rechnung.betrag_netto && rechnung.betrag_brutto && rechnung.betrag_brutto > rechnung.betrag_netto
            ? Math.round((rechnung.betrag_brutto / rechnung.betrag_netto - 1) * 100)
            : 19
          const steuerbetrag = rechnung.mwst ?? (rechnung.betrag_brutto ?? 0) - (rechnung.betrag_netto ?? 0)
          await upsertSteuerBeleg({
            id: `BLG-ER-${id}`,
            lieferant: rechnung.lieferant,
            betrag: rechnung.betrag_brutto ?? 0,
            steuerbetrag: steuerbetrag,
            steuersatz: [0, 7, 19].includes(steuersatz) ? steuersatz : 19,
            datum: rechnung.rechnungsdatum ?? today,
            status: 'geprüft',
            notiz: `Aus Eingangsrechnung ${rechnung.rechnungsnummer ?? id} (auto-sync)`,
          })
        }
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'bezahlt', bezahlt_am: today } : r))
    setConfirmPayId(null)
    showToast('💚 Eingangsrechnung als bezahlt markiert — Beleg in SteuerPilot angelegt')
  }

  const changeStatus = async (id: string, status: EingangsrechnungStatus) => {
    if (!isDemo) {
      try { await updateEingangsrechnungStatus(id, status) } catch { showToast('Fehler beim Status-Update', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const openLinkedDocument = async (rechnung: Eingangsrechnung) => {
    if (isDemo) {
      showToast('Demo: Für verknüpfte Dokumente ist keine echte Datei hinterlegt.', true)
      return
    }

    const docLink: StoredDocumentLink = {
      id: rechnung.id,
      name: rechnung.rechnungsnummer || rechnung.id,
      typ: 'PDF',
      dokument_id: rechnung.dokument_id,
      dokument_url: rechnung.dokument_url,
    }

    setPreviewDoc(docLink)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewUrl('')

    try {
      setPreviewUrl(await resolveDocumentViewUrl(docLink))
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Dokument konnte nicht geöffnet werden.')
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) return <div className="pk-card" style={{ color: '#aeb9c8' }}>Lade Eingangsrechnungen…</div>

  return (
    <div>
      <Toast msg={toast} error={toastError} />
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          url={previewUrl}
          loading={previewLoading}
          error={previewError}
          onClose={() => {
            setPreviewDoc(null)
            setPreviewUrl('')
            setPreviewError(null)
          }}
          onRetry={async () => {
            if (!previewDoc) return
            setPreviewLoading(true)
            setPreviewError(null)
            setPreviewUrl('')
            try {
              setPreviewUrl(await resolveDocumentViewUrl(previewDoc))
            } catch (err) {
              setPreviewError(err instanceof Error ? err.message : 'Dokument konnte nicht geöffnet werden.')
            } finally {
              setPreviewLoading(false)
            }
          }}
          onOpenExternal={previewUrl ? () => window.open(previewUrl, '_blank', 'noopener,noreferrer') : undefined}
        />
      )}
      {ueberfaellig > 0 && (
        <button onClick={() => setFilterStatus('überfällig')} style={{ width: '100%', marginBottom: 14, padding: '12px 16px', borderRadius: 10, background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.28)', color: '#fda4af', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
          ⚠️ {ueberfaellig} Eingangsrechnung{ueberfaellig !== 1 ? 'en sind' : ' ist'} überfällig und sollte geprüft werden.
        </button>
      )}

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Offen', value: String(offen), icon: '⏳', color: '#f59e0b' },
          { label: 'Überfällig', value: String(ueberfaellig), icon: '⚠️', color: ueberfaellig ? '#f43f5e' : '#10b981' },
          { label: 'Bezahlt', value: String(bezahlt), icon: '💚', color: '#10b981' },
          { label: 'Summe offen', value: sumOffen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), icon: '💶', color: '#20c8ff' },
        ].map(s => (
          <button key={s.label} className="pk-card" onClick={() => setFilterStatus(s.label === 'Offen' ? 'offen' : s.label === 'Überfällig' ? 'überfällig' : s.label === 'Bezahlt' ? 'bezahlt' : 'Alle')} style={{ textAlign: 'center', padding: '14px 10px', cursor: 'pointer', color: 'inherit' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8' }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="pk-btn" onClick={openNew} style={{ fontWeight: 700 }}>+ Eingangsrechnung</button>
        <input className="pk-input" placeholder="Suche Lieferant, Nr., Kategorie…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <select className="pk-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'Alle' | EingangsrechnungStatus)} style={{ maxWidth: 180 }}>
          {(['Alle', 'offen', 'geprüft', 'freigegeben', 'bezahlt', 'überfällig', 'abgelehnt'] as const).map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="pk-input" value={filterLieferant} onChange={e => setFilterLieferant(e.target.value)} style={{ maxWidth: 220 }}>
          {lieferanten.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {showForm && (
        <Modal title={editRechnung ? `📥 Eingangsrechnung bearbeiten – ${editRechnung.id}` : '📥 Eingangsrechnung hinzufügen'} onClose={() => { setShowForm(false); setEditRechnung(null) }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <div><label style={labelStyle}>Lieferant *</label><input className="pk-input" value={form.lieferant} onChange={e => setForm(p => ({ ...p, lieferant: e.target.value }))} /></div>
            <div><label style={labelStyle}>Rechnungsnummer</label><input className="pk-input" value={form.rechnungsnummer} onChange={e => setForm(p => ({ ...p, rechnungsnummer: e.target.value }))} /></div>
            <div><label style={labelStyle}>Rechnungsdatum</label><input className="pk-input" type="date" value={form.rechnungsdatum} onChange={e => setForm(p => ({ ...p, rechnungsdatum: e.target.value }))} /></div>
            <div><label style={labelStyle}>Fälligkeit</label><input className="pk-input" type="date" value={form.faelligkeit} onChange={e => setForm(p => ({ ...p, faelligkeit: e.target.value }))} /></div>
            <div><label style={labelStyle}>Netto</label><input className="pk-input" type="number" step="0.01" value={form.betrag_netto} onChange={e => setForm(p => ({ ...p, betrag_netto: e.target.value }))} /></div>
            <div><label style={labelStyle}>MwSt</label><input className="pk-input" type="number" step="0.01" value={form.mwst} onChange={e => setForm(p => ({ ...p, mwst: e.target.value }))} /></div>
            <div><label style={labelStyle}>Brutto</label><input className="pk-input" type="number" step="0.01" value={form.betrag_brutto} onChange={e => setForm(p => ({ ...p, betrag_brutto: e.target.value }))} /></div>
            <div><label style={labelStyle}>Status</label><select className="pk-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as EingangsrechnungStatus }))}>{(['offen', 'geprüft', 'freigegeben', 'bezahlt', 'überfällig', 'abgelehnt'] as const).map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label style={labelStyle}>Kategorie</label><input className="pk-input" value={form.kategorie} onChange={e => setForm(p => ({ ...p, kategorie: e.target.value }))} /></div>
            <div><label style={labelStyle}>IBAN</label><input className="pk-input" value={form.iban} onChange={e => setForm(p => ({ ...p, iban: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select
                className="pk-input"
                value={form.dokument_id}
                onChange={e => setForm(p => ({ ...p, dokument_id: e.target.value, dokument_url: '' }))}
              >
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} ({doc.datum})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Verwendungszweck</label><input className="pk-input" value={form.verwendungszweck} onChange={e => setForm(p => ({ ...p, verwendungszweck: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notiz</label><textarea className="pk-input" rows={3} value={form.notiz} onChange={e => setForm(p => ({ ...p, notiz: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button className="pk-btn-ghost" onClick={() => { setShowForm(false); setEditRechnung(null) }}>Abbrechen</button>
            <button className="pk-btn" onClick={save} style={{ fontWeight: 700 }}>Speichern</button>
          </div>
        </Modal>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr><th>Nr.</th><th>Lieferant</th><th>Fälligkeit</th><th>Brutto</th><th>Status</th><th>Kategorie</th><th>Aktionen</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>Keine Eingangsrechnungen gefunden.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
                  <td><div style={{ fontFamily: 'monospace', color: '#6cb6ff', fontSize: 12 }}>{r.rechnungsnummer || r.id}</div><div style={{ color: '#aeb9c8', fontSize: 11 }}>{r.rechnungsdatum || '—'}</div></td>
                  <td style={{ fontWeight: 700 }}>{r.lieferant}</td>
                  <td style={{ color: isOverdue(r) ? '#f43f5e' : '#aeb9c8', fontWeight: isOverdue(r) ? 700 : 500 }}>{r.faelligkeit || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{Number(r.betrag_brutto ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                  <td><StatusBadgeEingangsrechnung status={r.status} /></td>
                  <td><span className="badge badge-gray">{r.kategorie || '—'}</span></td>
                  <td>
                    {deleteId === r.id ? <DeleteConfirm label={r.rechnungsnummer || r.id} onConfirm={() => remove(r.id)} onCancel={() => setDeleteId(null)} /> : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(r.dokument_url || r.dokument_id) && (
                          <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); openLinkedDocument(r) }} style={{ fontSize: 11, padding: '4px 9px' }}>
                            Dokument
                          </button>
                        )}
                        <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/eingangsrechnungen/${encodeURIComponent(r.id)}` }} style={{ fontSize: 11, padding: '4px 9px' }}>
                          Details
                        </button>
                        <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); openEdit(r) }} style={{ fontSize: 11, padding: '4px 9px' }}>Bearbeiten</button>
                        {r.status !== 'bezahlt' && (
                          confirmPayId === r.id ? (
                            <>
                              <button onClick={e => { e.stopPropagation(); markPaid(r.id) }} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(37,211,102,.35)', background: 'rgba(37,211,102,.14)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>Ja, bezahlt</button>
                              <button onClick={e => { e.stopPropagation(); setConfirmPayId(null) }} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Abbrechen</button>
                            </>
                          ) : <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); markPaid(r.id) }} style={{ fontSize: 11, padding: '4px 9px', color: '#4ddb7e' }}>Bezahlt</button>
                        )}
                        {r.status === 'offen' && <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); changeStatus(r.id, 'geprüft') }} style={{ fontSize: 11, padding: '4px 9px' }}>Prüfen</button>}
                        <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); remove(r.id) }} style={{ fontSize: 11, padding: '4px 9px', color: '#ff8080' }}>Löschen</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 10, color: '#aeb9c8', fontSize: 12 }}>{filtered.length} von {rechnungen.length} Eingangsrechnungen</div>
    </div>
  )
}

// ── Dokumente-Tab ───────────────────────────────────────────────────────────

function DokumenteTab({ isDemo }: { isDemo: boolean }) {
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState<string>('Alle')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [uploading, setUploading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewDoc, setPreviewDoc] = useState<Dokument | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) return
    getBueroDokumente()
      .then(data => setDokumente(data as Dokument[]))
      .catch(() => showToast('Fehler beim Laden der Dokumente', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const filtered = dokumente.filter(d =>
    (filterKat === 'Alle' || d.kategorie === filterKat) &&
    (
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.bezug.toLowerCase().includes(search.toLowerCase()) ||
      d.kategorie.toLowerCase().includes(search.toLowerCase()) ||
      getDocumentRelationLabel(d).toLowerCase().includes(search.toLowerCase())
    )
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const groesseKB = file.size < 1024 * 1024
      ? `${Math.round(file.size / 1024)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    const ext = file.name.split('.').pop()?.toUpperCase() ?? 'PDF'

    const newDoc: Dokument = {
      id: genId('DOK'),
      name: file.name,
      typ: ext,
      groesse: groesseKB,
      datum: fmt(new Date()),
      kategorie: 'Sonstiges',
      bezug: '—',
    }

    if (isDemo) {
      setTimeout(() => {
        setDokumente(prev => [newDoc, ...prev])
        setUploading(false)
        showToast(`✅ "${file.name}" erfolgreich hochgeladen und archiviert`)
      }, 900)
    } else {
      try {
        const { data: auth } = await createSupabaseClient().auth.getUser()
        const userId = auth.user?.id
        if (!userId) throw new Error('Kein Benutzer für den Dokumenten-Upload gefunden.')

        const storagePath = await uploadDokument(file, userId)
        await insertBueroDokument({ ...newDoc, storage_path: storagePath })
        const data = await getBueroDokumente()
        setDokumente(data as Dokument[])
        showToast(`✅ "${file.name}" erfolgreich hochgeladen und archiviert`)
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Fehler beim Hochladen', true)
      }
      finally { setUploading(false) }
    }

    // Input zurücksetzen für erneuten Upload derselben Datei
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try { await deleteBueroDokument(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setDokumente(prev => prev.filter(d => d.id !== id))
    showToast(`🗑️ Dokument wurde gelöscht`)
  }

  const openDocument = async (doc: Dokument) => {
    if (isDemo) {
      showToast(`Demo: Für „${doc.name}" ist keine echte Datei hinterlegt.`, true)
      return
    }

    setPreviewDoc(doc)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewUrl('')

    try {
      setPreviewUrl(await resolveDocumentViewUrl(doc))
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Dokument konnte nicht geöffnet werden.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const kategorieIcon: Record<string, string> = { Angebot: '📋', Rechnung: '💶', Vertrag: '📝', Sonstiges: '📄' }
  const kategorieBadge: Record<string, string> = { Angebot: 'badge-blue', Rechnung: 'badge-orange', Vertrag: 'badge-green', Sonstiges: 'badge-gray' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Dokumente…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          url={previewUrl}
          loading={previewLoading}
          error={previewError}
          onClose={() => {
            setPreviewDoc(null)
            setPreviewUrl('')
            setPreviewError(null)
          }}
          onRetry={() => openDocument(previewDoc)}
          onOpenExternal={previewUrl ? () => window.open(previewUrl, '_blank', 'noopener,noreferrer') : undefined}
        />
      )}

      {/* Upload-Bereich */}
      <div className="pk-card fade-in" style={{ marginBottom: 16, border: '1px dashed rgba(32,200,255,.25)', background: 'rgba(32,200,255,.04)', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
        <span style={{ fontSize: 24 }}>📁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Dokument hochladen</div>
          <div style={{ fontSize: 12, color: '#aeb9c8' }}>PDF, JPG, PNG oder DOCX · Wird im Archiv gespeichert</div>
        </div>
        {/* Verstecktes File-Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="pk-btn"
          style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '⏳ Wird hochgeladen…' : '📤 Datei auswählen'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="pk-input" placeholder="🔍 Suchen nach Name, Bezug, Kategorie…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Angebot', 'Rechnung', 'Vertrag', 'Sonstiges'] as const).map(k => (
            <button key={k} onClick={() => setFilterKat(k)} style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterKat === k ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterKat === k ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{k}</button>
          ))}
        </div>
      </div>

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Dateiname</th>
              <th>Kategorie</th>
              <th>Bezug</th>
              <th>Verknüpfung</th>
              <th>Größe</th>
              <th>Datum</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id}>
                <td>
                  <button
                    onClick={() => openDocument(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                    title="Dokument öffnen"
                  >
                    <span style={{ fontSize: 18 }}>{kategorieIcon[d.kategorie]}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, textDecoration: 'underline' }}>{d.name}</span>
                  </button>
                </td>
                <td><span className={`badge ${kategorieBadge[d.kategorie]}`}>{d.kategorie}</span></td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.bezug}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{getDocumentRelationLabel(d)}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.groesse}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.datum}</td>
                <td>
                  {deleteId === d.id ? (
                    <DeleteConfirm label={d.name} onConfirm={() => handleDelete(d.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openDocument(d)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}
                        title="Dokument öffnen"
                      >
                        👁 Öffnen
                      </button>
                      <button onClick={() => setDeleteId(d.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#aeb9c8', fontSize: 13, padding: '24px 0' }}>
                  Keine Dokumente gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {dokumente.length} Dokumenten</div>

      <div className="pk-card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>🧠</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>KI-gestützte Dokumentenanalyse</div>
          <div style={{ fontSize: 12, color: '#aeb9c8' }}>Dokumente automatisch erkennen, klassifizieren und Daten extrahieren lassen</div>
        </div>
        <button className="pk-btn-ghost" onClick={() => window.location.href = '/dashboard/ki-erkennung'} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          🧠 KI-Assistent öffnen
        </button>
      </div>
    </div>
  )
}

// ── Pipeline-Kanban-View ─────────────────────────────────────────────────────

function PipelineKanbanTab({ angebote, auftraege, rechnungen, setTab }: {
  angebote: Angebot[]; auftraege: Auftrag[]; rechnungen: Rechnung[]
  setTab: React.Dispatch<React.SetStateAction<Tab>>
}) {
  const cols: { id: string; label: string; color: string; accent: string }[] = [
    { id: 'angebot', label: 'Angebot', color: 'rgba(99,102,241,.15)', accent: '#818cf8' },
    { id: 'auftrag', label: 'Auftrag', color: 'rgba(59,130,246,.15)', accent: '#20c8ff' },
    { id: 'in_bearbeitung', label: 'In Bearbeitung', color: 'rgba(245,158,11,.12)', accent: '#f59e0b' },
    { id: 'rechnung', label: 'Rechnung', color: 'rgba(16,185,129,.12)', accent: '#10b981' },
    { id: 'bezahlt', label: 'Bezahlt', color: 'rgba(107,114,128,.12)', accent: '#6b7280' },
  ]

  const angeboteOffen = angebote.filter(a => ['Erstellt', 'Versendet'].includes(a.status))
  const auftraegeNeu = auftraege.filter(a => ['AB erforderlich', 'AB erstellt', 'AB versendet', 'Geplant'].includes(a.status))
  const auftraegeAktiv = auftraege.filter(a => ['In Bearbeitung'].includes(a.status))
  const rechnungenOffen = rechnungen.filter(r => ['Erstellt', 'Offen', 'Mahnung', 'Überfällig'].includes(r.status))
  const rechnungenBezahlt = rechnungen.filter(r => r.status === 'Bezahlt')

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
    transition: 'background .15s',
  }

  function fmt(betrag: string) {
    const n = parseFloat(betrag?.replace(',', '.') ?? '0')
    return isNaN(n) ? betrag : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  }

  const colItems = [angeboteOffen, auftraegeNeu, auftraegeAktiv, rechnungenOffen, rechnungenBezahlt]
  const colSums = [
    angeboteOffen.reduce((s, a) => s + parseFloat(a.betrag?.replace(',', '.') ?? '0'), 0),
    auftraegeNeu.reduce((s, a) => s + parseFloat(a.wert?.replace(',', '.') ?? '0'), 0),
    auftraegeAktiv.reduce((s, a) => s + parseFloat(a.wert?.replace(',', '.') ?? '0'), 0),
    rechnungenOffen.reduce((s, r) => s + parseFloat(r.betrag?.replace(',', '.') ?? '0'), 0),
    rechnungenBezahlt.reduce((s, r) => s + parseFloat(r.betrag?.replace(',', '.') ?? '0'), 0),
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔀 Sales Pipeline</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#aeb9c8' }}>Übersicht aller offenen Deals vom Angebot bis zur Bezahlung</p>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {cols.map((col, ci) => (
          <div key={col.id} style={{ minWidth: 220, maxWidth: 260, flex: '0 0 220px', background: col.color, borderRadius: 12, padding: 12, border: `1px solid ${col.accent}30` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{col.label}</span>
              <span style={{ fontSize: 11, background: `${col.accent}22`, color: col.accent, borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
                {colItems[ci].length}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 10, fontWeight: 600 }}>
              Σ {colSums[ci].toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </div>
            {colItems[ci].length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#4a5568', fontSize: 12 }}>Keine Einträge</div>
            )}
            {colItems[ci].map((item: Angebot | Auftrag | Rechnung) => {
              const isAngebot = ci === 0
              const isRechnung = ci >= 3
              const titel = isAngebot ? (item as Angebot).titel : isRechnung ? (item as Rechnung).kunde : (item as Auftrag).beschreibung
              const kunde = isAngebot ? (item as Angebot).kunde : isRechnung ? '' : (item as Auftrag).kunde
              const betrag = isAngebot ? (item as Angebot).betrag : isRechnung ? (item as Rechnung).betrag : (item as Auftrag).wert
              const status = (item as Angebot | Auftrag | Rechnung).status
              const targetTab: Tab = isAngebot ? 'angebote' : isRechnung ? 'rechnungen' : 'auftraege'
              return (
                <div key={item.id} style={cardStyle} onClick={() => setTab(targetTab)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)') }
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)') }
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fbff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel || '—'}</div>
                  {kunde && <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>{kunde}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.accent }}>{fmt(betrag)}</span>
                    <span style={{ fontSize: 10, background: 'rgba(255,255,255,.08)', borderRadius: 4, padding: '2px 6px', color: '#aeb9c8' }}>{status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Einkauf / Lieferanten-Tab ───────────────────────────────────────────────

type EinkaufSubTab = 'lieferanten' | 'bestellungen' | 'wareneingaenge'

function AlertsTab({ kunden, rechnungen, auftraege }: { kunden: Kunde[]; rechnungen: Rechnung[]; auftraege: Auftrag[] }) {
  function parseDE(s?: string): Date | null {
    if (!s) return null
    const p = s.split('.')
    if (p.length !== 3) return null
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  }
  const now = Date.now()
  const day = 86400000

  // Überfällige + Mahnung
  const ueberfaellig = rechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung')
    .map(r => {
      const d = parseDE(r.faellig)
      const tage = d ? Math.floor((now - d.getTime()) / day) : 0
      return { ...r, tageUeberfaellig: tage }
    })
    .sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig)

  // Bald fällig (offen, in 14 Tagen)
  const baldFaellig = rechnungen.filter(r => r.status === 'Offen' || r.status === 'Erstellt')
    .map(r => {
      const d = parseDE(r.faellig)
      const tage = d ? Math.floor((d.getTime() - now) / day) : 999
      return { ...r, tageBisFaellig: tage }
    })
    .filter(r => r.tageBisFaellig >= 0 && r.tageBisFaellig <= 14)
    .sort((a, b) => a.tageBisFaellig - b.tageBisFaellig)

  // Inaktive Kunden (kein Auftrag + keine Rechnung in letzten 90 Tagen)
  const inaktiveKunden = kunden.filter(k => {
    if (k.status === 'Inaktiv') return true
    const alleAuftraege = auftraege.filter(a => a.kunde === k.name || a.kunde_id === k.id)
    const alleRechnungen = rechnungen.filter(r => r.kunde === k.name || r.kunde_id === k.id)
    const letzteAktivitaet = [...alleAuftraege.map(a => parseDE(a.start)), ...alleRechnungen.map(r => parseDE(r.erstellt))]
      .filter(Boolean)
      .map(d => d!.getTime())
    if (letzteAktivitaet.length === 0) return true
    return (now - Math.max(...letzteAktivitaet)) > 90 * day
  }).slice(0, 10)

  const rowStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Überfällig */}
      <div className="pk-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#ff6060', fontWeight: 800 }}>🔴 Überfällig / Mahnung ({ueberfaellig.length})</span>
        </div>
        {ueberfaellig.length === 0 ? (
          <div style={{ padding: '20px 16px', color: '#aeb9c8', fontSize: 13 }}>Keine überfälligen Rechnungen ✅</div>
        ) : ueberfaellig.map(r => (
          <div key={r.id} style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.kunde}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12 }}>{r.nummer || r.id} · Fällig: {r.faellig} · {r.tageUeberfaellig > 0 ? `${r.tageUeberfaellig} Tage überfällig` : 'heute fällig'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 900, color: '#ff6060' }}>{r.betrag}</span>
              <StatusBadgeRechnung status={r.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Bald fällig */}
      <div className="pk-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ color: '#f59e0b', fontWeight: 800 }}>⚠️ Fällig in ≤ 14 Tagen ({baldFaellig.length})</span>
        </div>
        {baldFaellig.length === 0 ? (
          <div style={{ padding: '20px 16px', color: '#aeb9c8', fontSize: 13 }}>Keine dringenden Fälligkeiten</div>
        ) : baldFaellig.map(r => (
          <div key={r.id} style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.kunde}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12 }}>{r.nummer || r.id} · Fällig: {r.faellig} · in {r.tageBisFaellig} Tag{r.tageBisFaellig !== 1 ? 'en' : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 900, color: '#f59e0b' }}>{r.betrag}</span>
              <StatusBadgeRechnung status={r.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Inaktive Kunden */}
      <div className="pk-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ color: '#aeb9c8', fontWeight: 800 }}>💤 Inaktive Kunden &gt;90 Tage ({inaktiveKunden.length})</span>
        </div>
        {inaktiveKunden.length === 0 ? (
          <div style={{ padding: '20px 16px', color: '#aeb9c8', fontSize: 13 }}>Alle Kunden aktiv</div>
        ) : inaktiveKunden.map(k => (
          <div key={k.id} style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{k.typ === 'Firma' ? '🏢' : '👤'} {k.name}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12 }}>{k.id} · {k.ort} · {k.ansprechpartner}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ color: '#aeb9c8', fontSize: 13 }}>{k.umsatz}</span>
              <span className={`badge ${k.status === 'Aktiv' ? 'badge-gray' : 'badge-red'}`}>{k.status === 'Aktiv' ? 'Keine Aktivität' : 'Inaktiv'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EinkaufTab({ isDemo }: { isDemo: boolean }) {
  const [subTab, setSubTab] = useState<EinkaufSubTab>('lieferanten')
  const [lieferanten, setLieferanten] = useState<Lieferant[]>(isDemo ? demoLieferanten : [])
  const [bestellungen, setBestellungen] = useState<EinkaufsBestellung[]>(isDemo ? demoEinkaufsBestellungen : [])
  const [wareneingaenge, setWareneingaenge] = useState<Wareneingang[]>(isDemo ? demoWareneingaenge : [])
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editLieferant, setEditLieferant] = useState<Lieferant | null>(null)
  const [selectedBestellung, setSelectedBestellung] = useState<EinkaufsBestellung | null>(null)
  const [loading, setLoading] = useState(!isDemo)

  // Lieferant-Formular
  const [lfForm, setLfForm] = useState({ name: '', kontakt: '', email: '', telefon: '', ort: '', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto' })
  // Bestellung-Formular
  const [bsForm, setBsForm] = useState({ lieferant: '', artikel: '', menge: '', einheit: 'Stk', einkaufspreis: '', erwartet_am: '', notiz: '' })
  // Wareneingang-Formular
  const [weForm, setWeForm] = useState({ bestellung_id: '', lieferant: '', artikel: '', menge: '', einheit: 'Stk', qualitaet: 'OK' as Wareneingang['qualitaet'], mitarbeiter: '' })

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }
  const heute = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  useEffect(() => {
    if (isDemo) return
    Promise.all([getEinkaufLieferanten(), getEinkaufBestellungen(), getEinkaufWareneingaenge()])
      .then(([l, b, w]) => {
        setLieferanten(l as Lieferant[])
        setBestellungen(b as EinkaufsBestellung[])
        setWareneingaenge(w as Wareneingang[])
      })
      .catch(() => showToast('Einkaufsdaten konnten nicht geladen werden', true))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  // ── Lieferanten CRUD ──────────────────────────────────────────────────────

  const handleLieferantSave = async () => {
    if (!lfForm.name || !lfForm.email) return
    if (editLieferant) {
      const updated: Lieferant = { ...editLieferant, ...lfForm, bewertung: editLieferant.bewertung }
      if (!isDemo) {
        try { await upsertEinkaufLieferant(updated) } catch { showToast('Fehler beim Speichern', true); return }
      }
      setLieferanten(prev => prev.map(l => l.id === editLieferant.id ? updated : l))
      setEditLieferant(null)
      showToast(`✅ Lieferant "${updated.name}" aktualisiert`)
    } else {
      const neu: Lieferant = {
        id: genId('LF'),
        ...lfForm, status: 'Aktiv', bewertung: 4,
      }
      if (!isDemo) {
        try { await upsertEinkaufLieferant(neu) } catch { showToast('Fehler beim Speichern', true); return }
      }
      setLieferanten(prev => [neu, ...prev])
      showToast(`✅ Lieferant "${neu.name}" wurde angelegt`)
    }
    setLfForm({ name: '', kontakt: '', email: '', telefon: '', ort: '', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto' })
    setShowForm(false)
  }

  const openEditLieferant = (l: Lieferant) => {
    setEditLieferant(l)
    setLfForm({ name: l.name, kontakt: l.kontakt, email: l.email, telefon: l.telefon, ort: l.ort, kategorie: l.kategorie, zahlungsziel: l.zahlungsziel })
    setShowForm(true)
    setSubTab('lieferanten')
  }

  // ── Bestellung anlegen ─────────────────────────────────────────────────────

  const handleBestellungSave = async () => {
    if (!bsForm.lieferant || !bsForm.artikel || !bsForm.menge || !bsForm.einkaufspreis) return
    const menge = parseFloat(bsForm.menge) || 0
    const ep = parseFloat(bsForm.einkaufspreis.replace(',', '.')) || 0
    const gesamt = (menge * ep).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'
    const lieferant = lieferanten.find(l => l.name === bsForm.lieferant)
    const neu: EinkaufsBestellung = {
      id: genId('EB'),
      lieferant_id: lieferant?.id,
      lieferant: bsForm.lieferant, artikel: bsForm.artikel, menge, einheit: bsForm.einheit,
      einkaufspreis: bsForm.einkaufspreis.includes('€') ? bsForm.einkaufspreis : `${bsForm.einkaufspreis} €`,
      gesamt, status: 'Entwurf', bestellt_am: heute(), erwartet_am: bsForm.erwartet_am || '',
      notiz: bsForm.notiz || undefined,
    }
    if (!isDemo) {
      try { await upsertEinkaufBestellung(neu) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setBestellungen(prev => [neu, ...prev])
    setBsForm({ lieferant: '', artikel: '', menge: '', einheit: 'Stk', einkaufspreis: '', erwartet_am: '', notiz: '' })
    setShowForm(false)
    showToast(`✅ Bestellung "${neu.id}" wurde als Entwurf gespeichert`)
  }

  const handleBestellungAusloesen = async (id: string) => {
    const bestellung = bestellungen.find(b => b.id === id)
    if (!isDemo && bestellung) {
      try { await upsertEinkaufBestellung({ ...bestellung, status: 'Bestellt' }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setBestellungen(prev => prev.map(b => b.id === id ? { ...b, status: 'Bestellt' } : b))
    showToast(`📤 Bestellung ${id} wurde ausgelöst`)
  }

  const handleBestellungGeliefert = async (id: string) => {
    const bestellung = bestellungen.find(b => b.id === id)
    if (!isDemo && bestellung) {
      try { await upsertEinkaufBestellung({ ...bestellung, status: 'Geliefert', geliefert_am: heute() }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setBestellungen(prev => prev.map(b => b.id === id ? { ...b, status: 'Geliefert', geliefert_am: heute() } : b))
    showToast(`✅ Bestellung ${id} als geliefert markiert`)
  }

  // ── Wareneingang buchen ───────────────────────────────────────────────────

  const handleWareneingangSave = async () => {
    if (!weForm.bestellung_id || !weForm.artikel || !weForm.menge) return
    const bestellung = bestellungen.find(b => b.id === weForm.bestellung_id)
    const neu: Wareneingang = {
      id: `WE-${String(wareneingaenge.length + 4).padStart(3, '0')}`,
      bestellung_id: weForm.bestellung_id,
      lieferant: bestellung?.lieferant || weForm.lieferant,
      artikel: weForm.artikel, menge: parseFloat(weForm.menge) || 0,
      einheit: weForm.einheit, datum: heute(),
      qualitaet: weForm.qualitaet, mitarbeiter: weForm.mitarbeiter || '—',
    }
    if (!isDemo) {
      try { await insertEinkaufWareneingang(neu) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setWareneingaenge(prev => [neu, ...prev])
    if (bestellung && bestellung.menge === neu.menge) {
      setBestellungen(prev => prev.map(b => b.id === neu.bestellung_id ? { ...b, status: 'Geliefert', geliefert_am: heute() } : b))
    } else if (bestellung) {
      setBestellungen(prev => prev.map(b => b.id === neu.bestellung_id ? { ...b, status: 'Teillieferung' } : b))
    }
    setWeForm({ bestellung_id: '', lieferant: '', artikel: '', menge: '', einheit: 'Stk', qualitaet: 'OK', mitarbeiter: '' })
    setShowForm(false)
    showToast(`✅ Wareneingang "${neu.id}" gebucht – ${neu.menge} ${neu.einheit} "${neu.artikel}"`)
  }

  const handleLieferantDelete = async (id: string) => {
    if (!isDemo) {
      try { await deleteEinkaufLieferant(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setLieferanten(prev => prev.filter(l => l.id !== id))
    setDeleteId(null)
    showToast('🗑️ Lieferant gelöscht')
  }

  // KPIs
  const gesamtBestellwert = bestellungen.reduce((s, b) => {
    const n = parseFloat(b.gesamt.replace(/[^\d,]/g, '').replace(',', '.')) || 0
    return s + n
  }, 0)
  const offeneBs = bestellungen.filter(b => b.status === 'Entwurf' || b.status === 'Bestellt').length
  const aktLieferanten = lieferanten.filter(l => l.status === 'Aktiv').length

  const bsStatusColor: Record<string, string> = {
    Entwurf: 'badge-gray', Bestellt: 'badge-blue', Teillieferung: 'badge-orange', Geliefert: 'badge-green', Storniert: 'badge-red',
  }
  const weQualColor: Record<string, string> = { OK: 'badge-green', Mängel: 'badge-orange', Abgelehnt: 'badge-red' }
  const KATEGORIEN_LF = ['Rohstoffe', 'Kleinteile', 'Betriebsstoffe', 'Verbrauchsmaterial', 'Werkzeug', 'Schutzausrüstung', 'Büromaterial', 'Sonstiges']
  const EINHEITEN_LF = ['Stk', 'Liter', 'kg', 'Meter', 'Rollen', 'Paar', 'Karton', 'Palette']

  if (loading) return <div className="pk-card" style={{ color: '#aeb9c8' }}>Lade Einkaufsdaten…</div>

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* KPI-Zeile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Aktive Lieferanten', value: String(aktLieferanten), icon: '🏭', color: '#20c8ff' },
          { label: 'Offene Bestellungen', value: String(offeneBs), icon: '🛒', color: '#f59e0b' },
          { label: 'Wareneingänge', value: String(wareneingaenge.length), icon: '📥', color: '#10b981' },
          { label: 'Ges. Bestellwert', value: gesamtBestellwert.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €', icon: '💶', color: '#1684ff' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', overflowX: 'auto' }}>
        {([
          { id: 'lieferanten', label: '🏭 Lieferanten' },
          { id: 'bestellungen', label: `🛒 Bestellungen${offeneBs > 0 ? ` (${offeneBs})` : ''}` },
          { id: 'wareneingaenge', label: '📥 Wareneingänge' },
        ] as { id: EinkaufSubTab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id); setShowForm(false) }} style={{
            padding: '9px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', borderBottom: subTab === t.id ? '2px solid #20c8ff' : '2px solid transparent',
            color: subTab === t.id ? '#20c8ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── LIEFERANTEN ── */}
      {subTab === 'lieferanten' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="pk-btn" onClick={() => { setEditLieferant(null); setLfForm({ name: '', kontakt: '', email: '', telefon: '', ort: '', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto' }); setShowForm(f => !f) }} style={{ fontSize: 13 }}>
              {showForm && !editLieferant ? '✕ Abbrechen' : '+ Neuer Lieferant'}
            </button>
          </div>

          {showForm && (
            <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>
                {editLieferant ? `✏️ Lieferant bearbeiten: ${editLieferant.name}` : '🏭 Neuen Lieferanten anlegen'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Name *</label><input className="pk-input" placeholder="Firmenname" value={lfForm.name} onChange={e => setLfForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label style={labelStyle}>Ansprechpartner</label><input className="pk-input" placeholder="Vor- und Nachname" value={lfForm.kontakt} onChange={e => setLfForm(p => ({ ...p, kontakt: e.target.value }))} /></div>
                <div><label style={labelStyle}>E-Mail *</label><input className="pk-input" type="email" placeholder="email@lieferant.de" value={lfForm.email} onChange={e => setLfForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div><label style={labelStyle}>Telefon</label><input className="pk-input" placeholder="040 12345" value={lfForm.telefon} onChange={e => setLfForm(p => ({ ...p, telefon: e.target.value }))} /></div>
                <div><label style={labelStyle}>Ort</label><input className="pk-input" placeholder="Stadt" value={lfForm.ort} onChange={e => setLfForm(p => ({ ...p, ort: e.target.value }))} /></div>
                <div><label style={labelStyle}>Kategorie</label>
                  <select className="pk-input" value={lfForm.kategorie} onChange={e => setLfForm(p => ({ ...p, kategorie: e.target.value }))}>
                    {KATEGORIEN_LF.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Zahlungsziel</label>
                  <select className="pk-input" value={lfForm.zahlungsziel} onChange={e => setLfForm(p => ({ ...p, zahlungsziel: e.target.value }))}>
                    {['Sofort', '7 Tage netto', '14 Tage 2% Skonto', '21 Tage netto', '30 Tage netto', '60 Tage netto'].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button className="pk-btn" onClick={handleLieferantSave} style={{ fontWeight: 700 }}>
                  {editLieferant ? 'Speichern' : 'Lieferanten anlegen'}
                </button>
                <button className="pk-btn-ghost" onClick={() => { setShowForm(false); setEditLieferant(null) }} style={{ fontSize: 13 }}>Abbrechen</button>
              </div>
            </div>
          )}

          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Kategorie</th><th>Ansprechpartner</th><th>E-Mail</th><th>Ort</th><th>Zahlungsziel</th><th>Bewertung</th><th>Status</th><th>Aktionen</th></tr>
                </thead>
                <tbody>
                  {lieferanten.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>🏭 Noch keine Lieferanten angelegt.</td></tr>
                  ) : lieferanten.map(l => (
                    <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => openEditLieferant(l)}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{l.id}</td>
                      <td style={{ fontWeight: 700 }}>{l.name}</td>
                      <td><span className="badge badge-gray">{l.kategorie}</span></td>
                      <td style={{ color: '#d0d9e8' }}>{l.kontakt}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 12 }}>{l.email}</td>
                      <td style={{ color: '#aeb9c8' }}>{l.ort}</td>
                      <td style={{ fontSize: 12, color: '#aeb9c8' }}>{l.zahlungsziel}</td>
                      <td style={{ color: '#f59e0b' }}>{'★'.repeat(l.bewertung)}{'☆'.repeat(5 - l.bewertung)}</td>
                      <td><span className={`badge ${l.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{l.status}</span></td>
                      <td>
                        {deleteId === l.id ? (
                          <DeleteConfirm label={l.name} onConfirm={() => handleLieferantDelete(l.id)} onCancel={() => setDeleteId(null)} />
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); openEditLieferant(l) }} style={{ background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6cb6ff', fontSize: 13 }}>✏️</button>
                            <button onClick={e => { e.stopPropagation(); setBsForm(p => ({ ...p, lieferant: l.name })); setSubTab('bestellungen'); setShowForm(true) }} title="Bestellung anlegen" style={{ background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#4ddb7e', fontSize: 13 }}>🛒</button>
                            <button onClick={e => { e.stopPropagation(); setDeleteId(l.id) }} style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 13 }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BESTELLUNGEN ── */}
      {subTab === 'bestellungen' && (
        <div>
          {selectedBestellung && (
            <Modal title={`🛒 Bestellung ${selectedBestellung.id}`} onClose={() => setSelectedBestellung(null)}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Lieferant</label><div className="pk-input">{selectedBestellung.lieferant}</div></div>
                <div><label style={labelStyle}>Artikel</label><div className="pk-input">{selectedBestellung.artikel}</div></div>
                <div><label style={labelStyle}>Menge</label><div className="pk-input">{selectedBestellung.menge} {selectedBestellung.einheit}</div></div>
                <div><label style={labelStyle}>Status</label><div className="pk-input">{selectedBestellung.status}</div></div>
                <div><label style={labelStyle}>EK-Preis</label><div className="pk-input">{selectedBestellung.einkaufspreis}</div></div>
                <div><label style={labelStyle}>Gesamt</label><div className="pk-input">{selectedBestellung.gesamt}</div></div>
                <div><label style={labelStyle}>Bestellt am</label><div className="pk-input">{selectedBestellung.bestellt_am}</div></div>
                <div><label style={labelStyle}>Erwartet</label><div className="pk-input">{selectedBestellung.erwartet_am || '—'}</div></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notiz</label><div className="pk-input">{selectedBestellung.notiz || '—'}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                {selectedBestellung.status === 'Entwurf' && <button className="pk-btn" onClick={() => { handleBestellungAusloesen(selectedBestellung.id); setSelectedBestellung(null) }}>Auslösen</button>}
                {(selectedBestellung.status === 'Bestellt' || selectedBestellung.status === 'Teillieferung') && <button className="pk-btn" onClick={() => { setWeForm(p => ({ ...p, bestellung_id: selectedBestellung.id, lieferant: selectedBestellung.lieferant, artikel: selectedBestellung.artikel, menge: String(selectedBestellung.menge), einheit: selectedBestellung.einheit })); setSelectedBestellung(null); setSubTab('wareneingaenge'); setShowForm(true) }}>Wareneingang öffnen</button>}
                {selectedBestellung.status === 'Bestellt' && <button className="pk-btn-ghost" onClick={() => { handleBestellungGeliefert(selectedBestellung.id); setSelectedBestellung(null) }}>Als geliefert markieren</button>}
              </div>
            </Modal>
          )}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="pk-btn" onClick={() => setShowForm(f => !f)} style={{ fontSize: 13 }}>
              {showForm ? '✕ Abbrechen' : '+ Neue Bestellung'}
            </button>
            <span style={{ fontSize: 12, color: '#aeb9c8' }}>{bestellungen.length} Bestellungen gesamt</span>
          </div>

          {showForm && (
            <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🛒 Neue Einkaufsbestellung</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Lieferant *</label>
                  <select className="pk-input" value={bsForm.lieferant} onChange={e => setBsForm(p => ({ ...p, lieferant: e.target.value }))}>
                    <option value="">Lieferant wählen…</option>
                    {lieferanten.filter(l => l.status === 'Aktiv').map(l => <option key={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Artikel *</label><input className="pk-input" placeholder="z.B. Stahlrohr 40x40" value={bsForm.artikel} onChange={e => setBsForm(p => ({ ...p, artikel: e.target.value }))} /></div>
                <div><label style={labelStyle}>Menge *</label><input className="pk-input" type="number" min="1" placeholder="100" value={bsForm.menge} onChange={e => setBsForm(p => ({ ...p, menge: e.target.value }))} /></div>
                <div><label style={labelStyle}>Einheit</label>
                  <select className="pk-input" value={bsForm.einheit} onChange={e => setBsForm(p => ({ ...p, einheit: e.target.value }))}>
                    {EINHEITEN_LF.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>EK-Preis / Einheit *</label><input className="pk-input" placeholder="z.B. 8,50" value={bsForm.einkaufspreis} onChange={e => setBsForm(p => ({ ...p, einkaufspreis: e.target.value }))} /></div>
                <div><label style={labelStyle}>Erwartet am</label><input className="pk-input" placeholder="TT.MM.JJJJ" value={bsForm.erwartet_am} onChange={e => setBsForm(p => ({ ...p, erwartet_am: e.target.value }))} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notiz</label><input className="pk-input" placeholder="Optionale Hinweise…" value={bsForm.notiz} onChange={e => setBsForm(p => ({ ...p, notiz: e.target.value }))} /></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="pk-btn" onClick={handleBestellungSave} style={{ fontWeight: 700 }}>Als Entwurf speichern</button>
              </div>
            </div>
          )}

          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>Best.-Nr.</th><th>Lieferant</th><th>Artikel</th><th>Menge</th><th>EK-Preis</th><th>Gesamt</th><th>Bestellt am</th><th>Erwartet</th><th>Status</th><th>Aktionen</th></tr>
                </thead>
                <tbody>
                  {bestellungen.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>🛒 Noch keine Bestellungen.</td></tr>
                  ) : bestellungen.map(b => (
                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedBestellung(b)}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{b.id}</td>
                      <td style={{ fontWeight: 600 }}>{b.lieferant}</td>
                      <td style={{ color: '#d0d9e8' }}>{b.artikel}</td>
                      <td style={{ fontWeight: 700 }}>{b.menge} {b.einheit}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.einkaufspreis}</td>
                      <td style={{ fontWeight: 700, color: '#20c8ff' }}>{b.gesamt}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.bestellt_am}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.erwartet_am || '—'}</td>
                      <td><span className={`badge ${bsStatusColor[b.status] || 'badge-gray'}`}>{b.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {b.status === 'Entwurf' && (
                            <button onClick={e => { e.stopPropagation(); handleBestellungAusloesen(b.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'rgba(22,132,255,.08)', color: '#6cb6ff', cursor: 'pointer', fontWeight: 700 }}>📤 Auslösen</button>
                          )}
                          {(b.status === 'Bestellt' || b.status === 'Teillieferung') && (
                            <button onClick={e => { e.stopPropagation(); setWeForm(p => ({ ...p, bestellung_id: b.id, lieferant: b.lieferant, artikel: b.artikel, menge: String(b.menge), einheit: b.einheit })); setSubTab('wareneingaenge'); setShowForm(true) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'rgba(37,211,102,.08)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>📥 WE buchen</button>
                          )}
                          {b.status === 'Bestellt' && (
                            <button onClick={e => { e.stopPropagation(); handleBestellungGeliefert(b.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(16,185,129,.3)', background: 'transparent', color: '#34d399', cursor: 'pointer' }}>✅ Geliefert</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── WARENEINGÄNGE ── */}
      {subTab === 'wareneingaenge' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="pk-btn" onClick={() => setShowForm(f => !f)} style={{ fontSize: 13 }}>
              {showForm ? '✕ Abbrechen' : '+ Wareneingang buchen'}
            </button>
            <span style={{ fontSize: 12, color: '#aeb9c8' }}>{wareneingaenge.length} Wareneingänge</span>
          </div>

          {showForm && (
            <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📥 Wareneingang buchen</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Bestellung *</label>
                  <select className="pk-input" value={weForm.bestellung_id} onChange={e => {
                    const b = bestellungen.find(x => x.id === e.target.value)
                    setWeForm(p => ({ ...p, bestellung_id: e.target.value, lieferant: b?.lieferant || '', artikel: b?.artikel || '', menge: String(b?.menge || ''), einheit: b?.einheit || 'Stk' }))
                  }}>
                    <option value="">Bestellung wählen…</option>
                    {bestellungen.filter(b => b.status !== 'Geliefert' && b.status !== 'Storniert').map(b => (
                      <option key={b.id} value={b.id}>{b.id} – {b.artikel} ({b.lieferant})</option>
                    ))}
                  </select>
                </div>
                <div><label style={labelStyle}>Artikel</label><input className="pk-input" value={weForm.artikel} onChange={e => setWeForm(p => ({ ...p, artikel: e.target.value }))} placeholder="Artikelname" /></div>
                <div><label style={labelStyle}>Gelieferte Menge *</label><input className="pk-input" type="number" min="1" value={weForm.menge} onChange={e => setWeForm(p => ({ ...p, menge: e.target.value }))} /></div>
                <div><label style={labelStyle}>Einheit</label>
                  <select className="pk-input" value={weForm.einheit} onChange={e => setWeForm(p => ({ ...p, einheit: e.target.value }))}>
                    {EINHEITEN_LF.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Qualität</label>
                  <select className="pk-input" value={weForm.qualitaet} onChange={e => setWeForm(p => ({ ...p, qualitaet: e.target.value as Wareneingang['qualitaet'] }))}>
                    <option>OK</option><option>Mängel</option><option>Abgelehnt</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Mitarbeiter</label><input className="pk-input" placeholder="Name" value={weForm.mitarbeiter} onChange={e => setWeForm(p => ({ ...p, mitarbeiter: e.target.value }))} /></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="pk-btn" onClick={handleWareneingangSave} style={{ fontWeight: 700 }}>📥 Wareneingang buchen</button>
              </div>
            </div>
          )}

          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>WE-Nr.</th><th>Bestellung</th><th>Lieferant</th><th>Artikel</th><th>Menge</th><th>Datum</th><th>Qualität</th><th>Mitarbeiter</th></tr>
                </thead>
                <tbody>
                  {wareneingaenge.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>📥 Noch keine Wareneingänge.</td></tr>
                  ) : wareneingaenge.map(w => (
                    <tr key={w.id}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{w.id}</td>
                      <td style={{ color: '#6cb6ff', fontFamily: 'monospace', fontSize: 12 }}>{w.bestellung_id}</td>
                      <td style={{ fontWeight: 600 }}>{w.lieferant}</td>
                      <td style={{ color: '#d0d9e8' }}>{w.artikel}</td>
                      <td style={{ fontWeight: 700 }}>{w.menge} {w.einheit}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{w.datum}</td>
                      <td><span className={`badge ${weQualColor[w.qualitaet] || 'badge-gray'}`}>{w.qualitaet}</span></td>
                      <td style={{ color: '#aeb9c8' }}>{w.mitarbeiter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Haupt-Seite ─────────────────────────────────────────────────────────────

export default function BueroPilotPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isDemo] = useState(() => hasDemoCookie())
  const { role } = useRole()
  const isOwner = isDemo ? true : role === 'Admin'
  const [tab, setTab] = useState<Tab>('kunden')
  const [kunden, setKunden] = useState<Kunde[]>(isDemo ? demoKunden : [])
  const [angebote, setAngebote] = useState<Angebot[]>(isDemo ? demoAngebote : [])
  const [auftraege, setAuftraege] = useState<Auftrag[]>(isDemo ? demoAuftraege : [])
  const [sharedRechnungen, setSharedRechnungen] = useState<Rechnung[]>(isDemo ? demoRechnungen : [])
  const [sharedMailTarget, setSharedMailTarget] = useState<{ id: string; email: string; typ: 'rechnung' } | null>(null)
  const [loading, setLoading] = useState(!isDemo)
  const [errorMsg, setErrorMsg] = useState('')

  // Shared data laden (Kunden + Angebote + Aufträge + Rechnungen für Cross-Tab-Referenzen)
  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroKunden(), getBueroAngebote(), getBueroAuftraege(), getBueroRechnungen()])
      .then(([k, a, au, r]) => {
        setKunden(k as Kunde[])
        setAngebote(a as Angebot[])
        setAuftraege(au as Auftrag[])
        setSharedRechnungen(r as Rechnung[])
      })
      .catch(() => setErrorMsg('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab && ['kunden', 'angebote', 'auftraege', 'rechnungen', 'eingangsrechnungen', 'dokumente', 'einkauf'].includes(requestedTab)) {
      setTab(requestedTab as Tab)
    }
  }, [searchParams])

  // KPI-Berechnungen für Pipeline-Widget
  const offeneAngebote = angebote.filter(a => a.status === 'Versendet' || a.status === 'Entwurf').length
  const laufendeAuftraege = auftraege.filter(a => a.status === 'In Bearbeitung').length
  const offeneRechnungen = sharedRechnungen.filter(r => r.status !== 'Bezahlt').length

  // MTD/YTD Umsatz aus bezahlten Rechnungen
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()
  function parseDeDate(s?: string): Date | null {
    if (!s) return null
    const p = s.split('.')
    if (p.length !== 3) return null
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  }
  const bezahltRechnungen = sharedRechnungen.filter(r => r.status === 'Bezahlt')
  const umsatzMTD = bezahltRechnungen.reduce((sum, r) => {
    const d = parseDeDate(r.bezahltAm)
    if (!d || d.getMonth() !== curMonth || d.getFullYear() !== curYear) return sum
    return sum + parseBetrag(r.betrag)
  }, 0)
  const umsatzYTD = bezahltRechnungen.reduce((sum, r) => {
    const d = parseDeDate(r.bezahltAm)
    if (!d || d.getFullYear() !== curYear) return sum
    return sum + parseBetrag(r.betrag)
  }, 0)
  const ueberfaelligCount = sharedRechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').length
  function fmtEuro(v: number) { return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade BüroPilot…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(32,200,255,.15)', border: '1px solid rgba(32,200,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🧾</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>BüroPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Kunden · Angebote · Aufträge · Rechnungen · Eingangsrechnungen · Dokumente · Einkauf</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}

      {/* Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Kunden gesamt', value: String(kunden.filter(k => k.status === 'Aktiv').length), icon: '👥', color: '#20c8ff' },
          { label: 'Offene Angebote', value: String(offeneAngebote), icon: '📋', color: '#1684ff' },
          { label: 'Laufende Aufträge', value: String(laufendeAuftraege), icon: '✅', color: '#25d366' },
          { label: 'Offene Rechnungen', value: String(offeneRechnungen), icon: '💶', color: '#f59e0b' },
        ].map(s => (
          <button
            key={s.label}
            className="pk-card"
            onClick={() => {
              if (s.label === 'Kunden gesamt') router.push('/dashboard/buero?tab=kunden')
              if (s.label === 'Offene Angebote') router.push('/dashboard/buero?tab=angebote&filter=Versendet')
              if (s.label === 'Laufende Aufträge') router.push('/dashboard/buero?tab=auftraege')
              if (s.label === 'Offene Rechnungen') router.push('/dashboard/buero?tab=rechnungen&filter=Offen')
            }}
            style={{ textAlign: 'center', padding: '16px 12px', cursor: 'pointer', color: 'inherit' }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Finanzkennzahlen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Umsatz MTD', value: fmtEuro(umsatzMTD), icon: '📅', color: '#20c8ff', tab: 'rechnungen' as Tab },
          { label: 'Umsatz YTD', value: fmtEuro(umsatzYTD), icon: '📆', color: '#25d366', tab: 'rechnungen' as Tab },
          { label: 'Überfällig / Mahnung', value: String(ueberfaelligCount), icon: '⚠️', color: ueberfaelligCount > 0 ? '#f59e0b' : '#aeb9c8', tab: 'alerts' as Tab },
        ].map(s => (
          <button key={s.label} className="pk-card" onClick={() => setTab(s.tab)}
            style={{ textAlign: 'center', padding: '12px 10px', cursor: 'pointer', color: 'inherit' }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'kunden' && <KundenTab isDemo={isDemo} auftraege={auftraege} rechnungen={sharedRechnungen} angebote={angebote} />}
      {tab === 'angebote' && <AngeboteTab isDemo={isDemo} kunden={kunden} auftraege={auftraege} setAuftraege={setAuftraege} initialFilterStatus={searchParams.get('filter') ?? undefined} isOwner={isOwner} setTab={setTab} setRechnungen={setSharedRechnungen} />}
      {tab === 'auftraege' && <AuftraegeTab isDemo={isDemo} auftraege={auftraege} setAuftraege={setAuftraege} kunden={kunden} setTab={setTab} setRechnungen={setSharedRechnungen} setMailTarget={setSharedMailTarget} />}
      {tab === 'rechnungen' && <RechnungenTab isDemo={isDemo} kunden={kunden} initialFilterStatus={searchParams.get('filter') ?? undefined} sharedRechnungen={sharedRechnungen} setSharedRechnungen={setSharedRechnungen} sharedMailTarget={sharedMailTarget} setSharedMailTarget={setSharedMailTarget} />}
      {tab === 'eingangsrechnungen' && <EingangRechnungenTab isDemo={isDemo} initialFilterStatus={searchParams.get('filter') ?? undefined} />}
      {tab === 'dokumente' && <DokumenteTab isDemo={isDemo} />}
      {tab === 'einkauf' && <EinkaufTab isDemo={isDemo} />}
      {tab === 'alerts' && <AlertsTab kunden={kunden} rechnungen={sharedRechnungen} auftraege={auftraege} />}
      {tab === 'pipeline' && <PipelineKanbanTab angebote={angebote} auftraege={auftraege} rechnungen={sharedRechnungen} setTab={setTab} />}
    </div>
  )
}
