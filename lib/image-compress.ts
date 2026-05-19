// Bild-Kompression vor Upload — spart Storage + CDN-Egress
// Browser-only (nutzt canvas/Image), darf nicht in API-Routen importiert werden

export interface CompressOptions {
  maxWidth?: number    // default 1600
  maxHeight?: number   // default 1600
  quality?: number     // default 0.82
  mimeType?: 'image/webp' | 'image/jpeg'  // default webp
}

export interface CompressResult {
  blob: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<CompressResult> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82, mimeType = 'image/webp' } = opts

  if (!file.type.startsWith('image/')) {
    throw new Error('Datei ist kein Bild')
  }

  const bitmap = await createImageBitmap(file).catch(async () => {
    return await new Promise<ImageBitmap>((resolve, reject) => {
      const img = new Image()
      img.onload = () => createImageBitmap(img).then(resolve, reject)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  })

  let { width, height } = bitmap
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  width = Math.round(width * ratio)
  height = Math.round(height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality)
  })
  if (!blob) throw new Error('Kompression fehlgeschlagen')

  return {
    blob,
    width,
    height,
    originalSize: file.size,
    compressedSize: blob.size,
  }
}

export function fileExtFromMime(mime: string): string {
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/svg+xml') return 'svg'
  return 'bin'
}
