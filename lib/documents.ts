export type StoredDocumentLink = {
  id?: string
  name?: string
  typ?: string
  storage_path?: string
  dokument_url?: string
  dokument_id?: string
}

const SUPABASE_STORAGE_MARKERS = [
  '/object/sign/dokumente/',
  '/object/public/dokumente/',
]

export function normalizeDocumentStoragePath(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return ''

  for (const marker of SUPABASE_STORAGE_MARKERS) {
    if (pathOrUrl.includes(marker)) {
      return decodeURIComponent(pathOrUrl.split(marker)[1]?.split('?')[0] ?? '')
    }
  }

  if (pathOrUrl.startsWith('dokumente/')) {
    return pathOrUrl.slice('dokumente/'.length)
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl
  }

  return pathOrUrl
}

export function inferDocumentPreviewType(nameOrType?: string | null) {
  const value = (nameOrType ?? '').toLowerCase()
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(value) || /(png|jpg|jpeg|webp|gif|bmp|svg)/.test(value)) return 'image'
  if (value.endsWith('.pdf') || value === 'pdf' || value.includes('application/pdf')) return 'pdf'
  if (value.endsWith('.doc') || value.endsWith('.docx') || value.includes('word')) return 'office'
  return 'file'
}

export function getDocumentDisplayLabel(doc: StoredDocumentLink) {
  return doc.name || doc.id || doc.dokument_id || 'Dokument'
}
