'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  umlagerArtikel, getLagerStellplaetze, getLagerStellplatzBestand,
  getBueroDokumentById, getBueroDokumente, getDokumentUrl, insertBueroDokument, updateBueroDokument, uploadDokument,
  upsertBueroEingangsrechnung, upsertBueroRechnung, upsertBueroAngebot,
  insertEinkaufWareneingang, getAiFeatureSettings, type AiFeatureSettings,
  upsertEinkaufBestellung, getEinkaufLieferanten,
} from '@/lib/db'
import { hasDemoCookie } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'
import { normalizeDocumentStoragePath, type StoredDocumentLink } from '@/lib/documents'
import { genId } from '@/lib/ids'
import DocumentPreviewModal from '@/components/DocumentPreviewModal'
import { useGlobalToast } from '@/components/ui/ToastProvider'

// ─── Demo-Daten ───────────────────────────────────────────────────────────────

type DemoAufgabe = {
  id: string
  titel: string
  status: 'Offen' | 'In Arbeit' | 'Erledigt'
  prioritaet: 'Hoch' | 'Mittel' | 'Niedrig'
  projekt: string
}

type DemoKarte = {
  id: string
  titel: string
  status: 'Offen' | 'In Arbeit' | 'Fertig'
  prioritaet: 'Kritisch' | 'Hoch' | 'Normal' | 'Niedrig'
  fahrzeug: string
}

type DemoArtikel = {
  id: string
  name: string
  bestand: number
  mindestbestand: number
  einheit: string
  status: 'ok' | 'niedrig' | 'leer'
  vorschlag: number
}

type DemoRechnung = {
  id: string
  rechnungsnummer: string
  kunde: string
  betrag: number
  status: 'Entwurf' | 'Offen' | 'Bezahlt' | 'Überfällig' | 'Mahnung'
  faelligAm: string
  tageUeberfaellig: number
}

const demoAufgaben: DemoAufgabe[] = [
  { id: 'A1', titel: 'Angebot AN-2025-0042 finalisieren', status: 'Offen', prioritaet: 'Hoch', projekt: 'Büro' },
  { id: 'A2', titel: 'Inventur Q2 durchführen', status: 'In Arbeit', prioritaet: 'Hoch', projekt: 'Lager' },
  { id: 'A3', titel: 'Lieferantenvergleich Stahlrohr', status: 'Offen', prioritaet: 'Mittel', projekt: 'Einkauf' },
]

const demoKarten: DemoKarte[] = [
  { id: 'K1', titel: 'Bremsanlage erneuern – Fahrzeug HH-KP-42', status: 'Offen', prioritaet: 'Kritisch', fahrzeug: 'HH-KP-42' },
  { id: 'K2', titel: 'Ölwechsel – Fahrzeug HH-AB-11', status: 'In Arbeit', prioritaet: 'Hoch', fahrzeug: 'HH-AB-11' },
]

const demoArtikel: DemoArtikel[] = [
  { id: 'L1', name: 'Motoröl 5W-30 (5L)', bestand: 2, mindestbestand: 10, einheit: 'Stk', status: 'niedrig', vorschlag: 20 },
  { id: 'L2', name: 'Bremsflüssigkeit DOT4', bestand: 0, mindestbestand: 5, einheit: 'Fl.', status: 'leer', vorschlag: 10 },
  { id: 'L3', name: 'Luftfilter Universal', bestand: 3, mindestbestand: 8, einheit: 'Stk', status: 'niedrig', vorschlag: 15 },
  { id: 'L4', name: 'Zündkerzen NGK BKR6E', bestand: 0, mindestbestand: 12, einheit: 'Stk', status: 'leer', vorschlag: 24 },
]

const demoRechnungen: DemoRechnung[] = [
  { id: 'R1', rechnungsnummer: 'RE-2025-0089', kunde: 'Müller & Söhne GmbH', betrag: 4850.00, status: 'Überfällig', faelligAm: '2025-04-10', tageUeberfaellig: 27 },
  { id: 'R2', rechnungsnummer: 'RE-2025-0076', kunde: 'Bauer Transporte KG', betrag: 1290.50, status: 'Mahnung', faelligAm: '2025-03-28', tageUeberfaellig: 40 },
]

// ─── Typen ────────────────────────────────────────────────────────────────────

type RecognitionResult = {
  type: string
  confidence: number
  fields: Record<string, string>
  raw: string
}

type DocumentAiResult = {
  documentType: 'rechnung' | 'angebot' | 'auftrag' | 'lieferschein' | 'wareneingang' | 'kunden_dokument' | 'sonstiges'
  confidence: number
  summary: string
  extracted: Record<string, unknown>
  suggestedActions: string[]
}

type DocumentStatus = 'erkannt' | 'geprüft' | 'übernommen' | 'archiviert'
type HandoverTarget = 'eingangsrechnung' | 'rechnung' | 'angebot' | 'lieferschein' | 'wareneingang'

type DocumentWorkflowRecord = {
  id: string
  name: string
  status: DocumentStatus
  documentType: DocumentAiResult['documentType']
  confidence: number
  summary: string
  extracted: Record<string, unknown>
  suggestedActions: string[]
  storagePath?: string
  searchText: string
  createdAt: string
}

type KiAction = {
  type: 'umlagerung' | 'bestellung' | 'hinweis'
  artikel?: string
  von?: string
  nach?: string
  menge?: number
  beschreibung?: string
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; actions?: KiAction[] }

type Tab = 'tagesbrief' | 'dokumente' | 'chat'

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatEuro(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function fieldToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function labelForDocumentType(type: DocumentAiResult['documentType']) {
  const labels: Record<DocumentAiResult['documentType'], string> = {
    rechnung: 'Rechnung',
    angebot: 'Angebot',
    auftrag: 'Auftrag',
    lieferschein: 'Lieferschein',
    wareneingang: 'Wareneingang',
    kunden_dokument: 'Kundendokument',
    sonstiges: 'Sonstiges',
  }
  return labels[type]
}


function parseMoney(value: unknown): number {
  const text = fieldToString(value).replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(text) || 0
}

function buildSearchText(name: string, result: DocumentAiResult, fields: Record<string, string>) {
  return [
    name,
    result.documentType,
    result.summary,
    ...Object.keys(fields),
    ...Object.values(fields),
    ...(result.suggestedActions ?? []),
  ].join(' ').toLowerCase()
}

function toDocRecord(params: {
  id: string
  name: string
  result: DocumentAiResult
  fields: Record<string, string>
  status?: DocumentStatus
  storagePath?: string
  createdAt?: string
}): DocumentWorkflowRecord {
  return {
    id: params.id,
    name: params.name,
    status: params.status ?? 'erkannt',
    documentType: params.result.documentType,
    confidence: params.result.confidence ?? 0,
    summary: params.result.summary,
    extracted: { ...params.fields },
    suggestedActions: params.result.suggestedActions ?? [],
    storagePath: params.storagePath,
    searchText: buildSearchText(params.name, params.result, params.fields),
    createdAt: params.createdAt ?? new Date().toISOString(),
  }
}

async function resolveWorkflowDocumentUrl(doc: StoredDocumentLink): Promise<string> {
  const directPath = normalizeDocumentStoragePath(doc.storage_path)
  if (directPath) {
    const signedUrl = await getDokumentUrl(directPath)
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

  throw new Error('Für dieses Dokument wurde keine gespeicherte Datei gefunden. Bitte Upload und Storage-Verknüpfung prüfen.')
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function KiErkennungPage() {
  const router = useRouter()
  const [isDemo] = useState(() => hasDemoCookie())
  const [activeTab, setActiveTab] = useState<Tab>('tagesbrief')
  const [aiSettings, setAiSettings] = useState<AiFeatureSettings>({ enabled: true, chatEnabled: true, documentEnabled: true })

  // Tab: Tagesbrief
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefText, setBriefText] = useState<string | null>(null)

  // Tab: Dokumente
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analyzing' | 'done'>('idle')
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [docResult, setDocResult] = useState<DocumentAiResult | null>(null)
  const [editableFields, setEditableFields] = useState<Record<string, string>>({})
  const [docError, setDocError] = useState<string | null>(null)
  const [docConfirm, setDocConfirm] = useState(false)
  const [savedDocs, setSavedDocs] = useState<DocumentWorkflowRecord[]>([])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [docSearch, setDocSearch] = useState('')
  const [handoverConfirm, setHandoverConfirm] = useState<HandoverTarget | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocumentWorkflowRecord | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Tab: Chat
  const [chatMsg, setChatMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: hasDemoCookie()
      ? 'Hallo! Dieser allgemeine Chat läuft vorerst im Demo-Modus. Echte KI-Analyse ist im Tab „Dokumente" aktiv.'
      : 'Hallo! Für diesen neuen Account ist der Assistent noch leer. Echte KI-Analyse ist im Tab „Dokumente" aktiv; Betriebsdaten erscheinen hier erst, wenn Sie eigene Daten anlegen.'
    },
  ])
  const [chatLoading, setChatLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ msgIdx: number; actionIdx: number } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const toast = useGlobalToast()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Tagesbrief beim ersten Laden generieren
  useEffect(() => {
    generateBrief()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getAiFeatureSettings()
      .then(setAiSettings)
      .catch(() => {})
    getBueroDokumente()
      .then(rows => {
        setSavedDocs((rows as Array<Record<string, unknown>>).map(row => {
          const documentType = (row.document_type || row.typ || 'sonstiges') as DocumentAiResult['documentType']
          const extracted = (row.extracted && typeof row.extracted === 'object' ? row.extracted : {}) as Record<string, unknown>
          const fields = Object.fromEntries(Object.entries(extracted).map(([k, v]) => [k, fieldToString(v)]))
          const result: DocumentAiResult = {
            documentType,
            confidence: Number(row.confidence ?? 0),
            summary: String(row.summary ?? row.bezug ?? ''),
            extracted,
            suggestedActions: Array.isArray(row.suggested_actions) ? row.suggested_actions.map(String) : [],
          }
          return toDocRecord({
            id: String(row.id),
            name: String(row.name ?? 'Dokument'),
            result,
            fields,
            status: (row.status as DocumentStatus) ?? 'erkannt',
            storagePath: row.storage_path ? String(row.storage_path) : undefined,
            createdAt: row.created_at ? String(row.created_at) : undefined,
          })
        }))
      })
      .catch(() => {})
  }, [isDemo])

  // Chat auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatLoading])

  // ── Tagesbrief generieren ──────────────────────────────────────────────────

  async function generateBrief() {
    setBriefLoading(true)
    setBriefText(null)

    if (!isDemo) {
      await new Promise(r => setTimeout(r, 250))
      setBriefText('Heute liegen für diesen Live-Account noch keine eigenen Auswertungsdaten im KI-Assistenten vor. Legen Sie Lagerartikel, Werkstattkarten oder Rechnungen an; danach kann der Tagesbrief konkrete Hinweise aus Ihren echten Daten anzeigen.')
      setBriefLoading(false)
      return
    }

    const offeneAufgaben = demoAufgaben.filter(a => a.status === 'Offen' || a.status === 'In Arbeit')
    const kritischeKarten = demoKarten.filter(k => k.status !== 'Fertig' && (k.prioritaet === 'Kritisch' || k.prioritaet === 'Hoch'))
    const nachbestellArtikel = demoArtikel.filter(a => a.status === 'niedrig' || a.status === 'leer')
    const ueberfaelligeRechnungen = demoRechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung')

    const contextStr = `
Aktuelle Betriebsdaten (heute, ${new Date().toLocaleDateString('de-DE')}):
- Offene/laufende Aufgaben: ${offeneAufgaben.length} (${offeneAufgaben.map(a => a.titel).join(', ')})
- Kritische/hohe Werkstatt-Arbeitskarten: ${kritischeKarten.length} (${kritischeKarten.map(k => k.titel).join(', ')})
- Artikel mit Nachbestellbedarf: ${nachbestellArtikel.length} (${nachbestellArtikel.map(a => a.name).join(', ')})
- Überfällige/gemahnte Rechnungen: ${ueberfaelligeRechnungen.length} (${ueberfaelligeRechnungen.map(r => `${r.rechnungsnummer} – ${r.kunde}`).join(', ')})
`.trim()

    const prompt = `Erstelle einen kurzen, konkreten Tagesbrief (max. 4 Sätze) basierend auf folgenden Daten. Beginne mit "Heute, [Wochentag]," und gib am Ende 1-2 priorisierte Empfehlungen.`

    void contextStr
    void prompt
    await new Promise(r => setTimeout(r, 450))
    setBriefText(buildStaticBrief(offeneAufgaben.length, nachbestellArtikel.length, ueberfaelligeRechnungen.length, kritischeKarten.length))

    setBriefLoading(false)
  }

  function buildStaticBrief(aufgaben: number, artikel: number, rechnungen: number, karten: number) {
    const tag = new Date().toLocaleDateString('de-DE', { weekday: 'long' })
    return `Heute, ${tag}, sind ${aufgaben} Aufgaben offen, ${karten} Arbeitskarte${karten !== 1 ? 'n' : ''} kritisch/hoch priorisiert, ${artikel} Artikel müssen nachbestellt werden und ${rechnungen} Rechnung${rechnungen !== 1 ? 'en sind' : ' ist'} überfällig. Empfehlung: Starten Sie mit der kritischen Werkstatt-Arbeitskarte, prüfen Sie dann die überfälligen Rechnungen und lösen Sie den Bestellvorschlag aus.`
  }

  // ── Dokumente analysieren ──────────────────────────────────────────────────

  async function analyzeDocument(file = selectedFile) {
    if (!aiSettings.enabled || !aiSettings.documentEnabled) {
      setDocError('Die Dokumenten-KI ist aktuell im Inhaber-Cockpit deaktiviert.')
      return
    }

    if (!file) {
      setDocError('Bitte zuerst eine PDF- oder Bilddatei auswählen.')
      return
    }

    setDocError(null)
    setDocConfirm(false)
    setDocResult(null)
    setEditableFields({})
    setStage('uploading')

    try {
      const form = new FormData()
      form.append('file', file)
      setStage('analyzing')

      const res = await fetch('/api/document-ai', { method: 'POST', body: form })
      const data = await res.json() as DocumentAiResult
      if (!res.ok) throw new Error(data.summary || 'Dokumentenanalyse fehlgeschlagen.')

      setDocResult(data)
      setEditableFields(Object.fromEntries(
        Object.entries(data.extracted ?? {}).map(([key, value]) => [key, fieldToString(value)]),
      ))
      const fields = Object.fromEntries(Object.entries(data.extracted ?? {}).map(([key, value]) => [key, fieldToString(value)]))
      setResult({
        type: labelForDocumentType(data.documentType),
        confidence: Math.round((data.confidence ?? 0) * 100),
        fields,
        raw: data.summary,
      })
      const docId = genId('DOK')
      let storagePath: string | undefined
      const { data: auth } = await createSupabaseClient().auth.getUser()
      const userId = auth.user?.id
      if (userId) storagePath = await uploadDokument(file, userId)
      await insertBueroDokument({
        id: docId,
        name: file.name,
        typ: labelForDocumentType(data.documentType),
        groesse: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        datum: new Date().toISOString().slice(0, 10),
        kategorie: 'KI-Dokument',
        bezug: data.summary,
        storage_path: storagePath,
        status: 'erkannt',
        document_type: data.documentType,
        confidence: data.confidence,
        summary: data.summary,
        extracted: fields,
        suggested_actions: data.suggestedActions ?? [],
        search_text: buildSearchText(file.name, data, fields),
      })
      const record = toDocRecord({ id: docId, name: file.name, result: data, fields, storagePath })
      setSavedDocs(prev => [record, ...prev].slice(0, 30))
      setActiveDocId(docId)
      setStage('done')
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Dokumentenanalyse fehlgeschlagen.')
      setStage('idle')
    }
  }

  function resetDocument() {
    setStage('idle')
    setResult(null)
    setSelectedFile(null)
    setDocResult(null)
    setEditableFields({})
    setDocError(null)
    setDocConfirm(false)
    setHandoverConfirm(null)
  }

  async function setDocumentStatus(id: string, status: DocumentStatus) {
    setSavedDocs(prev => prev.map(d => d.id === id ? { ...d, status } : d))
    await updateBueroDokument(id, { status })
  }

  async function openSavedDocument(doc: DocumentWorkflowRecord) {
    if (isDemo) {
      setPreviewDoc(doc)
      setPreviewUrl('')
      setPreviewError('Im Demo-Modus ist keine echte Datei hinterlegt. In Live-Accounts wird hier die Vorschau oder Dateiansicht geöffnet.')
      setPreviewLoading(false)
      return
    }

    setPreviewDoc(doc)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewUrl('')

    try {
      setPreviewUrl(await resolveWorkflowDocumentUrl({
        ...doc,
        storage_path: doc.storagePath,
        dokument_id: doc.id,
      }))
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Dokument konnte nicht geöffnet werden.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function applyDocumentResult() {
    if (!docResult) return
    if (!docConfirm) {
      setDocConfirm(true)
      return
    }

    const showToast = (msg: string, type: 'success' | 'error') => {
      if (type === 'error') toast.error(msg); else toast.success(msg)
    }

    const updated: DocumentAiResult = {
      ...docResult,
      extracted: { ...editableFields },
    }
    const isInvoice = updated.documentType === 'rechnung'
    const potentialIncomingInvoice = isInvoice && (
      !!editableFields.lieferant ||
      String(editableFields.kunde ?? '').toLowerCase().includes('petersen') ||
      String(editableFields.empfaenger ?? '').toLowerCase().includes('petersen')
    )
    if (potentialIncomingInvoice) {
      const gross = parseFloat(String(editableFields.betrag_brutto ?? editableFields.betrag ?? '0').replace(',', '.')) || 0
      const tax = parseFloat(String(editableFields.mwst ?? '0').replace(',', '.')) || 0
      const net = parseFloat(String(editableFields.betrag_netto ?? '').replace(',', '.')) || Math.max(0, gross - tax)
      localStorage.setItem('pk_doc_ai_eingangsrechnung', JSON.stringify({
        lieferant: editableFields.lieferant || '',
        rechnungsnummer: editableFields.rechnungsnummer || '',
        rechnungsdatum: editableFields.rechnungsdatum || editableFields.datum || '',
        faelligkeit: editableFields.faelligkeit || '',
        betrag_netto: net,
        mwst: tax,
        betrag_brutto: gross,
        iban: editableFields.iban || '',
        verwendungszweck: editableFields.rechnungsnummer || '',
        kategorie: 'Dokumenten-KI',
        status: 'offen',
        notiz: `Aus KI-Dokumentenanalyse übernommen: ${updated.summary}`,
      }))
    }

    try {
      if (activeDocId) {
        await setDocumentStatus(activeDocId, 'geprüft')
      }
      if (hasDemoCookie()) {
        const docId = activeDocId ?? genId('DOK')
        const record = toDocRecord({ id: docId, name: selectedFile?.name ?? 'Demo-Dokument', result: updated, fields: editableFields, status: 'geprüft' })
        setSavedDocs(prev => prev.some(d => d.id === docId) ? prev.map(d => d.id === docId ? record : d) : [record, ...prev].slice(0, 30))
        showToast(potentialIncomingInvoice ? 'Demo: Eingangsrechnung für BüroPilot vorbereitet.' : 'Demo: Dokument wurde lokal übernommen.', 'success')
      } else {
        showToast(potentialIncomingInvoice ? 'Eingangsrechnung für BüroPilot vorbereitet.' : 'Dokument als geprüft markiert.', 'success')
      }
      setDocConfirm(false)
    } catch {
      showToast('Dokument konnte nicht übernommen werden.', 'error')
    }
  }

  async function handoverDocument(target: HandoverTarget) {
    if (!docResult) return
    const showToast = (msg: string, type: 'success' | 'error') => {
      if (type === 'error') toast.error(msg); else toast.success(msg)
    }
    if (handoverConfirm !== target) {
      setHandoverConfirm(target)
      return
    }

    try {
      const docId = activeDocId ?? genId('DOK')
      const storagePath = savedDocs.find(d => d.id === docId)?.storagePath
      const gross = parseMoney(editableFields.betrag_brutto || editableFields.betrag || editableFields.summe)
      const tax = parseMoney(editableFields.mwst || editableFields.steuerbetrag)
      const net = parseMoney(editableFields.betrag_netto) || Math.max(0, gross - tax)

      if (target === 'eingangsrechnung') {
        const payload = {
          id: genId('ER'),
          lieferant: editableFields.lieferant || editableFields.kunde || 'Unbekannter Lieferant',
          rechnungsnummer: editableFields.rechnungsnummer || '',
          rechnungsdatum: editableFields.rechnungsdatum || editableFields.datum || undefined,
          faelligkeit: editableFields.faelligkeit || undefined,
          betrag_netto: net,
          mwst: tax,
          betrag_brutto: gross,
          status: 'offen',
          kategorie: 'Dokumenten-KI',
          iban: editableFields.iban || undefined,
          verwendungszweck: editableFields.rechnungsnummer || undefined,
          notiz: docResult.summary,
          dokument_id: docId,
          dokument_url: storagePath,
        }
        if (hasDemoCookie()) localStorage.setItem('pk_doc_ai_eingangsrechnung', JSON.stringify(payload))
        else await upsertBueroEingangsrechnung(payload)
      }

      if (target === 'rechnung') {
        const payload = {
          id: editableFields.rechnungsnummer || genId('RE'),
          kunde: editableFields.kunde || editableFields.empfaenger || '',
          betrag: gross ? `${gross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : fieldToString(editableFields.betrag),
          faellig: editableFields.faelligkeit || '',
          erstellt: editableFields.rechnungsdatum || editableFields.datum || new Date().toLocaleDateString('de-DE'),
          status: 'Offen',
        }
        if (!hasDemoCookie()) await upsertBueroRechnung(payload)
      }

      if (target === 'angebot') {
        const payload = {
          id: editableFields.angebotsnummer || genId('ANG'),
          kunde: editableFields.kunde || '',
          titel: editableFields.titel || 'Aus Dokument übernommen',
          betrag: fieldToString(editableFields.betrag || editableFields.betrag_brutto),
          datum: editableFields.datum || new Date().toLocaleDateString('de-DE'),
          gueltig: editableFields.gueltig_bis || '',
          status: 'Entwurf',
        }
        if (!hasDemoCookie()) await upsertBueroAngebot(payload)
      }

      if (target === 'wareneingang' || target === 'lieferschein') {
        const artikelText = fieldToString(editableFields.artikel || editableFields.positionen || editableFields.titel || 'Dokument-Wareneingang')
        const mengeText = fieldToString(editableFields.mengen || '0')
        const payload = {
          id: genId('WE'),
          bestellung_id: editableFields.bestellnummer || undefined,
          lieferant: editableFields.lieferant || '',
          artikel: artikelText.slice(0, 250),
          menge: parseMoney(mengeText),
          einheit: 'Stk',
          datum: editableFields.lieferdatum || editableFields.datum || new Date().toLocaleDateString('de-DE'),
          qualitaet: 'OK',
          mitarbeiter: 'Dokumenten-KI',
        }
        if (!hasDemoCookie()) await insertEinkaufWareneingang(payload)
      }

      if (activeDocId) await setDocumentStatus(activeDocId, 'übernommen')
      setHandoverConfirm(null)
      showToast(`Dokument wurde als ${target} übernommen`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Übernahme fehlgeschlagen', 'error')
    }
  }

  // ── KI-Aktion ausführen ────────────────────────────────────────────────────

  async function executeUmlagerung(action: KiAction, msgIdx: number, actionIdx: number) {
    const key = `${msgIdx}-${actionIdx}`
    setActionLoading(key)
    const showToast = (msg: string, type: 'success' | 'error') => {
      if (type === 'error') toast.error(msg); else toast.success(msg)
    }

    try {
      if (hasDemoCookie()) {
        await new Promise(r => setTimeout(r, 900))
        showToast(`Demo: Umlagerung „${action.artikel}" erfolgreich simuliert`, 'success')
      } else {
        const [stellplaetze, bestand] = await Promise.all([
          getLagerStellplaetze(),
          getLagerStellplatzBestand(),
        ])

        const nachSp = stellplaetze.find((sp: { code: string }) => sp.code === action.nach)
        if (!nachSp) throw new Error(`Stellplatz „${action.nach}" nicht gefunden`)

        const vonRow = bestand.find((b: { artikelname?: string; lager_stellplaetze?: { code?: string } | null }) => {
          const code = b.lager_stellplaetze?.code
          return b.artikelname === action.artikel && code === action.von
        })
        if (!vonRow) throw new Error(`Kein Bestand für „${action.artikel}" auf „${action.von}"`)

        await umlagerArtikel({
          vonBestandId: (vonRow as { id: string }).id,
          nachStellplatzId: (nachSp as { id: string }).id,
          menge: action.menge ?? 0,
          grund: 'KI-Vorschlag',
          artikelname: action.artikel,
        })
        showToast(`Umlagerung „${action.artikel}" erfolgreich ausgeführt`, 'success')
      }
      setConfirmAction(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fehler bei der Umlagerung', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function executeBestellung(action: KiAction, msgIdx: number, actionIdx: number) {
    const key = `${msgIdx}-${actionIdx}`
    setActionLoading(key)
    const showToast = (msg: string, type: 'success' | 'error') => {
      if (type === 'error') toast.error(msg); else toast.success(msg)
    }
    try {
      if (hasDemoCookie()) {
        await new Promise(r => setTimeout(r, 700))
        showToast(`Demo: Bestellung für „${action.artikel}" simuliert`, 'success')
      } else {
        const lieferanten = await getEinkaufLieferanten()
        const lieferant = lieferanten[0] as { id: string; name: string } | undefined
        await upsertEinkaufBestellung({
          id: `BS-${Date.now().toString(36).toUpperCase()}`,
          lieferant_id: lieferant?.id ?? '',
          status: 'Offen',
          artikel: action.artikel ?? 'Unbekannter Artikel',
          menge: action.menge ?? 1,
          einkaufspreis: '0',
          gesamt: '0',
          bestellt_am: new Date().toISOString().slice(0, 10),
          notiz: action.beschreibung ? `KI-Vorschlag: ${action.beschreibung}` : 'KI-Vorschlag',
        })
        showToast(`Bestellung für „${action.artikel}" erstellt`, 'success')
      }
      setConfirmAction(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fehler bei der Bestellung', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Demo-Chat ──────────────────────────────────────────────────────────────

  async function sendChat() {
    if (!chatMsg.trim() || chatLoading) return
    const userMsg = chatMsg.trim()
    setChatMsg('')
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMsg }]
    setChatHistory(newHistory)
    setChatLoading(true)

    await new Promise(r => setTimeout(r, 550))
    const q = userMsg.toLowerCase()
    const reply = !isDemo
      ? 'Dieser Chat bleibt vorerst im Simulationsmodus und verwendet keine Demo-Betriebsdaten für Live-Accounts. Nutzen Sie den Tab „Dokumente" für echte KI-Dokumentenanalyse oder legen Sie eigene Daten in den Piloten an.'
      : q.includes('bestand') || q.includes('artikel')
      ? 'Demo-Chat: 4 Artikel haben aktuell niedrigen oder leeren Bestand. Öffnen Sie den LagerPilot für Bestellvorschläge und Mindestbestand-Prüfung.'
      : q.includes('rechnung') || q.includes('zahlung')
      ? 'Demo-Chat: 2 Rechnungen sind überfällig oder in Mahnung. Details stehen im BüroPilot.'
      : q.includes('dokument') || q.includes('scan')
      ? 'Demo-Chat: Echte KI ist hier nur im Tab „Dokumente" aktiv. Laden Sie dort eine PDF- oder Bilddatei hoch.'
      : 'Demo-Chat: Ich simuliere den allgemeinen Assistenten weiterhin ohne echte KI-Antworten. Echte OpenAI-Analyse ist nur für Dokumente aktiviert.'
    setChatHistory(prev => [...prev, { role: 'assistant', content: reply, actions: [] }])
    setChatLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    border: 'none',
    transition: 'all .18s',
    background: activeTab === t ? 'rgba(167,139,250,.18)' : 'transparent',
    color: activeTab === t ? '#a78bfa' : '#aeb9c8',
    borderBottom: activeTab === t ? '2px solid #a78bfa' : '2px solid transparent',
  })

  const filteredDocs = savedDocs.filter(d =>
    !docSearch.trim() ||
    d.searchText.includes(docSearch.toLowerCase()) ||
    d.name.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.summary.toLowerCase().includes(docSearch.toLowerCase())
  )

  const handoverOptions: { id: HandoverTarget; label: string; icon: string }[] = [
    { id: 'eingangsrechnung', label: 'Als Eingangsrechnung übernehmen', icon: '📥' },
    { id: 'rechnung', label: 'Als Rechnung übernehmen', icon: '🧾' },
    { id: 'angebot', label: 'Als Angebot übernehmen', icon: '📄' },
    { id: 'lieferschein', label: 'Als Lieferschein übernehmen', icon: '🚚' },
    { id: 'wareneingang', label: 'Als Wareneingang übernehmen', icon: '📦' },
  ]

  return (
    <div className="fade-in">
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
          onRetry={() => openSavedDocument(previewDoc)}
          onOpenExternal={previewUrl ? () => window.open(previewUrl, '_blank', 'noopener,noreferrer') : undefined}
        />
      )}
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(167,139,250,.15)', border: '1px solid rgba(167,139,250,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🧠</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>KI-Assistent</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Tagesbrief · Dokumente · Chat</p>
        </div>
      </div>

      {!aiSettings.enabled && (
        <div style={{ marginBottom: 18, padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.28)', color: '#fbbf24', fontSize: 13 }}>
          KI-Funktionen sind derzeit im Inhaber-Cockpit deaktiviert. Dadurch entstehen in der Testphase keine API-Kosten.
        </div>
      )}

      {/* Tab-Leiste */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: 0 }}>
        <button style={tabStyle('tagesbrief')} onClick={() => setActiveTab('tagesbrief')}>🧠 Tagesbrief</button>
        <button style={tabStyle('dokumente')} onClick={() => setActiveTab('dokumente')}>📄 Dokumente</button>
        <button style={tabStyle('chat')} onClick={() => setActiveTab('chat')}>💬 Chat</button>
      </div>

      {/* ── Tab 1: Tagesbrief ── */}
      {activeTab === 'tagesbrief' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KI-Zusammenfassung */}
          <div className="pk-card" style={{ borderColor: 'rgba(167,139,250,.3)', background: 'rgba(167,139,250,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#a78bfa' }}>✨ KI-Tagesbrief</h3>
              <button
                className="pk-btn-ghost"
                onClick={generateBrief}
                disabled={briefLoading}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ display: 'inline-block', animation: briefLoading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
                Tagesbrief aktualisieren
              </button>
            </div>

            {briefLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                <div style={{ width: 28, height: 28, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ color: '#aeb9c8', fontSize: 14 }}>Tagesbrief wird generiert…</span>
              </div>
            ) : briefText ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#f0f4ff' }}>{briefText}</p>
            ) : null}
          </div>

          {!isDemo ? (
            <div className="pk-card">
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800 }}>Noch keine Live-Daten im KI-Assistenten</h3>
              <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>
                Für neue Firmenaccounts werden keine Demo-Aufgaben, Demo-Artikel oder Demo-Rechnungen mehr angezeigt. Sobald echte Daten in LagerPilot, BüroPilot oder WerkstattPilot angelegt sind, kann der Assistent darauf aufbauen.
              </p>
            </div>
          ) : (
          <>
          {/* Karte 1: Was muss heute erledigt werden? */}
          <div className="pk-card">
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📋 Was muss heute erledigt werden?</h3>

            {/* Aufgaben */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                PlanungPilot – Aufgaben
              </div>
              {demoAufgaben
                .filter(a => a.status === 'Offen' || a.status === 'In Arbeit')
                .sort((a, b) => (a.prioritaet === 'Hoch' ? -1 : b.prioritaet === 'Hoch' ? 1 : 0))
                .map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 10, marginBottom: 6,
                    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: a.prioritaet === 'Hoch' ? 'rgba(239,68,68,.15)' : 'rgba(251,146,60,.15)',
                      color: a.prioritaet === 'Hoch' ? '#f87171' : '#fb923c',
                    }}>{a.prioritaet}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.titel}</span>
                    <span style={{ fontSize: 12, color: '#aeb9c8' }}>{a.status}</span>
                    <button
                      className="pk-btn-ghost"
                      onClick={() => router.push('/dashboard/planung')}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >➜</button>
                  </div>
                ))}
            </div>

            {/* Werkstatt-Karten */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                WerkstattPilot – Kritische Arbeitskarten
              </div>
              {demoKarten
                .filter(k => k.status !== 'Fertig' && (k.prioritaet === 'Kritisch' || k.prioritaet === 'Hoch'))
                .map(k => (
                  <div key={k.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 10, marginBottom: 6,
                    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(239,68,68,.15)',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: k.prioritaet === 'Kritisch' ? 'rgba(239,68,68,.2)' : 'rgba(251,146,60,.15)',
                      color: k.prioritaet === 'Kritisch' ? '#f87171' : '#fb923c',
                    }}>{k.prioritaet}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{k.titel}</span>
                    <span style={{ fontSize: 12, color: '#aeb9c8' }}>{k.status}</span>
                    <button
                      className="pk-btn-ghost"
                      onClick={() => router.push('/dashboard/werkstatt')}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >➜</button>
                  </div>
                ))}
            </div>
          </div>

          {/* Karte 2: Welche Artikel müssen nachbestellt werden? */}
          <div className="pk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>🛒 Welche Artikel müssen nachbestellt werden?</h3>
              <button
                className="pk-btn-ghost"
                onClick={() => router.push('/dashboard/lager')}
                style={{ fontSize: 12 }}
              >→ Bestellvorschlag öffnen</button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {demoArtikel.filter(a => a.status === 'niedrig' || a.status === 'leer').map(a => (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,.03)', border: `1px solid ${a.status === 'leer' ? 'rgba(239,68,68,.2)' : 'rgba(251,146,60,.2)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>Mindestbestand: {a.mindestbestand} {a.einheit}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>Bestand</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: a.status === 'leer' ? '#f87171' : '#fb923c' }}>{a.bestand}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>Vorschlag</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#4ddb7e' }}>+{a.vorschlag}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: a.status === 'leer' ? 'rgba(239,68,68,.15)' : 'rgba(251,146,60,.12)',
                    color: a.status === 'leer' ? '#f87171' : '#fb923c',
                  }}>{a.status === 'leer' ? 'Leer' : 'Niedrig'}</span>
                  <button
                    className="pk-btn-ghost"
                    onClick={() => router.push('/dashboard/lager')}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >➜</button>
                </div>
              ))}
            </div>
          </div>

          {/* Karte 3: Welche Kunden sollte ich heute kontaktieren? */}
          <div className="pk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>👥 Welche Kunden sollte ich heute kontaktieren?</h3>
              <button
                className="pk-btn-ghost"
                onClick={() => router.push('/dashboard/buero')}
                style={{ fontSize: 12 }}
              >→ BüroPilot öffnen</button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {demoRechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').map(r => (
                <div key={r.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,.03)', border: `1px solid ${r.status === 'Mahnung' ? 'rgba(239,68,68,.25)' : 'rgba(251,146,60,.2)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.kunde}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{r.rechnungsnummer} · fällig seit {r.tageUeberfaellig} Tagen</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{formatEuro(r.betrag)}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: r.status === 'Mahnung' ? 'rgba(239,68,68,.15)' : 'rgba(251,146,60,.12)',
                    color: r.status === 'Mahnung' ? '#f87171' : '#fb923c',
                  }}>{r.status}</span>
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>{r.tageUeberfaellig}d überfällig</span>
                  <button
                    className="pk-btn-ghost"
                    onClick={() => router.push('/dashboard/buero')}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >→ Rechnung öffnen</button>
                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* ── Tab 2: Dokumente ── */}
      {activeTab === 'dokumente' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div className="pk-card" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>📄 Dokumente analysieren</h3>
              <p style={{ margin: '0 0 16px', color: '#aeb9c8', fontSize: 13 }}>
                PDF- und Bilddateien hochladen. Nur dieser Bereich nutzt echte OpenAI-Dokumenten-KI.
              </p>

              {stage === 'idle' && (
                <div>
                  <label
                    style={{
                      border: '2px dashed rgba(22,132,255,.3)', borderRadius: 16,
                      padding: '40px 20px', textAlign: 'center', marginBottom: 14,
                      background: 'rgba(22,132,255,.04)', cursor: 'pointer',
                      transition: 'border-color .2s, background .2s', display: 'block',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLLabelElement
                      el.style.borderColor = 'rgba(22,132,255,.6)'
                      el.style.background = 'rgba(22,132,255,.08)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLLabelElement
                      el.style.borderColor = 'rgba(22,132,255,.3)'
                      el.style.background = 'rgba(22,132,255,.04)'
                    }}
                  >
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0] ?? null
                        setSelectedFile(file)
                        setDocError(null)
                      }}
                    />
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Dokument hochladen</div>
                    <div style={{ color: '#aeb9c8', fontSize: 13 }}>
                      PDF, PNG, JPG/JPEG, WEBP · max. 12 MB
                    </div>
                    {selectedFile && (
                      <div style={{ marginTop: 10, color: '#6cb6ff', fontSize: 13, fontWeight: 700 }}>
                        Ausgewählt: {selectedFile.name}
                      </div>
                    )}
                  </label>
                  {docError && (
                    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 9, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>
                      {docError}
                    </div>
                  )}
                  <button className="pk-btn" onClick={() => analyzeDocument()} disabled={!selectedFile || !aiSettings.enabled || !aiSettings.documentEnabled} style={{ width: '100%', fontWeight: 700, opacity: selectedFile && aiSettings.enabled && aiSettings.documentEnabled ? 1 : .55 }}>
                    🧠 Dokument mit OpenAI analysieren
                  </button>
                </div>
              )}

              {stage === 'uploading' && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>⬆️</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Dokument wird hochgeladen…</div>
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Bitte warten</div>
                </div>
              )}

              {stage === 'analyzing' && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{ width: 48, height: 48, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>KI analysiert Dokument…</div>
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Daten werden extrahiert</div>
                </div>
              )}

              {stage === 'done' && docResult && (
                <div>
                  <div style={{
                    padding: '12px 16px', borderRadius: 12, marginBottom: 16,
                    background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.25)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#4ddb7e' }}>
                        {labelForDocumentType(docResult.documentType)} erkannt – {Math.round((docResult.confidence ?? 0) * 100)}% Konfidenz
                      </div>
                      <div style={{ fontSize: 12, color: '#aeb9c8' }}>{docResult.summary}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {Object.entries(editableFields).map(([key, val]) => (
                      <div key={key} style={{
                        display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, alignItems: 'center',
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)',
                      }}>
                        <span style={{ fontSize: 12, color: '#aeb9c8' }}>{key}</span>
                        <input
                          className="pk-input"
                          value={val}
                          onChange={e => setEditableFields(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ minHeight: 34, fontSize: 13 }}
                        />
                      </div>
                    ))}
                  </div>

                  {docResult.suggestedActions.length > 0 && (
                    <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
                      {docResult.suggestedActions.map((a, i) => (
                        <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.18)', fontSize: 13, color: '#c4b5fd' }}>
                          💡 {a}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="pk-btn" onClick={applyDocumentResult} style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>
                      {docConfirm ? '✅ Ja, als geprüft markieren' : '✓ Felder geprüft'}
                    </button>
                    {docConfirm && (
                      <button className="pk-btn-ghost" onClick={() => setDocConfirm(false)} style={{ fontSize: 13 }}>
                        Abbrechen
                      </button>
                    )}
                    <button className="pk-btn-ghost" onClick={resetDocument} style={{ fontSize: 13 }}>
                      Neu
                    </button>
                  </div>
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                    <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>Übernahme in Pilot</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                      {handoverOptions.map(option => (
                        <button
                          key={option.id}
                          className={handoverConfirm === option.id ? 'pk-btn' : 'pk-btn-ghost'}
                          onClick={() => handoverDocument(option.id)}
                          style={{ fontSize: 12, fontWeight: 750, justifyContent: 'center' }}
                        >
                          {handoverConfirm === option.id ? 'Wirklich ausführen?' : `${option.icon} ${option.label}`}
                        </button>
                      ))}
                    </div>
                    {handoverConfirm && (
                      <button className="pk-btn-ghost" onClick={() => setHandoverConfirm(null)} style={{ marginTop: 8, fontSize: 12 }}>
                        Übernahme abbrechen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Letzte Dokumente */}
            <div className="pk-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Dokumentenworkflow</h3>
                <input className="pk-input" placeholder="Suche…" value={docSearch} onChange={e => setDocSearch(e.target.value)} style={{ maxWidth: 190, minHeight: 34, fontSize: 12 }} />
              </div>
              {(filteredDocs.length > 0 ? filteredDocs : [
                toDocRecord({ id: 'DEMO-DOK-1', name: 'Demo Lieferschein.pdf', result: { documentType: 'lieferschein', summary: 'Demo: Lieferschein LS-2025-08844', confidence: .99, extracted: {}, suggestedActions: [] }, fields: {}, status: 'archiviert' }),
                toDocRecord({ id: 'DEMO-DOK-2', name: 'Demo Rechnung.pdf', result: { documentType: 'rechnung', summary: 'Demo: Rechnung RE-2025-1123', confidence: .95, extracted: {}, suggestedActions: [] }, fields: {}, status: 'übernommen' }),
              ]).map(r => (
                <div key={r.id} role="button" tabIndex={0} onClick={() => openSavedDocument(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openSavedDocument(r) }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,.05)', width: '100%', color: 'inherit', textAlign: 'left', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 20 }}>{r.documentType === 'rechnung' ? '🧾' : '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>{labelForDocumentType(r.documentType)} · {r.summary}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      <span className={r.status === 'übernommen' ? 'badge badge-green' : r.status === 'archiviert' ? 'badge badge-gray' : r.status === 'geprüft' ? 'badge badge-blue' : 'badge badge-orange'}>{r.status}</span>
                      <span className="badge badge-gray">{Math.round(r.confidence * 100)}%</span>
                    </div>
                  </div>
                  {r.status !== 'archiviert' && savedDocs.some(d => d.id === r.id) && (
                    <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); setDocumentStatus(r.id, 'archiviert').catch(() => {}) }} style={{ fontSize: 11 }}>
                      Archivieren
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info-Bereich */}
          <div className="pk-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>📋 Unterstützte Dokumenttypen</h3>
            {[
              { icon: '📄', name: 'Lieferscheine', desc: 'Lieferant, Artikel, Mengen, Datum' },
              { icon: '🧾', name: 'Rechnungen', desc: 'Betrag, MwSt, Positionen, Zahlungsziel' },
              { icon: '📦', name: 'Packzettel', desc: 'Artikelnummern, Chargen, Gewichte' },
              { icon: '📸', name: 'Artikelfotos', desc: 'Artikelidentifikation, Barcode-Scan' },
              { icon: '📝', name: 'Bestellungen', desc: 'Bestellnummern, Positionen, Preise' },
            ].map(dt => (
              <div key={dt.name} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{dt.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{dt.name}</div>
                  <div style={{ color: '#aeb9c8', fontSize: 12 }}>{dt.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.2)', fontSize: 12, color: '#c4b5fd' }}>
              💡 Echte KI läuft nur hier im Dokumente-Tab über OPENAI_API_KEY. Der normale Chat bleibt Simulation.
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Demo-Chat ── */}
      {activeTab === 'chat' && (
        <div className="pk-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 560 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>💬 Demo-Chat</h3>
          <p style={{ margin: '0 0 14px', color: '#aeb9c8', fontSize: 13 }}>
            Simulierter Assistent ohne echte KI-Antworten. Echte KI wird nur im Tab „Dokumente&quot; verwendet.
          </p>

          {/* Chat-Verlauf */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, maxHeight: 420 }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
                {/* Textblase */}
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.55,
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                    : 'rgba(255,255,255,.07)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,.1)',
                  color: '#f8fbff',
                }}>
                  {msg.content}
                </div>
                {/* Aktionskarten */}
                {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '85%', width: '100%' }}>
                    {msg.actions.map((action, ai) => {
                      const cfg = action.type === 'umlagerung'
                        ? { icon: '📦', label: 'Umlagerung', color: '#1684ff', bg: 'rgba(22,132,255,.1)', border: 'rgba(22,132,255,.25)' }
                        : action.type === 'bestellung'
                        ? { icon: '🛒', label: 'Bestellung', color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)' }
                        : { icon: '💡', label: 'Hinweis', color: '#a78bfa', bg: 'rgba(167,139,250,.1)', border: 'rgba(167,139,250,.25)' }
                      const isConfirming = confirmAction?.msgIdx === i && confirmAction?.actionIdx === ai
                      const actionKey = `${i}-${ai}`
                      const isRunning = actionLoading === actionKey
                      return (
                        <div key={ai} style={{
                          padding: '9px 13px', borderRadius: 10, fontSize: 13,
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{cfg.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div>
                              <span style={{ fontWeight: 700, color: cfg.color, marginRight: 6 }}>{cfg.label}</span>
                              {action.type === 'umlagerung' && (
                                <span style={{ color: '#f8fbff' }}>
                                  <b>{action.artikel}</b>
                                  {action.von && action.nach && <> · {action.von} <span style={{ color: cfg.color }}>→</span> {action.nach}</>}
                                  {action.menge != null && <> · {action.menge} Einh.</>}
                                </span>
                              )}
                              {(action.type === 'bestellung' || action.type === 'hinweis') && (
                                <span style={{ color: '#f8fbff' }}>
                                  {action.artikel && <><b>{action.artikel}</b>{action.beschreibung ? ' · ' : ''}</>}
                                  {action.beschreibung && <span style={{ color: '#aeb9c8' }}>{action.beschreibung}</span>}
                                </span>
                              )}
                            </div>

                            {/* Bestätigungs-UI für Umlagerung */}
                            {action.type === 'umlagerung' && (
                              <div style={{ marginTop: 8 }}>
                                {isConfirming ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12, color: '#f8fbff', fontWeight: 600 }}>
                                      Wirklich ausführen?
                                    </span>
                                    <button
                                      onClick={() => executeUmlagerung(action, i, ai)}
                                      disabled={isRunning}
                                      style={{
                                        fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 700,
                                        background: '#1684ff', border: 'none', color: '#fff',
                                        opacity: isRunning ? .6 : 1,
                                      }}
                                    >
                                      {isRunning ? '⏳ Wird ausgeführt…' : '✓ Ja, ausführen'}
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction(null)}
                                      disabled={isRunning}
                                      style={{
                                        fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600,
                                        background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: '#aeb9c8',
                                      }}
                                    >
                                      Abbrechen
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmAction({ msgIdx: i, actionIdx: ai })}
                                    style={{
                                      fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600,
                                      background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.35)', color: '#6cb6ff',
                                    }}
                                  >
                                    Umlagerung ausführen →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {action.type === 'bestellung' && (
                            <div style={{ marginTop: 8 }}>
                              {isConfirming ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 12, color: '#f8fbff', fontWeight: 600 }}>Bestellung wirklich anlegen?</span>
                                  <button
                                    onClick={() => executeBestellung(action, i, ai)}
                                    disabled={isRunning}
                                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, background: '#f59e0b', border: 'none', color: '#fff', opacity: isRunning ? .6 : 1 }}
                                  >
                                    {isRunning ? '⏳ Wird angelegt…' : '✓ Ja, bestellen'}
                                  </button>
                                  <button onClick={() => setConfirmAction(null)} disabled={isRunning} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: '#aeb9c8' }}>
                                    Abbrechen
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmAction({ msgIdx: i, actionIdx: ai })}
                                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.35)', color: '#fbbf24' }}
                                >
                                  Bestellung anlegen →
                                </button>
                              )}
                            </div>
                          )}
                          {action.type === 'hinweis' && (() => {
                            // Leite Hinweise anhand von Schlüsselwörtern auf relevante Tabs/Piloten
                            const text = `${action.artikel ?? ''} ${action.beschreibung ?? ''}`.toLowerCase()
                            let href = '/dashboard/lager'
                            let label = 'LagerPilot'
                            if (text.includes('rechnung') || text.includes('auftrag') || text.includes('kunde') || text.includes('angebot')) {
                              href = '/dashboard/buero'; label = 'BüroPilot'
                            } else if (text.includes('werkstatt') || text.includes('karte') || text.includes('wartung') || text.includes('reparatur')) {
                              href = '/dashboard/werkstatt'; label = 'WerkstattPilot'
                            } else if (text.includes('steuer') || text.includes('beleg') || text.includes('ustv')) {
                              href = '/dashboard/steuer'; label = 'SteuerPilot'
                            } else if (text.includes('planung') || text.includes('projekt') || text.includes('aufgabe') || text.includes('termin')) {
                              href = '/dashboard/planung'; label = 'PlanungPilot'
                            } else if (text.includes('analyse') || text.includes('kpi') || text.includes('bericht')) {
                              href = '/dashboard/analyse'; label = 'AnalysePilot'
                            }
                            return (
                              <a href={href} style={{ fontSize: 11, color: '#a78bfa', flexShrink: 0, alignSelf: 'center', padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(167,139,250,.35)', fontWeight: 700, textDecoration: 'none', background: 'rgba(167,139,250,.08)', whiteSpace: 'nowrap' }}>
                                → {label}
                              </a>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', fontSize: 14 }}>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#a78bfa',
                        animation: `pulse 1.2s ${i * 0.2}s infinite`,
                        display: 'inline-block',
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Vorschläge */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {[
              'Welche Artikel haben niedrigen Bestand?',
              'Offene Aufgaben heute?',
              'Überfällige Rechnungen?',
            ].map(q => (
              <button
                key={q}
                onClick={() => { setChatMsg(q) }}
                style={{
                  fontSize: 12, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.2)',
                  color: '#c4b5fd', fontWeight: 600,
                }}
              >{q}</button>
            ))}
          </div>

          {/* Eingabe */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="pk-input"
              placeholder="Frage eingeben… z.B. &quot;Welche Artikel haben niedrigen Bestand?&quot;"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              style={{ flex: 1 }}
            />
            <button
              className="pk-btn"
              onClick={sendChat}
              disabled={chatLoading || !chatMsg.trim()}
              style={{ padding: '0 18px', fontWeight: 700, flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }}
            >→</button>
          </div>

          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.2)', fontSize: 11, color: '#c4b5fd' }}>
            💡 Der allgemeine Chat bleibt absichtlich Simulation. OPENAI_API_KEY wird nur für Dokumente genutzt.
          </div>
        </div>
      )}

    </div>
  )
}
