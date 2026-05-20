'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { hasDemoCookie } from '@/lib/auth'
import { compressImage } from '@/lib/image-compress'
import {
  deleteQmZeichnung,
  deleteQmZeichnungsDatei,
  getQmZeichnungen,
  getQmZeichnungsSignedUrl,
  upsertQmZeichnung,
  uploadQmZeichnungsDatei,
  type QmZeichnung,
} from '@/lib/db/qm'

const QM_COLOR = '#14b8a6'
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

const DEMO_ZEICHNUNGEN: QmZeichnung[] = [
  {
    id: 'demo-1', user_id: 'demo', name: 'Stempel-B Rev.A',
    zeichnungsnummer: 'ZN-2041', revision: 'A',
    datei_pfad: null, material: 'C45',
    oberflaeche_anforderung: 'Ra 0.8', beschichtung: null,
    sonderanforderungen: ['entgraten'], ki_konfidenz: 92,
    erkannte_masse: null, erstellt_am: '2026-05-19T08:00:00Z',
  },
  {
    id: 'demo-2', user_id: 'demo', name: 'Flansch-A Rev.C',
    zeichnungsnummer: 'ZN-2039', revision: 'C',
    datei_pfad: null, material: 'V2A',
    oberflaeche_anforderung: null, beschichtung: 'verzinkt',
    sonderanforderungen: null, ki_konfidenz: 87,
    erkannte_masse: null, erstellt_am: '2026-05-18T10:30:00Z',
  },
]

export default function QmZeichnungenPage() {
  const isDemo = hasDemoCookie()
  const [zeichnungen, setZeichnungen] = useState<QmZeichnung[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadZeichnungen = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDemo) {
        setZeichnungen(DEMO_ZEICHNUNGEN)
      } else {
        const rows = await getQmZeichnungen()
        setZeichnungen(rows)
        const urls: Record<string, string> = {}
        await Promise.all(
          rows.filter(r => r.datei_pfad).map(async r => {
            const url = await getQmZeichnungsSignedUrl(r.datei_pfad as string).catch(() => null)
            if (url) urls[r.id] = url
          }),
        )
        setPreviewUrls(urls)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }, [isDemo])

  useEffect(() => { void loadZeichnungen() }, [loadZeichnungen])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (isDemo) {
      showToast('Demo-Modus: Upload deaktiviert', false)
      return
    }
    setUploading(true)
    setError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(`Datei ${i + 1} / ${files.length} — ${file.name}`)
        let toUpload: File | Blob = file
        let filename = file.name
        if (file.type.startsWith('image/')) {
          try {
            const compressed = await compressImage(file, { maxWidth: 2200, maxHeight: 2200, quality: 0.85, mimeType: 'image/webp' })
            toUpload = compressed.blob
            filename = file.name.replace(/\.[^.]+$/, '') + '.webp'
          } catch {
            toUpload = file
          }
        }
        const path = await uploadQmZeichnungsDatei(toUpload, filename)
        const baseName = file.name.replace(/\.[^.]+$/, '')
        await upsertQmZeichnung({ name: baseName, datei_pfad: path })
      }
      showToast(`${files.length} Zeichnung${files.length === 1 ? '' : 'en'} hochgeladen`)
      await loadZeichnungen()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload fehlgeschlagen.'
      setError(msg)
      showToast(msg, false)
    } finally {
      setUploading(false)
      setProgress('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(z: QmZeichnung) {
    if (isDemo) {
      showToast('Demo-Modus: Löschen deaktiviert', false)
      return
    }
    try {
      if (z.datei_pfad) {
        await deleteQmZeichnungsDatei(z.datei_pfad).catch(() => null)
      }
      await deleteQmZeichnung(z.id)
      setDeleteConfirm(null)
      showToast('Zeichnung gelöscht')
      await loadZeichnungen()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Löschen fehlgeschlagen.'
      showToast(msg, false)
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    void handleFiles(e.dataTransfer.files)
  }

  function fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('de-DE') } catch { return iso }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: `${QM_COLOR}18`, border: `1px solid ${QM_COLOR}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>🖼️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-.03em' }}>
            Zeichnungen <span style={{ color: QM_COLOR }}>·</span> QM-Pilot
          </h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
            Upload, KI-Analyse und Bibliothek aller Zeichnungen
          </p>
        </div>
        {isDemo && (
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,165,0,.12)', border: '1px solid rgba(255,165,0,.25)', color: '#ffb347', fontWeight: 700, letterSpacing: '.05em' }}>
            ● DEMO
          </span>
        )}
        <Link href="/dashboard/qm" className="pk-btn-ghost" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none' }}>
          ← QM-Dashboard
        </Link>
      </div>

      {error && (
        <div className="pk-card" style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,.4)', color: '#ff8080' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Drag&Drop Upload-Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className="pk-card"
        style={{
          marginBottom: 20,
          border: `2px dashed ${dragActive ? QM_COLOR : QM_COLOR + '40'}`,
          textAlign: 'center',
          padding: '40px 20px',
          cursor: uploading ? 'wait' : 'pointer',
          background: dragActive ? `${QM_COLOR}10` : undefined,
          transition: 'all .15s',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>{uploading ? '⏳' : '📤'}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
          {uploading ? (progress || 'Lade hoch…') : 'Zeichnung hochladen'}
        </div>
        <div style={{ color: '#aeb9c8', fontSize: 13, marginBottom: 18 }}>
          PDF, PNG, JPG, WEBP · max. 10 MB · Drag&Drop oder klicken
        </div>
        <button
          type="button"
          className="pk-btn"
          disabled={uploading}
          onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
          style={{ background: QM_COLOR, border: 'none' }}
        >
          📂 Datei auswählen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={e => void handleFiles(e.target.files)}
        />
      </div>

      {/* Zeichnungs-Bibliothek */}
      <div className="pk-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 16 }}>📚</span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>Zeichnungs-Bibliothek</span>
          <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 999, background: `${QM_COLOR}20`, color: QM_COLOR, fontSize: 11, fontWeight: 700 }}>
            {zeichnungen.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#aeb9c8' }}>Lade Zeichnungen…</div>
        ) : zeichnungen.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#aeb9c8' }}>
            Noch keine Zeichnungen — lade die erste oben hoch.
          </div>
        ) : (
          zeichnungen.map(z => (
            <div key={z.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
              borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                background: `${QM_COLOR}15`, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {previewUrls[z.id]
                  ? <img src={previewUrls[z.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '📐'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{z.name}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8' }}>
                  {[
                    z.zeichnungsnummer && `${z.zeichnungsnummer}${z.revision ? ' Rev.' + z.revision : ''}`,
                    z.material && `Material: ${z.material}`,
                    fmtDate(z.erstellt_am),
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              {z.ki_konfidenz !== null && z.ki_konfidenz !== undefined && (
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: z.ki_konfidenz >= 85 ? 'rgba(16,185,129,.15)' : z.ki_konfidenz >= 70 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)',
                  color: z.ki_konfidenz >= 85 ? '#10b981' : z.ki_konfidenz >= 70 ? '#f59e0b' : '#ef4444',
                }}>
                  KI {z.ki_konfidenz}%
                </span>
              )}
              <Link
                href={`/dashboard/qm/zeichnungen/${z.id}`}
                className="pk-btn-ghost"
                style={{ fontSize: 12, padding: '6px 10px', textDecoration: 'none' }}
              >
                Details
              </Link>
              {deleteConfirm === z.id ? (
                <>
                  <button
                    onClick={() => void handleDelete(z)}
                    style={{
                      padding: '6px 10px', borderRadius: 8,
                      background: 'rgba(239,68,68,.18)', border: '1px solid rgba(239,68,68,.4)',
                      color: '#ff8080', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >Ja, löschen</button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '6px 10px', borderRadius: 8,
                      background: 'rgba(174,185,200,.1)', border: '1px solid rgba(174,185,200,.2)',
                      color: '#aeb9c8', fontSize: 12, cursor: 'pointer',
                    }}
                  >Abbrechen</button>
                </>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(z.id)}
                  style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 16, padding: 4 }}
                  title="Löschen"
                >🗑️</button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Toast — nutzt .pk-toast (Position/Animation aus User-Prefs) */}
      {toast && (
        <div className="pk-toast" style={{
          background: toast.ok ? 'rgba(37,211,102,.12)' : 'rgba(255,80,80,.15)',
          border: `1px solid ${toast.ok ? 'rgba(37,211,102,.35)' : 'rgba(255,80,80,.4)'}`,
          color: toast.ok ? '#4ddb7e' : '#ff8080',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
