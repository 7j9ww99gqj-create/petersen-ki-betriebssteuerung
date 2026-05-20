'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import {
  getQmZeichnung,
  getQmZeichnungsSignedUrl,
  upsertQmZeichnung,
  type QmErkanntesMass,
  type QmZeichnung,
} from '@/lib/db/qm'

const QM_COLOR = '#14b8a6'

type AnalyseResult = {
  masse?: Array<{
    name?: string
    wert?: number
    einheit?: string
    toleranz_plus?: number | null
    toleranz_minus?: number | null
    kritisch?: boolean
    konfidenz?: number
  }>
  material?: string | null
  oberflaeche?: { ra?: number | null; rz?: number | null; anforderung?: string | null } | null
  beschichtung?: string | null
  sonderanforderungen?: string[]
  zeichnungsnummer?: string | null
  revision?: string | null
  gesamt_konfidenz?: number
}

const DEMO_ZEICHNUNG: QmZeichnung = {
  id: 'demo-1', user_id: 'demo', name: 'Stempel-B Rev.A',
  zeichnungsnummer: 'ZN-2041', revision: 'A',
  datei_pfad: null, material: 'C45',
  oberflaeche_anforderung: 'Ra 0.8', beschichtung: 'verzinkt 8µm',
  sonderanforderungen: ['entgraten', 'scharfkantig verboten'],
  ki_konfidenz: 92,
  erkannte_masse: [
    { name: 'Länge', wert: 150, einheit: 'mm', toleranz_plus: 0.1, toleranz_minus: 0.1, kritisch: false, konfidenz: 95 },
    { name: 'Ø Bohrung', wert: 12, einheit: 'mm', toleranz_plus: 0.02, toleranz_minus: 0.02, kritisch: true, konfidenz: 88 },
    { name: 'Breite', wert: 40, einheit: 'mm', toleranz_plus: 0.2, toleranz_minus: 0.2, kritisch: false, konfidenz: 91 },
  ],
  erstellt_am: '2026-05-19T08:00:00Z',
}

function konfidenzColor(k: number | null | undefined): { bg: string; color: string; label: string } {
  if (k === null || k === undefined) return { bg: 'rgba(174,185,200,.1)', color: '#aeb9c8', label: '—' }
  if (k >= 85) return { bg: 'rgba(16,185,129,.15)', color: '#10b981', label: `${k}%` }
  if (k >= 70) return { bg: 'rgba(245,158,11,.15)', color: '#f59e0b', label: `${k}%` }
  return { bg: 'rgba(239,68,68,.15)', color: '#ef4444', label: `${k}%` }
}

export default function QmZeichnungDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id ?? '')
  const isDemo = hasDemoCookie()

  const [zeichnung, setZeichnung] = useState<QmZeichnung | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Editable fields
  const [name, setName] = useState('')
  const [zeichnungsnummer, setZeichnungsnummer] = useState('')
  const [revision, setRevision] = useState('')
  const [material, setMaterial] = useState('')
  const [oberflaeche, setOberflaeche] = useState('')
  const [beschichtung, setBeschichtung] = useState('')
  const [sonder, setSonder] = useState('')
  const [masse, setMasse] = useState<QmErkanntesMass[]>([])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const applyZeichnung = useCallback((z: QmZeichnung) => {
    setZeichnung(z)
    setName(z.name ?? '')
    setZeichnungsnummer(z.zeichnungsnummer ?? '')
    setRevision(z.revision ?? '')
    setMaterial(z.material ?? '')
    setOberflaeche(z.oberflaeche_anforderung ?? '')
    setBeschichtung(z.beschichtung ?? '')
    setSonder((z.sonderanforderungen ?? []).join(', '))
    setMasse(z.erkannte_masse ?? [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDemo) {
        applyZeichnung(DEMO_ZEICHNUNG)
        setPreviewUrl(null)
      } else {
        const z = await getQmZeichnung(id)
        if (!z) {
          setError('Zeichnung nicht gefunden.')
          setZeichnung(null)
        } else {
          applyZeichnung(z)
          if (z.datei_pfad) {
            const url = await getQmZeichnungsSignedUrl(z.datei_pfad).catch(() => null)
            setPreviewUrl(url)
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }, [id, isDemo, applyZeichnung])

  useEffect(() => { void load() }, [load])

  async function runAnalyse() {
    if (isDemo) { showToast('Demo-Modus: KI-Analyse deaktiviert', false); return }
    if (!zeichnung?.datei_pfad) { showToast('Keine Datei zum Analysieren', false); return }
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/qm/analyse-zeichnung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datei_path: zeichnung.datei_pfad }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.detail || body?.error || `HTTP ${res.status}`)
      const r = body as AnalyseResult
      const neueMasse: QmErkanntesMass[] = Array.isArray(r.masse)
        ? r.masse.map(m => ({
            name: String(m.name ?? ''),
            wert: Number(m.wert ?? 0),
            einheit: String(m.einheit ?? 'mm'),
            toleranz_plus: m.toleranz_plus ?? null,
            toleranz_minus: m.toleranz_minus ?? null,
            kritisch: Boolean(m.kritisch),
            konfidenz: m.konfidenz ?? undefined,
          }))
        : []
      setMasse(neueMasse)
      if (r.material) setMaterial(r.material)
      if (r.oberflaeche?.anforderung) setOberflaeche(r.oberflaeche.anforderung)
      else if (r.oberflaeche?.ra) setOberflaeche(`Ra ${r.oberflaeche.ra}`)
      if (r.beschichtung) setBeschichtung(r.beschichtung)
      if (r.zeichnungsnummer) setZeichnungsnummer(r.zeichnungsnummer)
      if (r.revision) setRevision(r.revision)
      if (Array.isArray(r.sonderanforderungen)) setSonder(r.sonderanforderungen.join(', '))
      const konf = typeof r.gesamt_konfidenz === 'number' ? r.gesamt_konfidenz : null
      // Direkt speichern, damit Refresh nicht verloren geht
      const saved = await upsertQmZeichnung({
        id: zeichnung.id,
        name: name || zeichnung.name,
        zeichnungsnummer: r.zeichnungsnummer ?? zeichnungsnummer ?? null,
        revision: r.revision ?? revision ?? null,
        datei_pfad: zeichnung.datei_pfad,
        material: r.material ?? material ?? null,
        oberflaeche_anforderung: r.oberflaeche?.anforderung ?? oberflaeche ?? null,
        beschichtung: r.beschichtung ?? beschichtung ?? null,
        sonderanforderungen: Array.isArray(r.sonderanforderungen) ? r.sonderanforderungen : (sonder ? sonder.split(',').map(s => s.trim()).filter(Boolean) : null),
        ki_konfidenz: konf,
        erkannte_masse: neueMasse,
      })
      applyZeichnung(saved)
      showToast(`KI-Analyse abgeschlossen (${neueMasse.length} Maße)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'KI-Analyse fehlgeschlagen.'
      setError(msg)
      showToast(msg, false)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (isDemo) { showToast('Demo-Modus: Speichern deaktiviert', false); return }
    if (!zeichnung) return
    setSaving(true)
    try {
      const saved = await upsertQmZeichnung({
        id: zeichnung.id,
        name: name.trim() || 'Unbenannt',
        zeichnungsnummer: zeichnungsnummer.trim() || null,
        revision: revision.trim() || null,
        datei_pfad: zeichnung.datei_pfad,
        material: material.trim() || null,
        oberflaeche_anforderung: oberflaeche.trim() || null,
        beschichtung: beschichtung.trim() || null,
        sonderanforderungen: sonder.trim() ? sonder.split(',').map(s => s.trim()).filter(Boolean) : null,
        ki_konfidenz: zeichnung.ki_konfidenz,
        erkannte_masse: masse,
      })
      applyZeichnung(saved)
      showToast('Änderungen gespeichert')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.', false)
    } finally {
      setSaving(false)
    }
  }

  function updateMass(idx: number, patch: Partial<QmErkanntesMass>) {
    setMasse(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m))
  }

  function deleteMass(idx: number) {
    setMasse(prev => prev.filter((_, i) => i !== idx))
  }

  function addMass() {
    setMasse(prev => [...prev, { name: '', wert: 0, einheit: 'mm', toleranz_plus: null, toleranz_minus: null, kritisch: false }])
  }

  function startPruefbericht() {
    if (!zeichnung) return
    router.push(`/dashboard/qm/pruefen?zeichnung=${zeichnung.id}`)
  }

  const konfBadge = konfidenzColor(zeichnung?.ki_konfidenz ?? null)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: `${QM_COLOR}18`, border: `1px solid ${QM_COLOR}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>📐</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-.03em' }}>
            {zeichnung?.name || 'Zeichnung'}
          </h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
            {zeichnung?.zeichnungsnummer ? `${zeichnung.zeichnungsnummer}${zeichnung.revision ? ' Rev.' + zeichnung.revision : ''}` : 'Zeichnungs-Details'}
          </p>
        </div>
        {zeichnung?.ki_konfidenz !== null && zeichnung?.ki_konfidenz !== undefined && (
          <span style={{
            padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: konfBadge.bg, color: konfBadge.color,
          }}>
            KI {konfBadge.label}
          </span>
        )}
        <Link href="/dashboard/qm/zeichnungen" className="pk-btn-ghost" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none' }}>
          ← Bibliothek
        </Link>
      </div>

      {error && (
        <div className="pk-card" style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,.4)', color: '#ff8080' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="pk-card" style={{ padding: 30, textAlign: 'center', color: '#aeb9c8' }}>Lade…</div>
      ) : !zeichnung ? (
        <div className="pk-card" style={{ padding: 30, textAlign: 'center', color: '#aeb9c8' }}>Zeichnung nicht gefunden.</div>
      ) : (
        <>
          {/* Vorschau + KI-Analyse-Button */}
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{
                width: 220, height: 220, borderRadius: 14, flexShrink: 0,
                background: `${QM_COLOR}10`, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60,
              }}>
                {previewUrl
                  ? <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : '📐'}
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🤖 KI-Analyse</div>
                <p style={{ color: '#aeb9c8', fontSize: 13, marginBottom: 14 }}>
                  Lasse OpenAI Vision Maße, Toleranzen, Material und Oberflächen-Anforderungen erkennen.
                  Die Ergebnisse werden direkt übernommen und können unten korrigiert werden.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    className="pk-btn"
                    disabled={analyzing || !zeichnung.datei_pfad}
                    onClick={() => void runAnalyse()}
                    style={{ background: QM_COLOR, border: 'none' }}
                  >
                    {analyzing ? '⏳ Analysiere…' : '✨ KI-Analyse starten'}
                  </button>
                  <button
                    className="pk-btn"
                    onClick={startPruefbericht}
                    style={{ background: '#1684ff', border: 'none' }}
                  >
                    📋 Prüfbericht starten
                  </button>
                </div>
                {!zeichnung.datei_pfad && (
                  <div style={{ marginTop: 10, color: '#f59e0b', fontSize: 12 }}>
                    ⚠️ Keine Datei hinterlegt — KI-Analyse benötigt eine hochgeladene Zeichnung.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stammdaten (editierbar) */}
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>📝 Stammdaten</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Name">
                <input className="pk-input" value={name} onChange={e => setName(e.target.value)} />
              </Field>
              <Field label="Zeichnungs-Nr.">
                <input className="pk-input" value={zeichnungsnummer} onChange={e => setZeichnungsnummer(e.target.value)} />
              </Field>
              <Field label="Revision">
                <input className="pk-input" value={revision} onChange={e => setRevision(e.target.value)} />
              </Field>
              <Field label="Material">
                <input className="pk-input" value={material} onChange={e => setMaterial(e.target.value)} placeholder="z.B. C45" />
              </Field>
              <Field label="Oberfläche">
                <input className="pk-input" value={oberflaeche} onChange={e => setOberflaeche(e.target.value)} placeholder="z.B. Ra 0.8" />
              </Field>
              <Field label="Beschichtung">
                <input className="pk-input" value={beschichtung} onChange={e => setBeschichtung(e.target.value)} placeholder="z.B. verzinkt 8µm" />
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Sonderanforderungen (komma-getrennt)">
                <input className="pk-input" value={sonder} onChange={e => setSonder(e.target.value)} placeholder="entgraten, scharfkantig verboten" />
              </Field>
            </div>
          </div>

          {/* Erkannte Maße (editierbar) */}
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>📏 Erkannte Maße & Toleranzen</span>
              <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 999, background: `${QM_COLOR}20`, color: QM_COLOR, fontSize: 11, fontWeight: 700 }}>
                {masse.length}
              </span>
            </div>
            {masse.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#aeb9c8' }}>
                Noch keine Maße erkannt — starte die KI-Analyse oder füge manuell hinzu.
              </div>
            ) : (
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Messstelle</th>
                      <th>Sollwert</th>
                      <th>Tol +</th>
                      <th>Tol −</th>
                      <th>Einheit</th>
                      <th>Kritisch</th>
                      <th>Konf.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {masse.map((m, i) => {
                      const k = konfidenzColor(m.konfidenz)
                      return (
                        <tr key={i}>
                          <td><input className="pk-input" value={m.name} onChange={e => updateMass(i, { name: e.target.value })} style={{ minWidth: 120 }} /></td>
                          <td><input type="number" step="any" className="pk-input" value={m.wert} onChange={e => updateMass(i, { wert: Number(e.target.value) })} style={{ width: 90 }} /></td>
                          <td><input type="number" step="any" className="pk-input" value={m.toleranz_plus ?? ''} onChange={e => updateMass(i, { toleranz_plus: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 80 }} /></td>
                          <td><input type="number" step="any" className="pk-input" value={m.toleranz_minus ?? ''} onChange={e => updateMass(i, { toleranz_minus: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 80 }} /></td>
                          <td><input className="pk-input" value={m.einheit} onChange={e => updateMass(i, { einheit: e.target.value })} style={{ width: 70 }} /></td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={!!m.kritisch} onChange={e => updateMass(i, { kritisch: e.target.checked })} />
                          </td>
                          <td>
                            {m.konfidenz !== undefined && (
                              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: k.bg, color: k.color }}>
                                {k.label}
                              </span>
                            )}
                          </td>
                          <td>
                            <button onClick={() => deleteMass(i)} style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 14 }} title="Entfernen">🗑️</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button className="pk-btn-ghost" onClick={addMass} style={{ fontSize: 12, padding: '6px 12px' }}>+ Messstelle hinzufügen</button>
            </div>
          </div>

          {/* Speichern */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="pk-btn"
              disabled={saving}
              onClick={() => void handleSave()}
              style={{ background: QM_COLOR, border: 'none' }}
            >
              {saving ? '⏳ Speichere…' : '💾 Änderungen speichern'}
            </button>
            <button
              className="pk-btn"
              onClick={startPruefbericht}
              style={{ background: '#1684ff', border: 'none' }}
            >
              📋 Prüfbericht starten →
            </button>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
          padding: '14px 20px', borderRadius: 12, maxWidth: 380,
          background: toast.ok ? 'rgba(37,211,102,.12)' : 'rgba(255,80,80,.15)',
          border: `1px solid ${toast.ok ? 'rgba(37,211,102,.35)' : 'rgba(255,80,80,.4)'}`,
          color: toast.ok ? '#4ddb7e' : '#ff8080',
          fontSize: 14, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#aeb9c8', fontWeight: 700, letterSpacing: '.03em' }}>{label}</span>
      {children}
    </label>
  )
}
