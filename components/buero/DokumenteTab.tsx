'use client'
import React, { useState, useEffect, useRef } from 'react'
import { getBueroDokumente, insertBueroDokument, updateBueroDokument, deleteBueroDokument, uploadDokument, getDokumentUrl } from '@/lib/db'
import { createSupabaseClient } from '@/lib/supabase'
import DocumentPreviewModal from '@/components/DocumentPreviewModal'
import { Toast, DeleteConfirm, labelStyle } from './shared'
import type { Dokument } from '@/types/buero'
import { demoDokumente, getDocumentRelationLabel, resolveDocumentViewUrl } from '@/types/buero'
import type { StoredDocumentLink } from '@/lib/documents'
import { genId } from '@/lib/ids'

// suppress unused import warning - getDokumentUrl and updateBueroDokument are available for future use
void getDokumentUrl
void updateBueroDokument
void labelStyle

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
      setPreviewUrl(await resolveDocumentViewUrl(doc as unknown as StoredDocumentLink))
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
          document={previewDoc as unknown as StoredDocumentLink}
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

export default DokumenteTab
