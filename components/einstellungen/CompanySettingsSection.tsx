'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { type AppRole } from '@/lib/roles'
import {
  getFirmaEinstellungen, upsertFirmaEinstellungen, uploadFirmenLogo,
  uploadBriefpapier, deleteBriefpapier,
  type FirmaEinstellungen,
} from '@/lib/db'

/**
 * CompanySettingsSection — Firmenstammdaten + Logo + Briefpapier.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 2).
 */
const emptyFirma: FirmaEinstellungen = {
  firmenname: '',
  land: 'Deutschland',
  zahlungsziel_tage: 14,
  standard_mwst: 19,
  standard_waehrung: 'EUR',
  dokument_footer: 'Vielen Dank für Ihr Vertrauen.',
  briefpapier_layout: {
    template: 'modern-dark',
    logoPosition: 'links',
    akzentfarbe: '#20c8ff',
    showBankdaten: true,
    showSteuernummer: true,
    showUstId: true,
    showGeschaeftsfuehrer: true,
    showWebsite: true,
    useForAngebote: true,
    useForAuftragsbestaetigungen: true,
    useForRechnungen: true,
  },
  onboarding_completed: false,
}

export default function CompanySettingsSection({ isDemo: _isDemo, currentRole, showToast }: {
  isDemo: boolean
  currentRole: AppRole
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  void _isDemo
  const canEdit = currentRole === 'Admin' || currentRole === 'Inhaber'
  const [firma, setFirma] = useState<FirmaEinstellungen>(emptyFirma)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [briefpapierUploading, setBriefpapierUploading] = useState(false)
  const [briefpapierDeleting, setBriefpapierDeleting] = useState(false)

  useEffect(() => {
    getFirmaEinstellungen()
      .then(data => {
        if (data) {
          setFirma({ ...emptyFirma, ...data, briefpapier_layout: { ...emptyFirma.briefpapier_layout, ...(data.briefpapier_layout ?? {}) } })
          localStorage.setItem('pk_firma_einstellungen', JSON.stringify(data))
        }
      })
      .catch(() => showToast('Firmendaten konnten nicht geladen werden', 'error'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = <K extends keyof FirmaEinstellungen>(key: K, value: FirmaEinstellungen[K]) =>
    setFirma(prev => ({ ...prev, [key]: value }))
  const setLayout = (key: string, value: unknown) =>
    setFirma(prev => ({ ...prev, briefpapier_layout: { ...(prev.briefpapier_layout ?? {}), [key]: value } }))
  const layout = (firma.briefpapier_layout ?? {}) as Record<string, unknown>
  const selectedTemplate = String(layout.template ?? 'modern-dark')
  const petersenBrandLocked = selectedTemplate === 'petersen-brand' && currentRole !== 'Inhaber'

  const save = async (complete = true) => {
    if (!canEdit) { showToast('Nur Admins und Inhaber dürfen Firmendaten bearbeiten', 'error'); return }
    if (!firma.firmenname.trim()) { showToast('Firmenname ist Pflicht', 'error'); return }
    if (petersenBrandLocked) { showToast('Petersen Brand ist nur für den Inhaber-Account freigegeben', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        ...firma,
        briefpapier_layout: {
          ...(firma.briefpapier_layout ?? {}),
          useForAngebote: layout.useForAngebote !== false,
          useForAuftragsbestaetigungen: layout.useForAuftragsbestaetigungen !== false,
          useForRechnungen: layout.useForRechnungen !== false,
        },
        onboarding_completed: complete ? true : firma.onboarding_completed,
      }
      const saved = await upsertFirmaEinstellungen(payload)
      setFirma({ ...emptyFirma, ...saved, briefpapier_layout: { ...emptyFirma.briefpapier_layout, ...(saved.briefpapier_layout ?? {}) } })
      localStorage.setItem('pk_firma_einstellungen', JSON.stringify(saved))
      showToast('✅ Firmendaten gespeichert')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleLogo = async (file: File | null) => {
    if (!file || !canEdit) return
    setLogoUploading(true)
    try {
      // SVG-Logos behalten (Vektor), Raster-Bilder vor Upload komprimieren
      let uploadFile: File = file
      if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        try {
          const { compressImage, fileExtFromMime } = await import('@/lib/image-compress')
          const result = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.9 })
          uploadFile = new File([result.blob], `logo.${fileExtFromMime(result.blob.type)}`, { type: result.blob.type })
        } catch {
          // Bei Kompressionsfehler Original verwenden
        }
      }
      const uploaded = await uploadFirmenLogo(uploadFile)
      setField('logo_url', uploaded.url)
      showToast('✅ Logo hochgeladen')
    } catch {
      showToast('Logo konnte nicht hochgeladen werden', 'error')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleBriefpapier = async (file: File | null) => {
    if (!file || !canEdit) return
    setBriefpapierUploading(true)
    try {
      const uploaded = await uploadBriefpapier(file)
      setField('briefpapier_url', uploaded.url)
      showToast('✅ Briefpapier hochgeladen')
    } catch {
      showToast('Briefpapier konnte nicht hochgeladen werden', 'error')
    } finally {
      setBriefpapierUploading(false)
    }
  }

  const handleBriefpapierDelete = async () => {
    if (!canEdit || !firma.briefpapier_url) return
    setBriefpapierDeleting(true)
    try {
      await deleteBriefpapier(firma.briefpapier_url)
      setField('briefpapier_url', undefined)
      showToast('✅ Briefpapier entfernt')
    } catch {
      showToast('Briefpapier konnte nicht entfernt werden', 'error')
    } finally {
      setBriefpapierDeleting(false)
    }
  }

  if (loading) return <div className="pk-card" style={{ color: '#aeb9c8' }}>Lade Firmendaten…</div>

  const inputDisabled = !canEdit
  const input = (key: keyof FirmaEinstellungen, label: string, placeholder = '', type = 'text') => (
    <div>
      <label htmlFor="field-label" style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{label}</label>
      <input id="field-label" className="pk-input" type={type} disabled={inputDisabled} value={String(firma[key] ?? '')} onChange={e => setField(key, e.target.value as never)} placeholder={placeholder} />
    </div>
  )
  const requiredDocumentFields: Array<[keyof FirmaEinstellungen, string]> = [
    ['firmenname', 'Firmenname'],
    ['adresse', 'Adresse'],
    ['plz', 'PLZ'],
    ['ort', 'Ort'],
    ['email', 'E-Mail'],
    ['telefon', 'Telefon'],
    ['iban', 'IBAN'],
  ]
  const missingDocumentFields = requiredDocumentFields
    .filter(([key]) => !String(firma[key] ?? '').trim())
    .map(([, label]) => label)
  const completedDocumentFields = requiredDocumentFields.length - missingDocumentFields.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!firma.onboarding_completed && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.28)', color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
          Firmendaten noch unvollständig. Die App bleibt nutzbar, aber PDFs nutzen Fallback-Daten.
        </div>
      )}
      {!canEdit && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#aeb9c8', fontSize: 13 }}>
          Nur Admins und Inhaber dürfen Firmendaten und Briefpapier bearbeiten. Sie können die Daten hier ansehen.
        </div>
      )}
      {petersenBrandLocked && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.24)', color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
          Petersen Brand ist in diesem Account gesperrt. Bitte als Inhaber anmelden oder eine andere Vorlage wählen.
        </div>
      )}

      <div className="pk-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(220px, .8fr)', gap: 16, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6cb6ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Dokumentdaten</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900 }}>Firmendaten für Angebote, Auftragsbestätigungen und Rechnungen</h3>
          <div style={{ color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>
            {missingDocumentFields.length === 0
              ? 'Alle Pflichtdaten für saubere Geschäftsdokumente sind hinterlegt.'
              : `Es fehlen noch: ${missingDocumentFields.join(', ')}.`}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((completedDocumentFields / requiredDocumentFields.length) * 100)}%`, height: '100%', background: missingDocumentFields.length === 0 ? '#4ddb7e' : '#20c8ff' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Angebote', 'Auftragsbestätigungen', 'Rechnungen'].map(label => (
              <span key={label} className="badge badge-blue">{label}</span>
            ))}
            {currentRole === 'Inhaber' && <span className="badge badge-green">Inhaber-Briefpapier</span>}
          </div>
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🏢 Firmendaten & Logo</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{
            width: 74, height: 74, borderRadius: 16, overflow: 'hidden',
            background: 'rgba(32,200,255,.12)', border: '1px solid rgba(32,200,255,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 900, color: '#20c8ff', position: 'relative', flexShrink: 0,
          }}>
            {firma.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Signed Supabase-URL; kein next/image-Optimizer nötig
              <img
                src={firma.logo_url}
                alt="Firmenlogo"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => {
                  // Falls die URL kaputt ist → Fallback-Initialen anzeigen
                  const target = e.currentTarget
                  target.style.display = 'none'
                  const fallback = target.nextElementSibling as HTMLElement | null
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
            ) : null}
            <span style={{
              display: firma.logo_url ? 'none' : 'flex',
              position: 'absolute', inset: 0,
              alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: '#20c8ff',
            }}>
              {(firma.firmenname || 'F').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="pk-btn-ghost" style={{ cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5 }}>
              {logoUploading ? '⏳ Logo…' : (firma.logo_url ? '🖼️ Logo ändern' : 'Logo hochladen')}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={!canEdit} onChange={e => handleLogo(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            </label>
            {firma.logo_url && canEdit && (
              <button
                type="button"
                className="pk-btn-ghost"
                onClick={() => { setField('logo_url', ''); showToast('Logo entfernt — bitte speichern') }}
                style={{ fontSize: 12, padding: '6px 10px', color: '#ff8080', borderColor: 'rgba(255,80,80,.3)' }}
              >
                🗑️ Logo entfernen
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {input('firmenname', 'Firmenname *')}
          {input('slogan', 'Slogan')}
          {input('branche', 'Branche')}
          {input('ansprechpartner', 'Ansprechpartner')}
          {input('adresse', 'Adresse')}
          {input('plz', 'PLZ')}
          {input('ort', 'Ort')}
          {input('land', 'Land')}
          {input('email', 'E-Mail', '', 'email')}
          {input('telefon', 'Telefon')}
          {input('website', 'Website')}
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🧾 Steuerdaten & Bankverbindung</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {input('ust_id', 'USt-IdNr.')}
          {input('steuernummer', 'Steuernummer')}
          {input('handelsregister', 'Handelsregister')}
          {input('geschaeftsfuehrer', 'Geschäftsführer')}
          {input('bankname', 'Bankname')}
          {input('iban', 'IBAN')}
          {input('bic', 'BIC')}
          {input('zahlungsziel_tage', 'Standard-Zahlungsziel', '', 'number')}
          {input('standard_mwst', 'Standard-MwSt.', '', 'number')}
          {input('standard_waehrung', 'Standard-Währung')}
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>📄 Briefpapier / Design</h3>

        {/* Template selector */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase' }}>Briefpapier-Vorlage</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {([
              {
                id: 'modern-dark',
                name: 'Modern Dark',
                desc: 'Dunkel & professionell',
                preview: (
                  <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                    {/* Header bar */}
                    <div style={{ background: '#0a121e', height: '12%', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                      <div style={{ width: 10, height: 3, background: String(layout.akzentfarbe ?? '#20c8ff'), borderRadius: 1 }} />
                      <div style={{ marginLeft: 4, width: 30, height: 3, background: String(layout.akzentfarbe ?? '#20c8ff'), borderRadius: 1, opacity: 0.8 }} />
                    </div>
                    <div style={{ height: 1, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                    {/* Body lines */}
                    <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ width: '45%', height: 2.5, background: '#1a2535', borderRadius: 1 }} />
                      <div style={{ width: '30%', height: 2, background: '#e8edf3', borderRadius: 1 }} />
                      <div style={{ marginTop: 3, width: '100%', height: 5, background: '#0a121e', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                      <div style={{ marginTop: 1, width: '55%', height: 4, background: '#0a121e', borderRadius: 1, alignSelf: 'flex-end' }} />
                      <div style={{ marginTop: 2, width: '100%', height: 8, background: '#0c1624', borderRadius: 2 }} />
                    </div>
                    {/* Footer bar */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10%', background: '#0a121e' }} />
                    <div style={{ position: 'absolute', bottom: '10%', left: 0, right: 0, height: 1, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                  </div>
                ),
              },
              {
                id: 'classic-light',
                name: 'Classic Professional',
                desc: 'Klassisch & seriös',
                preview: (
                  <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                    <div style={{ background: '#162a58', height: '12%', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                      <div style={{ width: 10, height: 3, background: '#ffffff', borderRadius: 1, opacity: 0.9 }} />
                      <div style={{ marginLeft: 4, width: 30, height: 3, background: '#ffffff', borderRadius: 1, opacity: 0.7 }} />
                    </div>
                    <div style={{ height: 1.5, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                    <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ width: '45%', height: 2.5, background: '#162a58', borderRadius: 1 }} />
                      <div style={{ width: '30%', height: 2, background: '#d0d8e8', borderRadius: 1 }} />
                      <div style={{ marginTop: 3, width: '100%', height: 5, background: '#0a121e', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                      <div style={{ marginTop: 1, width: '55%', height: 4, background: '#0a121e', borderRadius: 1, alignSelf: 'flex-end' }} />
                      <div style={{ marginTop: 2, width: '100%', height: 8, background: '#e6f1ff', borderRadius: 2, border: `1px solid ${String(layout.akzentfarbe ?? '#20c8ff')}40` }} />
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10%', background: '#f2f6fc' }} />
                    <div style={{ position: 'absolute', bottom: '10%', left: 0, right: 0, height: 1, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                  </div>
                ),
              },
              {
                id: 'elegant-minimal',
                name: 'Elegant Minimal',
                desc: 'Puristisch & edel',
                preview: (
                  <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                    <div style={{ height: 3, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                    <div style={{ padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ width: '40%', height: 3, background: '#161e34', borderRadius: 1 }} />
                        <div style={{ width: '25%', height: 2, background: '#c8d0dc', borderRadius: 1 }} />
                      </div>
                      <div style={{ width: '28%', height: 2, background: '#dce1ea', borderRadius: 1 }} />
                      <div style={{ height: 0.8, background: '#d7dee8', marginTop: 2, marginBottom: 2 }} />
                      <div style={{ width: '45%', height: 2.5, background: '#161e34', borderRadius: 1 }} />
                      <div style={{ marginTop: 2, width: '100%', height: 5, background: '#0a121e', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                      <div style={{ marginTop: 1, width: '55%', height: 4, background: '#0a121e', borderRadius: 1, alignSelf: 'flex-end' }} />
                      <div style={{ marginTop: 2, width: '100%', height: 8, background: '#fcfdff', borderRadius: 2, border: `1px solid ${String(layout.akzentfarbe ?? '#20c8ff')}60` }} />
                    </div>
                    <div style={{ position: 'absolute', bottom: '10%', left: 6, right: 6, height: 0.8, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                  </div>
                ),
              },
            ...(currentRole === 'Inhaber' ? [{
              id: 'petersen-brand',
              name: 'Petersen Brand',
              desc: 'Exklusiv · Nur Inhaber',
              preview: (
                <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                  {/* Dark header with cloud glow */}
                  <div style={{ background: '#040c1a', height: '14%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: 6, gap: 5 }}>
                    {/* Mini 3D cube */}
                    <svg width="10" height="11" viewBox="0 0 100 110" fill="none">
                      <defs>
                        <linearGradient id="pt" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#90c0ff"/><stop offset="100%" stopColor="#1a5ae0"/></linearGradient>
                        <linearGradient id="pl" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#05194a"/><stop offset="100%" stopColor="#0a2878"/></linearGradient>
                        <linearGradient id="pr" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1048cc"/><stop offset="100%" stopColor="#1e6aff"/></linearGradient>
                      </defs>
                      <polygon points="50,6 90,28 50,50 10,28" fill="url(#pt)"/>
                      <polygon points="10,28 50,50 50,94 10,72" fill="url(#pl)"/>
                      <polygon points="90,28 90,72 50,94 50,50" fill="url(#pr)"/>
                      <polygon points="50,24 77,38 50,52 23,38" fill="#030a1e" opacity="0.9"/>
                      <polygon points="23,38 50,52 50,76 23,62" fill="#020814" opacity="0.88"/>
                      <polygon points="77,38 77,62 50,76 50,52" fill="#060e2a" opacity="0.85"/>
                      <polygon points="50,33 67,42 50,51 33,42" fill="url(#pt)" opacity="0.85"/>
                      <polygon points="33,42 50,51 50,67 33,58" fill="url(#pl)" opacity="0.8"/>
                      <polygon points="67,42 67,58 50,67 50,51" fill="url(#pr)" opacity="0.82"/>
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div style={{ width: 32, height: 2, background: '#ffffff', borderRadius: 1 }} />
                      <div style={{ width: 22, height: 1.5, background: 'rgba(100,170,255,0.5)', borderRadius: 1 }} />
                    </div>
                    {/* Cloud glow bottom-left */}
                    <div style={{ position: 'absolute', bottom: -4, left: 0, width: 30, height: 10, background: 'radial-gradient(ellipse at 30% 80%, rgba(20,80,240,0.7) 0%, transparent 70%)', filter: 'blur(2px)' }} />
                    <div style={{ position: 'absolute', bottom: -4, right: 0, width: 30, height: 10, background: 'radial-gradient(ellipse at 70% 80%, rgba(20,80,240,0.6) 0%, transparent 70%)', filter: 'blur(2px)' }} />
                  </div>
                  {/* Gradient separator */}
                  <div style={{ height: 1.5, background: 'linear-gradient(90deg, #1048cc, #20c8ff 50%, #1048cc)' }} />
                  {/* Body */}
                  <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ width: '45%', height: 2.5, background: '#0a1a3a', borderRadius: 1 }} />
                    <div style={{ width: '30%', height: 2, background: '#e0e8f5', borderRadius: 1 }} />
                    <div style={{ marginTop: 2, width: '100%', height: 5, background: '#060e20', borderRadius: 1 }} />
                    <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                    <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                    <div style={{ marginTop: 1, width: '55%', height: 4, background: '#060e20', borderRadius: 1, alignSelf: 'flex-end' }} />
                    <div style={{ marginTop: 2, width: '100%', height: 8, background: '#050e1e', borderRadius: 2 }} />
                  </div>
                  {/* Dark footer with diagonal */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '11%', background: '#040c1a', clipPath: 'polygon(0 40%, 100% 0%, 100% 100%, 0% 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #1048cc, #20c8ff 50%, #1048cc)' }} />
                  {/* Footer cloud glow */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: 30, height: 15, background: 'radial-gradient(ellipse at 20% 90%, rgba(20,80,240,0.5) 0%, transparent 70%)', filter: 'blur(3px)' }} />
                  {/* Inhaber badge */}
                  <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(32,200,255,0.15)', border: '1px solid rgba(32,200,255,0.3)', borderRadius: 3, padding: '1px 4px', fontSize: 5.5, color: '#20c8ff', fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: 0.5 }}>INHABER</div>
                </div>
              ),
            }] : []),
            ] as Array<{ id: string; name: string; desc: string; preview: React.ReactNode }>).map(tpl => {
              const isSelected = (layout.template ?? 'modern-dark') === tpl.id
              const accentColor = String(layout.akzentfarbe ?? '#20c8ff')
              return (
                <button
                  key={tpl.id}
                  disabled={inputDisabled}
                  onClick={() => setLayout('template', tpl.id)}
                  style={{
                    background: isSelected ? 'rgba(32,200,255,.06)' : 'rgba(255,255,255,.03)',
                    border: isSelected ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,.08)',
                    borderRadius: 12,
                    padding: 10,
                    cursor: inputDisabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: inputDisabled ? 0.5 : 1,
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  {tpl.preview}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? accentColor : 'rgba(255,255,255,.2)', flexShrink: 0, transition: 'background .15s' }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? accentColor : '#d0d9e8' }}>{tpl.name}</div>
                      <div style={{ fontSize: 10, color: '#7a8898', marginTop: 1 }}>{tpl.desc}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label htmlFor="field-logo-position" style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Logo-Position</label>
            <select id="field-logo-position" className="pk-input" disabled={inputDisabled} value={String(layout.logoPosition ?? 'links')} onChange={e => setLayout('logoPosition', e.target.value)}>
              <option value="links">links</option><option value="mitte">mitte</option><option value="rechts">rechts</option>
            </select>
          </div>
          <div>
            <label htmlFor="field-akzentfarbe" style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Akzentfarbe</label>
            <input id="field-akzentfarbe" className="pk-input" type="color" disabled={inputDisabled} value={String(layout.akzentfarbe ?? '#20c8ff')} onChange={e => setLayout('akzentfarbe', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="field-fuzeile" style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Fußzeile</label>
            <textarea id="field-fuzeile" className="pk-input" rows={3} disabled={inputDisabled} value={firma.dokument_footer ?? ''} onChange={e => setField('dokument_footer', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
          {[
            ['showBankdaten', 'Bankdaten anzeigen'],
            ['showSteuernummer', 'Steuernummer anzeigen'],
            ['showUstId', 'USt-IdNr. anzeigen'],
            ['showGeschaeftsfuehrer', 'Geschäftsführer anzeigen'],
            ['showWebsite', 'Website anzeigen'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#d0d9e8' }}>
              <input type="checkbox" disabled={inputDisabled} checked={layout[key] !== false} onChange={e => setLayout(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>📎 Eigenes Briefpapier hochladen</h3>
        <p style={{ margin: '0 0 16px', color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>
          Wenn ein eigenes Briefpapier hinterlegt ist, werden Header, Footer, Logo und alle Firmendaten
          <strong style={{ color: '#d0d9e8' }}> ausschließlich aus dem Briefpapier</strong> übernommen.
          Der PDF-Generator erzeugt dann nur noch den Dokumentinhalt im freien Mittelbereich.
        </p>

        {firma.briefpapier_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'rgba(32,200,255,.06)', border: '1px solid rgba(32,200,255,.25)', marginBottom: 12 }}>
            <div style={{ fontSize: 28 }}>
              {firma.briefpapier_url.toLowerCase().split('?')[0].endsWith('.pdf') ? '📄' : '🖼️'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#20c8ff', fontSize: 13 }}>Briefpapier aktiv</div>
              <div style={{ color: '#aeb9c8', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firma.briefpapier_url.split('/').pop()?.split('?')[0] || 'briefpapier'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <label className="pk-btn-ghost" style={{ cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5, fontSize: 12, padding: '6px 12px' }}>
                {briefpapierUploading ? '⏳' : 'Ersetzen'}
                <input type="file" accept="application/pdf,image/png,image/jpeg" disabled={!canEdit} onChange={e => handleBriefpapier(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
              </label>
              <button
                onClick={handleBriefpapierDelete}
                disabled={briefpapierDeleting || !canEdit}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,.3)', background: 'rgba(255,80,80,.08)', color: '#ff8080', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5 }}
              >
                {briefpapierDeleting ? '⏳' : 'Entfernen'}
              </button>
            </div>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 22px', borderRadius: 12, border: '2px dashed rgba(32,200,255,.25)', background: 'rgba(32,200,255,.03)', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5, marginBottom: 12, transition: 'border-color .15s, background .15s' }}>
            <div style={{ fontSize: 32 }}>📄</div>
            <div>
              <div style={{ fontWeight: 700, color: '#d0d9e8', fontSize: 14 }}>
                {briefpapierUploading ? '⏳ Wird hochgeladen…' : 'Briefpapier hochladen'}
              </div>
              <div style={{ color: '#7a8898', fontSize: 12, marginTop: 2 }}>PDF, PNG oder JPG · DIN-A4 empfohlen</div>
            </div>
            <input type="file" accept="application/pdf,image/png,image/jpeg" disabled={!canEdit || briefpapierUploading} onChange={e => handleBriefpapier(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
          </label>
        )}

        {firma.briefpapier_url && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24', fontSize: 12 }}>
            Hinweis: Bitte nach dem Hochladen auf &bdquo;Firmendaten speichern&ldquo; klicken, damit das Briefpapier dauerhaft verknüpft wird.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="pk-btn" disabled={saving || !canEdit} onClick={() => save(true)} style={{ fontWeight: 700, opacity: canEdit ? 1 : .5 }}>
          {saving ? '⏳ Speichern…' : 'Firmendaten speichern'}
        </button>
        {!firma.onboarding_completed && canEdit && (
          <button className="pk-btn-ghost" onClick={() => save(false)}>Später vervollständigen</button>
        )}
      </div>
    </div>
  )
}
