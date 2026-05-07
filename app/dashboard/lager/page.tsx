'use client'
import { useState, useEffect } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import {
  getLagerArtikel, getLagerBewegungen,
  upsertLagerArtikel, insertLagerBewegung, deleteLagerArtikel,
} from '@/lib/db'

// ── Typen ────────────────────────────────────────────────────────────────────

type Artikel = {
  id: string; name: string; kategorie: string; bestand: number
  einheit: string; lagerplatz: string; status: string; mindestbestand?: number
}
type Bewegung = {
  id: number | string; typ: string; artikel: string; menge: number
  datum: string; mitarbeiter: string; status: string
}

type SortKey = 'id' | 'name' | 'bestand' | 'status'
type SortDir = 'asc' | 'desc'

const EINHEITEN = ['Stk', 'Liter', 'kg', 'Rollen', 'Meter', 'Paar', 'Karton', 'Palette']
const KATEGORIEN = ['Rohstoffe', 'Kleinteile', 'Betriebsstoffe', 'Verbrauchsmaterial', 'Werkzeug', 'Schutzausrüstung', 'Sonstiges']

// ── Demo-Daten ───────────────────────────────────────────────────────────────

const demoArtikel: Artikel[] = [
  { id: 'ART-001', name: 'Stahlrohr 40x40', kategorie: 'Rohstoffe', bestand: 142, einheit: 'Stk', lagerplatz: 'A-01-03', status: 'ok', mindestbestand: 20 },
  { id: 'ART-002', name: 'Schrauben M8x30', kategorie: 'Kleinteile', bestand: 1840, einheit: 'Stk', lagerplatz: 'B-02-01', status: 'ok', mindestbestand: 500 },
  { id: 'ART-003', name: 'Hydrauliköl HLP46', kategorie: 'Betriebsstoffe', bestand: 8, einheit: 'Liter', lagerplatz: 'C-01-02', status: 'niedrig', mindestbestand: 20 },
  { id: 'ART-004', name: 'Schweißdraht 1.0mm', kategorie: 'Verbrauchsmaterial', bestand: 24, einheit: 'Rollen', lagerplatz: 'B-03-04', status: 'ok', mindestbestand: 10 },
  { id: 'ART-005', name: 'Aluminiumplatte 200x300', kategorie: 'Rohstoffe', bestand: 0, einheit: 'Stk', lagerplatz: 'A-02-01', status: 'leer', mindestbestand: 5 },
  { id: 'ART-006', name: 'Dichtungsring 50mm', kategorie: 'Kleinteile', bestand: 360, einheit: 'Stk', lagerplatz: 'B-01-05', status: 'ok', mindestbestand: 50 },
  { id: 'ART-007', name: 'Schutzhandschuhe Gr. L', kategorie: 'Schutzausrüstung', bestand: 12, einheit: 'Paar', lagerplatz: 'D-01-01', status: 'niedrig', mindestbestand: 20 },
  { id: 'ART-008', name: 'Winkelschleifer 125mm', kategorie: 'Werkzeug', bestand: 3, einheit: 'Stk', lagerplatz: 'E-01-02', status: 'ok', mindestbestand: 1 },
]

const demoBewegungen: Bewegung[] = [
  { id: 1, typ: 'Eingang', artikel: 'Stahlrohr 40x40', menge: 50, datum: '06.05.2025', mitarbeiter: 'K. Petersen', status: 'Gebucht' },
  { id: 2, typ: 'Ausgang', artikel: 'Schrauben M8x30', menge: 200, datum: '06.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
  { id: 3, typ: 'Eingang', artikel: 'Hydrauliköl HLP46', menge: 20, datum: '05.05.2025', mitarbeiter: 'K. Petersen', status: 'KI erkannt' },
  { id: 4, typ: 'Ausgang', artikel: 'Schweißdraht 1.0mm', menge: 6, datum: '05.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
  { id: 5, typ: 'Eingang', artikel: 'Schrauben M8x30', menge: 1000, datum: '03.05.2025', mitarbeiter: 'K. Petersen', status: 'Gebucht' },
  { id: 6, typ: 'Ausgang', artikel: 'Stahlrohr 40x40', menge: 8, datum: '02.05.2025', mitarbeiter: 'T. Schulz', status: 'Gebucht' },
]

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function nextArtikelId(liste: Artikel[]) {
  const nums = liste.map(a => parseInt(a.id.replace('ART-', '')) || 0)
  const max = nums.length ? Math.max(...nums) : 0
  return `ART-${String(max + 1).padStart(3, '0')}`
}

function calcStatus(bestand: number, mindestbestand: number): string {
  if (bestand === 0) return 'leer'
  if (bestand <= mindestbestand) return 'niedrig'
  return 'ok'
}

function toDE(date: Date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function exportCSV(data: Artikel[]) {
  const header = ['id', 'name', 'kategorie', 'bestand', 'einheit', 'lagerplatz', 'status', 'mindestbestand']
  const rows = data.map(a => [
    a.id,
    `"${a.name.replace(/"/g, '""')}"`,
    a.kategorie,
    String(a.bestand),
    a.einheit,
    a.lagerplatz,
    a.status,
    String(a.mindestbestand ?? 0),
  ].join(';'))
  const csv = [header.join(';'), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lager-export-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Modal-Komponente ─────────────────────────────────────────────────────────

type ArtikelForm = { name: string; kategorie: string; bestand: string; einheit: string; lagerplatz: string; mindestbestand: string }
const emptyForm: ArtikelForm = { name: '', kategorie: 'Rohstoffe', bestand: '0', einheit: 'Stk', lagerplatz: '', mindestbestand: '0' }

function ArtikelModal({ artikel, onSave, onClose }: {
  artikel?: Artikel | null
  onSave: (form: ArtikelForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ArtikelForm>(artikel ? {
    name: artikel.name,
    kategorie: artikel.kategorie,
    bestand: String(artikel.bestand),
    einheit: artikel.einheit,
    lagerplatz: artikel.lagerplatz,
    mindestbestand: String(artikel.mindestbestand ?? 0),
  } : emptyForm)

  const set = (k: keyof ArtikelForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} />
      <div className="pk-card fade-in-scale" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, padding: 28 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>
          {artikel ? '✏️ Artikel bearbeiten' : '➕ Neuer Artikel'}
        </h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikelbezeichnung *</label>
            <input className="pk-input" placeholder="z.B. Stahlrohr 40x40" value={form.name} onChange={set('name')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Kategorie</label>
              <select className="pk-input" value={form.kategorie} onChange={set('kategorie')}>
                {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Einheit</label>
              <select className="pk-input" value={form.einheit} onChange={set('einheit')}>
                {EINHEITEN.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Aktueller Bestand</label>
              <input className="pk-input" type="number" min="0" value={form.bestand} onChange={set('bestand')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mindestbestand ⚠️</label>
              <input className="pk-input" type="number" min="0" value={form.mindestbestand} onChange={set('mindestbestand')} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Lagerplatz</label>
            <input className="pk-input" placeholder="z.B. A-01-03" value={form.lagerplatz} onChange={set('lagerplatz')} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="pk-btn" onClick={() => { if (form.name.trim()) onSave(form) }} style={{ flex: 1, fontWeight: 700 }}>
            {artikel ? 'Speichern' : 'Artikel anlegen'}
          </button>
          <button className="pk-btn-ghost" onClick={onClose} style={{ flex: 1 }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────

export default function LagerPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<'bestand' | 'bewegungen' | 'eingang' | 'ausgang' | 'inventur' | 'bestellung'>('bestand')
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState('Alle')
  const [artikel, setArtikel] = useState<Artikel[]>(isDemo ? demoArtikel : [])
  const [bewegungen, setBewegungen] = useState<Bewegung[]>(isDemo ? demoBewegungen : [])
  const [loading, setLoading] = useState(!isDemo)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<null | 'new' | Artikel>(null)
  const [newEingang, setNewEingang] = useState({ artikel: '', menge: '', lagerplatz: '', mitarbeiter: '' })
  const [newAusgang, setNewAusgang] = useState({ artikel: '', menge: '', empfaenger: '', mitarbeiter: '' })
  const [inventurWerte, setInventurWerte] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Sortierung Bestand-Tab
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Inline-Delete-Bestätigung
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Warnbanner-Liste ausklappen
  const [warnListOpen, setWarnListOpen] = useState(false)

  // Bestellvorschlag-State
  const [bestellMengen, setBestellMengen] = useState<Record<string, string>>({})
  const [bestelltIds, setBestelltIds] = useState<Set<string>>(new Set())

  // Daten laden
  useEffect(() => {
    if (isDemo) return
    Promise.all([getLagerArtikel(), getLagerBewegungen()])
      .then(([a, b]) => { setArtikel(a as Artikel[]); setBewegungen(b as Bewegung[]) })
      .catch(() => showToast('Fehler beim Laden', false))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = artikel.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      (a.lagerplatz ?? '').toLowerCase().includes(search.toLowerCase())
    const matchKat = filterKat === 'Alle' || a.kategorie === filterKat
    return matchSearch && matchKat
  })

  // ── Sortierung ───────────────────────────────────────────────────────────────

  const statusOrder: Record<string, number> = { leer: 0, niedrig: 1, ok: 2 }

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'id') cmp = a.id.localeCompare(b.id)
    else if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'bestand') cmp = a.bestand - b.bestand
    else if (sortKey === 'status') cmp = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ color: '#4a5568', marginLeft: 4, fontSize: 10 }}>↕</span>
    return <span style={{ color: '#6cb6ff', marginLeft: 4, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Artikel CRUD ─────────────────────────────────────────────────────────────

  const handleSaveArtikel = async (form: ArtikelForm) => {
    const bestand = parseInt(form.bestand) || 0
    const mindestbestand = parseInt(form.mindestbestand) || 0
    const status = calcStatus(bestand, mindestbestand)
    const isEdit = modal !== null && modal !== 'new'
    const id = isEdit ? (modal as Artikel).id : nextArtikelId(artikel)
    const a: Artikel = { id, name: form.name, kategorie: form.kategorie, bestand, einheit: form.einheit, lagerplatz: form.lagerplatz, status, mindestbestand }

    setSaving(true)
    if (!isDemo) {
      try { await upsertLagerArtikel(a) } catch { showToast('Fehler beim Speichern', false); setSaving(false); return }
    }
    setArtikel(prev => isEdit ? prev.map(x => x.id === id ? a : x) : [...prev, a])
    setModal(null)
    setSaving(false)
    showToast(isEdit ? `✅ "${form.name}" aktualisiert` : `✅ "${form.name}" angelegt`)
  }

  const handleDeleteArtikel = async (id: string) => {
    if (!isDemo) {
      try { await deleteLagerArtikel(id) } catch { showToast('Fehler beim Löschen', false); setDeleteConfirmId(null); return }
    }
    setArtikel(prev => prev.filter(a => a.id !== id))
    setDeleteConfirmId(null)
    showToast('🗑 Artikel gelöscht')
  }

  // ── Wareneingang ─────────────────────────────────────────────────────────────

  const handleEingang = async () => {
    if (!newEingang.artikel || !newEingang.menge) return
    const menge = parseInt(newEingang.menge)
    if (isNaN(menge) || menge <= 0) return
    setSaving(true)

    const existing = artikel.find(a => a.name === newEingang.artikel || a.id === newEingang.artikel)

    if (!isDemo) {
      try {
        await insertLagerBewegung({ typ: 'Eingang', artikel: newEingang.artikel, menge, mitarbeiter: newEingang.mitarbeiter || '—' })
        if (existing) {
          const newBestand = existing.bestand + menge
          const updated = { ...existing, bestand: newBestand, status: calcStatus(newBestand, existing.mindestbestand ?? 0) }
          await upsertLagerArtikel(updated)
          setArtikel(prev => prev.map(a => a.id === existing.id ? updated : a))
        }
        const b = await getLagerBewegungen()
        setBewegungen(b as Bewegung[])
      } catch { showToast('Fehler beim Buchen', false); setSaving(false); return }
    } else {
      if (existing) {
        const newBestand = existing.bestand + menge
        setArtikel(prev => prev.map(a => a.id === existing.id ? { ...a, bestand: newBestand, status: calcStatus(newBestand, a.mindestbestand ?? 0) } : a))
      }
      setBewegungen(prev => [{ id: Date.now(), typ: 'Eingang', artikel: newEingang.artikel, menge, datum: toDE(new Date()), mitarbeiter: newEingang.mitarbeiter || '—', status: 'Gebucht' }, ...prev])
    }

    showToast(`✅ Eingang: ${menge}× "${newEingang.artikel}" gebucht`)
    setNewEingang({ artikel: '', menge: '', lagerplatz: '', mitarbeiter: '' })
    setSaving(false)
  }

  // ── Warenausgang ─────────────────────────────────────────────────────────────

  const handleAusgang = async () => {
    if (!newAusgang.artikel || !newAusgang.menge) return
    const menge = parseInt(newAusgang.menge)
    if (isNaN(menge) || menge <= 0) return
    const existing = artikel.find(a => a.name === newAusgang.artikel || a.id === newAusgang.artikel)
    if (existing && existing.bestand < menge) {
      showToast(`⚠️ Nur noch ${existing.bestand} ${existing.einheit} auf Lager!`, false)
      return
    }
    setSaving(true)

    if (!isDemo) {
      try {
        await insertLagerBewegung({ typ: 'Ausgang', artikel: newAusgang.artikel, menge, mitarbeiter: newAusgang.mitarbeiter || '—' })
        if (existing) {
          const newBestand = Math.max(0, existing.bestand - menge)
          const updated = { ...existing, bestand: newBestand, status: calcStatus(newBestand, existing.mindestbestand ?? 0) }
          await upsertLagerArtikel(updated)
          setArtikel(prev => prev.map(a => a.id === existing.id ? updated : a))
        }
        const b = await getLagerBewegungen()
        setBewegungen(b as Bewegung[])
      } catch { showToast('Fehler beim Buchen', false); setSaving(false); return }
    } else {
      if (existing) {
        const newBestand = Math.max(0, existing.bestand - menge)
        setArtikel(prev => prev.map(a => a.id === existing.id ? { ...a, bestand: newBestand, status: calcStatus(newBestand, a.mindestbestand ?? 0) } : a))
      }
      setBewegungen(prev => [{ id: Date.now(), typ: 'Ausgang', artikel: newAusgang.artikel, menge, datum: toDE(new Date()), mitarbeiter: newAusgang.mitarbeiter || '—', status: 'Gebucht' }, ...prev])
    }

    showToast(`✅ Ausgang: ${menge}× "${newAusgang.artikel}" gebucht`)
    setNewAusgang({ artikel: '', menge: '', empfaenger: '', mitarbeiter: '' })
    setSaving(false)
  }

  // ── Inventur ─────────────────────────────────────────────────────────────────

  const handleInventurSave = async () => {
    const updates = artikel.map(a => {
      const istStr = inventurWerte[a.id]
      if (istStr === undefined || istStr === '') return null
      const ist = parseInt(istStr)
      if (isNaN(ist)) return null
      return { ...a, bestand: ist, status: calcStatus(ist, a.mindestbestand ?? 0) }
    }).filter(Boolean) as Artikel[]

    if (updates.length === 0) { showToast('Keine Änderungen', false); return }

    setSaving(true)
    if (!isDemo) {
      try { await Promise.all(updates.map(a => upsertLagerArtikel(a))) }
      catch { showToast('Fehler beim Speichern', false); setSaving(false); return }
    }
    setArtikel(prev => prev.map(a => updates.find(u => u.id === a.id) ?? a))
    setInventurWerte({})
    setSaving(false)
    showToast(`✅ Inventur gespeichert – ${updates.length} Artikel aktualisiert`)
    if (!isDemo) {
      await Promise.all(updates.map(a =>
        insertLagerBewegung({ typ: 'Inventur', artikel: a.name, menge: a.bestand, mitarbeiter: 'Inventur' }).catch(() => {})
      ))
    }
  }

  // ── Bestellvorschlag ─────────────────────────────────────────────────────────

  const bestellArtikel = artikel.filter(a => a.bestand === 0 || a.bestand <= (a.mindestbestand ?? 0))

  const getBestellMenge = (a: Artikel) => {
    if (bestellMengen[a.id] !== undefined) return bestellMengen[a.id]
    return String((a.mindestbestand ?? 0) * 2)
  }

  const handleBestellungAusloesen = (id: string) => {
    setBestelltIds(prev => { const next = new Set(Array.from(prev)); next.add(id); return next })
    showToast('✅ Bestellung ausgelöst')
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const statsNiedrig = artikel.filter(a => a.status === 'niedrig').length
  const statsLeer = artikel.filter(a => a.status === 'leer').length
  const gesamtWert = artikel.reduce((s, a) => s + a.bestand, 0)

  const warnArtikel = artikel.filter(a => a.status === 'niedrig' || a.status === 'leer')

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(22,132,255,.3)', borderTopColor: '#1684ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Lagerdaten…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Modal */}
      {modal !== null && (
        <ArtikelModal
          artikel={modal === 'new' ? null : modal}
          onSave={handleSaveArtikel}
          onClose={() => setModal(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          padding: '14px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14,
          background: toast.ok ? 'rgba(37,211,102,.15)' : 'rgba(255,80,80,.15)',
          border: `1px solid ${toast.ok ? 'rgba(37,211,102,.4)' : 'rgba(255,80,80,.4)'}`,
          color: toast.ok ? '#4ddb7e' : '#ff8080',
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          animation: 'fadeIn .2s ease',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>📦</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>LagerPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Wareneingang · Warenausgang · Bestände · Inventur</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isDemo && <button className="pk-btn" onClick={() => setModal('new')} style={{ fontSize: 13 }}>+ Artikel anlegen</button>}
          <span className="badge badge-green">● AKTIV</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Artikel gesamt', value: String(artikel.length), icon: '📦', color: '#1684ff' },
          { label: 'Gesamtbestand', value: gesamtWert.toLocaleString('de-DE'), icon: '🔢', color: '#20c8ff' },
          { label: 'Niedrig Bestand', value: String(statsNiedrig), icon: '⚠️', color: '#f59e0b' },
          { label: 'Leer / 0', value: String(statsLeer), icon: '🚨', color: '#f43f5e' },
          { label: 'Buchungen', value: String(bewegungen.length), icon: '🔄', color: '#10b981' },
          { label: 'Bestellpflichtig', value: String(bestellArtikel.length), icon: '🛒', color: bestellArtikel.length > 0 ? '#f59e0b' : '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Warnhinweis niedrig/leer – klappbar */}
      {(statsNiedrig > 0 || statsLeer > 0) && (
        <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#fbbf24', flex: 1 }}>
              <b>{statsLeer} Artikel leer</b> · <b>{statsNiedrig} Artikel unter Mindestbestand</b> – Nachbestellung empfohlen
            </span>
            <button
              onClick={() => setWarnListOpen(o => !o)}
              style={{ background: 'transparent', border: '1px solid rgba(245,158,11,.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#fbbf24', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
            >
              {warnListOpen ? 'Schließen ▲' : 'Artikel anzeigen ▼'}
            </button>
          </div>
          {warnListOpen && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(245,158,11,.15)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {warnArtikel.map(a => (
                <span
                  key={a.id}
                  style={{
                    fontSize: 12, padding: '3px 9px', borderRadius: 6, fontWeight: 600,
                    background: a.status === 'leer' ? 'rgba(244,63,94,.12)' : 'rgba(245,158,11,.12)',
                    border: `1px solid ${a.status === 'leer' ? 'rgba(244,63,94,.3)' : 'rgba(245,158,11,.3)'}`,
                    color: a.status === 'leer' ? '#f43f5e' : '#f59e0b',
                  }}
                >
                  {a.status === 'leer' ? '🚨' : '⚠️'} {a.name} ({a.bestand} {a.einheit})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', overflowX: 'auto' }}>
        {[
          { id: 'bestand', label: '📦 Bestand' },
          { id: 'bewegungen', label: '🔄 Bewegungen' },
          { id: 'eingang', label: '📥 Wareneingang' },
          { id: 'ausgang', label: '📤 Warenausgang' },
          { id: 'inventur', label: '📋 Inventur' },
          { id: 'bestellung', label: `🛒 Bestellvorschlag${bestellArtikel.length > 0 ? ` (${bestellArtikel.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{ padding: '10px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', borderBottom: tab === t.id ? '2px solid #1684ff' : '2px solid transparent', color: tab === t.id ? '#6cb6ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BESTAND ── */}
      {tab === 'bestand' && (
        <div>
          <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="pk-input" placeholder="🔍 Suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
            <select className="pk-input" value={filterKat} onChange={e => setFilterKat(e.target.value)} style={{ maxWidth: 180 }}>
              <option>Alle</option>
              {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {artikel.length} Artikel</span>
            <button
              className="pk-btn-ghost"
              onClick={() => exportCSV(sorted)}
              style={{ marginLeft: 'auto', fontSize: 13, padding: '7px 14px' }}
            >
              📥 CSV Export
            </button>
          </div>
          <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort('id')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Art.-Nr.{sortArrow('id')}
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Bezeichnung{sortArrow('name')}
                    </th>
                    <th>Kategorie</th>
                    <th
                      onClick={() => handleSort('bestand')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Bestand{sortArrow('bestand')}
                    </th>
                    <th>Mindest</th>
                    <th>Lagerplatz</th>
                    <th
                      onClick={() => handleSort('status')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Status{sortArrow('status')}
                    </th>
                    {!isDemo && <th style={{ width: 80 }}>Aktionen</th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
                      {artikel.length === 0 ? '📦 Noch keine Artikel. Lege deinen ersten Artikel an.' : 'Keine Artikel gefunden.'}
                    </td></tr>
                  ) : sorted.map(a => (
                    <tr key={a.id}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td><span className="badge badge-gray">{a.kategorie}</span></td>
                      <td style={{ fontWeight: 700, color: a.status === 'leer' ? '#f43f5e' : a.status === 'niedrig' ? '#f59e0b' : '#f8fbff' }}>
                        {a.bestand} {a.einheit}
                      </td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.mindestbestand ?? 0} {a.einheit}</td>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.lagerplatz}</td>
                      <td>
                        <span className={`badge ${a.status === 'ok' ? 'badge-green' : a.status === 'niedrig' ? 'badge-orange' : 'badge-red'}`}>
                          {a.status === 'ok' ? '✅ OK' : a.status === 'niedrig' ? '⚠️ Niedrig' : '🚨 Leer'}
                        </span>
                      </td>
                      {!isDemo && (
                        <td>
                          {deleteConfirmId === a.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button
                                onClick={() => handleDeleteArtikel(a.id)}
                                style={{ background: 'rgba(244,63,94,.18)', border: '1px solid rgba(244,63,94,.4)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                              >
                                Ja, löschen
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#aeb9c8', fontSize: 11, whiteSpace: 'nowrap' }}
                              >
                                Abbrechen
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setModal(a)} title="Bearbeiten" style={{ background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6cb6ff', fontSize: 13 }}>✏️</button>
                              <button onClick={() => setDeleteConfirmId(a.id)} title="Löschen" style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 13 }}>🗑</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BEWEGUNGEN ── */}
      {tab === 'bewegungen' && (
        <div>
          <div style={{ marginBottom: 14, fontSize: 13, color: '#aeb9c8' }}>
            Alle {bewegungen.length} Lagerbewegungen
          </div>
          <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>Typ</th><th>Artikel</th><th>Menge</th><th>Datum</th><th>Mitarbeiter</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {bewegungen.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>🔄 Noch keine Buchungen vorhanden.</td></tr>
                  ) : bewegungen.map(b => (
                    <tr key={b.id}>
                      <td>
                        <span className={`badge ${b.typ === 'Eingang' ? 'badge-green' : b.typ === 'Inventur' ? 'badge-blue' : 'badge-orange'}`}>
                          {b.typ === 'Eingang' ? '📥' : b.typ === 'Inventur' ? '📋' : '📤'} {b.typ}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{b.artikel}</td>
                      <td style={{ fontWeight: 700 }}>{b.menge}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.datum}</td>
                      <td style={{ color: '#aeb9c8' }}>{b.mitarbeiter}</td>
                      <td>
                        <span className={`badge ${b.status === 'KI erkannt' ? 'badge-purple' : 'badge-green'}`}>
                          {b.status === 'KI erkannt' ? '🧠 ' : '✅ '}{b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── WARENEINGANG ── */}
      {tab === 'eingang' && (
        <div style={{ maxWidth: 560 }}>
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800 }}>📥 Wareneingang buchen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel *</label>
                <input className="pk-input" placeholder="Artikelname eingeben oder auswählen" value={newEingang.artikel} onChange={e => setNewEingang(p => ({ ...p, artikel: e.target.value }))} list="ei-artikel-list" />
                <datalist id="ei-artikel-list">{artikel.map(a => <option key={a.id} value={a.name} />)}</datalist>
                {newEingang.artikel && artikel.find(a => a.name === newEingang.artikel) && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#aeb9c8' }}>
                    Aktueller Bestand: <b style={{ color: '#f8fbff' }}>{artikel.find(a => a.name === newEingang.artikel)?.bestand} {artikel.find(a => a.name === newEingang.artikel)?.einheit}</b>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge *</label>
                  <input className="pk-input" placeholder="z.B. 100" type="number" min="1" value={newEingang.menge} onChange={e => setNewEingang(p => ({ ...p, menge: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Lagerplatz</label>
                  <input className="pk-input" placeholder="z.B. A-01-03" value={newEingang.lagerplatz} onChange={e => setNewEingang(p => ({ ...p, lagerplatz: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mitarbeiter</label>
                <input className="pk-input" placeholder="Name des Mitarbeiters" value={newEingang.mitarbeiter} onChange={e => setNewEingang(p => ({ ...p, mitarbeiter: e.target.value }))} />
              </div>
              <button className="pk-btn" onClick={handleEingang} disabled={saving || !newEingang.artikel || !newEingang.menge} style={{ fontWeight: 700, minHeight: 44 }}>
                {saving ? '⏳ Wird gebucht…' : '📥 Wareneingang buchen'}
              </button>
            </div>
          </div>
          <div className="pk-card" style={{ background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.15)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22 }}>🧠</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>KI-Erkennung</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>Lieferschein fotografieren → Daten automatisch erfassen</div>
                <button className="pk-btn-ghost" onClick={() => window.location.href = '/dashboard/ki-erkennung'} style={{ fontSize: 12, marginTop: 10, padding: '7px 14px' }}>📸 KI Erkennung öffnen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WARENAUSGANG ── */}
      {tab === 'ausgang' && (
        <div style={{ maxWidth: 560 }}>
          <div className="pk-card">
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800 }}>📤 Warenausgang buchen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel *</label>
                <input className="pk-input" placeholder="Artikelname eingeben oder auswählen" value={newAusgang.artikel} onChange={e => setNewAusgang(p => ({ ...p, artikel: e.target.value }))} list="au-artikel-list" />
                <datalist id="au-artikel-list">{artikel.map(a => <option key={a.id} value={a.name} />)}</datalist>
                {newAusgang.artikel && (() => {
                  const found = artikel.find(a => a.name === newAusgang.artikel)
                  if (!found) return null
                  return (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      Verfügbar: <b style={{ color: found.bestand === 0 ? '#f43f5e' : found.bestand <= (found.mindestbestand ?? 0) ? '#f59e0b' : '#4ddb7e' }}>
                        {found.bestand} {found.einheit}
                      </b>
                    </div>
                  )
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge *</label>
                  <input className="pk-input" placeholder="z.B. 50" type="number" min="1" value={newAusgang.menge} onChange={e => setNewAusgang(p => ({ ...p, menge: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Empfänger / Auftrag</label>
                  <input className="pk-input" placeholder="z.B. A-2025-034" value={newAusgang.empfaenger} onChange={e => setNewAusgang(p => ({ ...p, empfaenger: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mitarbeiter</label>
                <input className="pk-input" placeholder="Name des Mitarbeiters" value={newAusgang.mitarbeiter} onChange={e => setNewAusgang(p => ({ ...p, mitarbeiter: e.target.value }))} />
              </div>
              <button className="pk-btn" onClick={handleAusgang} disabled={saving || !newAusgang.artikel || !newAusgang.menge} style={{ fontWeight: 700, minHeight: 44, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                {saving ? '⏳ Wird gebucht…' : '📤 Warenausgang buchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVENTUR ── */}
      {tab === 'inventur' && (
        <div>
          <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', fontSize: 13, color: '#aeb9c8' }}>
            📋 <b style={{ color: '#f8fbff' }}>Inventur-Modus:</b> Trage den gezählten Ist-Bestand ein. Nur ausgefüllte Felder werden aktualisiert.
          </div>
          <div className="pk-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Art.-Nr.</th><th>Bezeichnung</th><th>Einheit</th>
                    <th>Soll (System)</th><th>Ist-Bestand (Zählung)</th><th>Differenz</th>
                  </tr>
                </thead>
                <tbody>
                  {artikel.map(a => {
                    const istVal = inventurWerte[a.id]
                    const ist = istVal !== undefined && istVal !== '' ? parseInt(istVal) : null
                    const diff = ist !== null ? ist - a.bestand : null
                    return (
                      <tr key={a.id}>
                        <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td style={{ color: '#aeb9c8' }}>{a.einheit}</td>
                        <td style={{ fontWeight: 700 }}>{a.bestand}</td>
                        <td>
                          <input
                            type="number" min="0"
                            placeholder={String(a.bestand)}
                            value={inventurWerte[a.id] ?? ''}
                            onChange={e => setInventurWerte(p => ({ ...p, [a.id]: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 10px', color: '#f8fbff', fontSize: 14, width: 90, outline: 'none' }}
                          />
                        </td>
                        <td style={{ fontWeight: 700, color: diff === null ? '#aeb9c8' : diff > 0 ? '#4ddb7e' : diff < 0 ? '#f43f5e' : '#aeb9c8' }}>
                          {diff === null ? '—' : diff > 0 ? `+${diff}` : String(diff)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleInventurSave} disabled={saving || Object.keys(inventurWerte).length === 0} style={{ fontWeight: 700 }}>
              {saving ? '⏳ Speichert…' : '✅ Inventur speichern'}
            </button>
            <button className="pk-btn-ghost" onClick={() => setInventurWerte({})} style={{ fontSize: 13 }}>Zurücksetzen</button>
          </div>
        </div>
      )}

      {/* ── BESTELLVORSCHLAG ── */}
      {tab === 'bestellung' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 13, color: '#fbbf24', flex: 1, minWidth: 200 }}>
              🛒 <b>{bestellArtikel.length} Artikel</b> benötigen eine Nachbestellung (Bestand leer oder unter Mindestbestand)
            </div>
          </div>

          {bestellArtikel.length === 0 ? (
            <div className="pk-card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Alle Bestände ausreichend</div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>Aktuell sind alle Artikel über dem Mindestbestand.</div>
            </div>
          ) : (
            <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Art.-Nr.</th>
                      <th>Bezeichnung</th>
                      <th>Kategorie</th>
                      <th>Aktueller Bestand</th>
                      <th>Mindestbestand</th>
                      <th>Vorschlag-Menge</th>
                      <th style={{ width: 160 }}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestellArtikel.map(a => {
                      const bestellt = bestelltIds.has(a.id)
                      return (
                        <tr key={a.id} style={{ opacity: bestellt ? 0.55 : 1 }}>
                          <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                          <td style={{ fontWeight: 600 }}>{a.name}</td>
                          <td><span className="badge badge-gray">{a.kategorie}</span></td>
                          <td style={{ fontWeight: 700, color: a.status === 'leer' ? '#f43f5e' : '#f59e0b' }}>
                            {a.bestand} {a.einheit}
                            <span style={{ marginLeft: 6 }}>
                              <span className={`badge ${a.status === 'leer' ? 'badge-red' : 'badge-orange'}`} style={{ fontSize: 10 }}>
                                {a.status === 'leer' ? '🚨 Leer' : '⚠️ Niedrig'}
                              </span>
                            </span>
                          </td>
                          <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.mindestbestand ?? 0} {a.einheit}</td>
                          <td>
                            {bestellt ? (
                              <span style={{ color: '#aeb9c8', fontSize: 13 }}>{getBestellMenge(a)} {a.einheit}</span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min="1"
                                  value={getBestellMenge(a)}
                                  onChange={e => setBestellMengen(p => ({ ...p, [a.id]: e.target.value }))}
                                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '5px 8px', color: '#f8fbff', fontSize: 13, width: 80, outline: 'none' }}
                                />
                                <span style={{ color: '#aeb9c8', fontSize: 12 }}>{a.einheit}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {bestellt ? (
                              <span className="badge badge-green" style={{ fontSize: 11 }}>✅ Bestellt</span>
                            ) : (
                              <button
                                onClick={() => handleBestellungAusloesen(a.id)}
                                style={{
                                  background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.35)',
                                  borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
                                  color: '#6cb6ff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                                }}
                              >
                                🛒 Bestellung auslösen
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bestelltIds.size > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#aeb9c8' }}>{bestelltIds.size} Bestellung(en) ausgelöst</span>
              <button
                className="pk-btn-ghost"
                onClick={() => setBestelltIds(new Set())}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                Zurücksetzen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
