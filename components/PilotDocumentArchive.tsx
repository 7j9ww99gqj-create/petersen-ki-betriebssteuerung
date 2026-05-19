'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { useGlobalToast } from '@/components/ui/ToastProvider'

export type PilotType = 'lager' | 'werkstatt' | 'analyse' | 'planung'

interface PilotDocument {
  id: string
  pilot_type: PilotType
  document_name: string
  document_type: string
  file_path: string | null
  file_url: string | null
  file_size: number | null
  mime_type: string | null
  uploaded_at: string
  created_by: string | null
  tags: string[] | null
  description: string | null
  category: string | null
}

const DOC_TYPES = ['PDF', 'Bild', 'Tabelle', 'Textdokument', 'Sonstiges']
const PILOT_COLOR: Record<PilotType, string> = {
  lager: '#1684ff',
  werkstatt: '#a78bfa',
  analyse: '#10b981',
  planung: '#f43f5e',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '–'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const DEMO_DOCS: PilotDocument[] = [
  {
    id: 'demo-1', pilot_type: 'lager', document_name: 'Lieferschein_2026_01.pdf',
    document_type: 'PDF', file_path: null, file_url: null, file_size: 102400,
    mime_type: 'application/pdf', uploaded_at: '2026-05-15T10:00:00Z',
    created_by: null, tags: ['lieferschein'], description: 'Lieferschein Januar 2026', category: 'Lieferschein',
  },
  {
    id: 'demo-2', pilot_type: 'werkstatt', document_name: 'Wartungsprotokoll_Maschine_A.pdf',
    document_type: 'PDF', file_path: null, file_url: null, file_size: 204800,
    mime_type: 'application/pdf', uploaded_at: '2026-05-10T08:30:00Z',
    created_by: null, tags: ['wartung', 'maschine-a'], description: 'Wartungsprotokoll Maschine A', category: 'Wartung',
  },
]

interface Props {
  pilotType: PilotType
}

export default function PilotDocumentArchive({ pilotType }: Props) {
  const isDemo = hasDemoCookie()
  const color = PILOT_COLOR[pilotType]

  const [docs, setDocs] = useState<PilotDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('Alle')
  const [uploading, setUploading] = useState(false)
  const toast = useGlobalToast()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload-Formular State
  const [uploadForm, setUploadForm] = useState({
    document_name: '',
    document_type: 'PDF',
    category: '',
    description: '',
    tags: '',
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const showToast = (msg: string, ok = true) => {
    if (ok) toast.success(msg); else toast.error(msg)
  }

  const loadDocs = useCallback(async () => {
    setLoading(true)
    if (isDemo) {
      setDocs(DEMO_DOCS.filter(d => d.pilot_type === pilotType))
      setLoading(false)
      return
    }
    if (!isSupabaseConfigured()) { setLoading(false); return }
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from('pilot_documents')
        .select('*')
        .eq('pilot_type', pilotType)
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      setDocs((data as PilotDocument[]) ?? [])
    } catch (err) {
      console.error('Dokumente laden:', err)
    } finally {
      setLoading(false)
    }
  }, [isDemo, pilotType])

  useEffect(() => { void loadDocs() }, [loadDocs])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    if (!uploadForm.document_name) {
      setUploadForm(f => ({ ...f, document_name: file.name }))
    }
    // Dokument-Typ aus MIME ableiten
    if (file.type === 'application/pdf') setUploadForm(f => ({ ...f, document_type: 'PDF' }))
    else if (file.type.startsWith('image/')) setUploadForm(f => ({ ...f, document_type: 'Bild' }))
    else if (file.type.includes('spreadsheet') || file.type.includes('excel')) setUploadForm(f => ({ ...f, document_type: 'Tabelle' }))
    else if (file.type.includes('word') || file.type.includes('document')) setUploadForm(f => ({ ...f, document_type: 'Textdokument' }))
  }

  const handleUpload = async () => {
    if (!uploadForm.document_name.trim()) { showToast('Bitte Dokumentname eingeben', false); return }
    if (isDemo) { showToast('Demo-Modus: Kein Upload möglich', false); return }
    if (!isSupabaseConfigured()) { showToast('Supabase nicht konfiguriert', false); return }

    setUploading(true)
    try {
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()

      let fileUrl: string | null = null
      let filePath: string | null = null
      let fileSize: number | null = null
      let mimeType: string | null = null

      if (uploadFile) {
        const ext = uploadFile.name.split('.').pop() ?? 'bin'
        const path = `${pilotType}/${user?.id ?? 'anon'}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('pilot-documents')
          .upload(path, uploadFile, { upsert: false })
        if (uploadErr) {
          // Bucket existiert eventuell noch nicht – trotzdem Eintrag anlegen
          console.warn('Storage-Upload fehlgeschlagen (Bucket vorhanden?):', uploadErr.message)
        } else {
          const { data: urlData } = supabase.storage.from('pilot-documents').getPublicUrl(path)
          fileUrl = urlData?.publicUrl ?? null
          filePath = path
          fileSize = uploadFile.size
          mimeType = uploadFile.type
        }
      }

      const tagsArr = uploadForm.tags
        ? uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        : null

      const { error: insertErr } = await supabase.from('pilot_documents').insert({
        pilot_type: pilotType,
        document_name: uploadForm.document_name.trim(),
        document_type: uploadForm.document_type,
        category: uploadForm.category.trim() || null,
        description: uploadForm.description.trim() || null,
        tags: tagsArr,
        file_url: fileUrl,
        file_path: filePath,
        file_size: fileSize,
        mime_type: mimeType,
        created_by: user?.id ?? null,
      })
      if (insertErr) throw insertErr

      showToast('Dokument gespeichert')
      setShowUploadModal(false)
      setUploadForm({ document_name: '', document_type: 'PDF', category: '', description: '', tags: '' })
      setUploadFile(null)
      await loadDocs()
    } catch (err) {
      console.error(err)
      showToast('Fehler beim Speichern', false)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (isDemo) { showToast('Demo-Modus: Kein Löschen möglich', false); return }
    if (!isSupabaseConfigured()) return
    try {
      const supabase = createSupabaseClient()
      const doc = docs.find(d => d.id === id)
      if (doc?.file_path) {
        await supabase.storage.from('pilot-documents').remove([doc.file_path])
      }
      const { error } = await supabase.from('pilot_documents').delete().eq('id', id)
      if (error) throw error
      setDocs(prev => prev.filter(d => d.id !== id))
      setDeleteConfirm(null)
      showToast('Dokument gelöscht')
    } catch {
      showToast('Fehler beim Löschen', false)
    }
  }

  const filtered = docs.filter(d => {
    const matchType = filterType === 'Alle' || d.document_type === filterType
    const q = search.toLowerCase()
    const matchSearch = !q
      || d.document_name.toLowerCase().includes(q)
      || (d.description ?? '').toLowerCase().includes(q)
      || (d.category ?? '').toLowerCase().includes(q)
    return matchType && matchSearch
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <input
          className="pk-input"
          placeholder="🔍 Dokument suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select
          className="pk-input"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="Alle">Alle Typen</option>
          {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button
          className="pk-btn"
          onClick={() => setShowUploadModal(true)}
          style={{ background: color, marginLeft: 'auto' }}
        >
          + Dokument hochladen
        </button>
      </div>

      {/* Ergebnis-Info */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
        {loading ? 'Lade…' : `${filtered.length} von ${docs.length} Dokumenten`}
      </div>

      {/* Dokument-Liste */}
      {!loading && filtered.length === 0 ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          background: 'rgba(255,255,255,.03)', borderRadius: 12,
          border: '1px dashed rgba(255,255,255,.1)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ color: '#aeb9c8', fontSize: 14 }}>
            {docs.length === 0 ? 'Noch keine Dokumente vorhanden.' : 'Keine Dokumente gefunden.'}
          </div>
          {docs.length === 0 && (
            <button
              className="pk-btn"
              onClick={() => setShowUploadModal(true)}
              style={{ marginTop: 14, background: color }}
            >
              Erstes Dokument hochladen
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(doc => (
            <div
              key={doc.id}
              style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {doc.document_type === 'PDF' ? '📄'
                  : doc.document_type === 'Bild' ? '🖼️'
                  : doc.document_type === 'Tabelle' ? '📊'
                  : doc.document_type === 'Textdokument' ? '📝'
                  : '📎'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fbff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.document_name}
                </div>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>
                  {doc.document_type}
                  {doc.category ? ` · ${doc.category}` : ''}
                  {' · '}
                  {formatDate(doc.uploaded_at)}
                  {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                </div>
                {doc.description && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.description}
                  </div>
                )}
              </div>

              {/* Aktionen */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 6,
                      background: 'rgba(22,132,255,.12)', color: '#6cb6ff',
                      textDecoration: 'none', fontWeight: 600,
                    }}
                  >
                    ↓ Download
                  </a>
                )}
                {deleteConfirm === doc.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6,
                        background: 'rgba(244,63,94,.15)', color: '#fb7185',
                        border: 'none', cursor: 'pointer', fontWeight: 600,
                      }}
                    >Ja, löschen</button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6,
                        background: 'rgba(255,255,255,.06)', color: '#aeb9c8',
                        border: 'none', cursor: 'pointer',
                      }}
                    >Abbrechen</button>
                  </>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(doc.id)}
                    style={{
                      fontSize: 14, padding: '5px 8px', borderRadius: 6,
                      background: 'transparent', color: '#6b7280',
                      border: 'none', cursor: 'pointer',
                    }}
                    title="Löschen"
                  >🗑️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <Modal title="Dokument hochladen" onClose={() => setShowUploadModal(false)} maxWidth={560}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Datei-Upload Bereich */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                style={{
                  border: `2px dashed ${uploadFile ? color : 'rgba(255,255,255,.2)'}`,
                  borderRadius: 10, padding: '20px 16px', textAlign: 'center',
                  cursor: 'pointer', transition: 'border-color .15s',
                  background: uploadFile ? color + '08' : 'transparent',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx,.txt"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {uploadFile ? (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fbff' }}>{uploadFile.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{formatBytes(uploadFile.size)}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 13, color: '#aeb9c8' }}>Klicken zum Auswählen</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>PDF, Bilder, Excel, Word</div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="upload-document-name" style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>Dokumentname *</label>
                <input
                  id="upload-document-name"
                  className="pk-input"
                  value={uploadForm.document_name}
                  onChange={e => setUploadForm(f => ({ ...f, document_name: e.target.value }))}
                  placeholder="z.B. Lieferschein 2026-01"
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="upload-document-type" style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>Dokumenttyp</label>
                  <select
                    id="upload-document-type"
                    className="pk-input"
                    value={uploadForm.document_type}
                    onChange={e => setUploadForm(f => ({ ...f, document_type: e.target.value }))}
                  >
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="upload-category" style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>Kategorie</label>
                  <input
                    id="upload-category"
                    className="pk-input"
                    value={uploadForm.category}
                    onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="z.B. Lieferschein, Wartung…"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="upload-description" style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>Beschreibung (optional)</label>
                <textarea
                  id="upload-description"
                  className="pk-input"
                  value={uploadForm.description}
                  onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Kurze Beschreibung des Dokuments…"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div>
                <label htmlFor="upload-tags" style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>Tags (kommagetrennt, optional)</label>
                <input
                  id="upload-tags"
                  className="pk-input"
                  value={uploadForm.tags}
                  onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="z.B. wichtig, archiv, 2026"
                />
              </div>

              {isDemo && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)',
                  color: '#fbbf24', fontSize: 12,
                }}>
                  ⚠️ Demo-Modus: Upload nicht möglich. Im Live-Betrieb wird die Datei in Supabase Storage gespeichert.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
                  className="pk-btn-ghost"
                  onClick={() => setShowUploadModal(false)}
                >Abbrechen</button>
                <button
                  className="pk-btn"
                  onClick={handleUpload}
                  disabled={uploading || !uploadForm.document_name.trim()}
                  style={{ background: color }}
                >
                  {uploading ? '⏳ Speichern…' : '💾 Speichern'}
                </button>
              </div>
            </div>
        </Modal>
      )}
    </div>
  )
}
