'use client'

import { getDocumentDisplayLabel, inferDocumentPreviewType, type StoredDocumentLink } from '@/lib/documents'

type Props = {
  document: StoredDocumentLink
  url?: string
  loading?: boolean
  error?: string | null
  onClose: () => void
  onRetry?: () => void
  onOpenExternal?: () => void
}

export default function DocumentPreviewModal({
  document,
  url,
  loading = false,
  error,
  onClose,
  onRetry,
  onOpenExternal,
}: Props) {
  const title = getDocumentDisplayLabel(document)
  const previewType = inferDocumentPreviewType(document.name || document.typ || url)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="pk-card fade-in"
        style={{ width: 'min(1100px, 100%)', height: 'min(82vh, 920px)', display: 'flex', flexDirection: 'column', gap: 14 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#aeb9c8' }}>
              {document.typ || 'Datei'}{document.storage_path || document.dokument_url ? ' · mit Datei verknüpft' : ' · keine gespeicherte Datei'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onOpenExternal && (
              <button className="pk-btn-ghost" onClick={onOpenExternal} style={{ fontSize: 12 }}>
                In neuem Tab öffnen
              </button>
            )}
            <button className="pk-btn-ghost" onClick={onClose} style={{ fontSize: 12 }}>
              Schließen
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 320,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(8,14,24,.88)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <div style={{ color: '#aeb9c8', fontSize: 14 }}>Dokument wird geöffnet…</div>
          ) : error ? (
            <div style={{ maxWidth: 520, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Dokument konnte nicht geöffnet werden</div>
              <div style={{ color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>{error}</div>
              {onRetry && (
                <button className="pk-btn" onClick={onRetry} style={{ marginTop: 16, fontSize: 12 }}>
                  Erneut versuchen
                </button>
              )}
            </div>
          ) : !url ? (
            <div style={{ maxWidth: 520, textAlign: 'center', padding: 24, color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>
              Für diesen Eintrag ist keine Datei hinterlegt.
            </div>
          ) : previewType === 'image' ? (
            <img src={url} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : previewType === 'pdf' ? (
            <iframe src={url} title={title} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
          ) : (
            <div style={{ maxWidth: 520, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📎</div>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Vorschau nicht direkt verfügbar</div>
              <div style={{ color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>
                Diese Datei kann nicht eingebettet angezeigt werden, lässt sich aber in einem neuen Tab öffnen.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
