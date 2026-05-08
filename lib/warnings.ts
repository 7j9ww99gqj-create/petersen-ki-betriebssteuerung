import {
  getLagerArtikel,
  getBueroRechnungen,
  getWerkstattKarten,
  getPlanungProjekte,
  getSteuerBelege,
} from '@/lib/db'

export type Warning = {
  id: string
  type: 'error' | 'warn' | 'info' | 'success'
  category: 'lager' | 'büro' | 'werkstatt' | 'planung'
  title: string
  desc: string
  link?: string
  timestamp: Date
}

const DEMO_WARNINGS: Warning[] = [
  {
    id: 'demo-1',
    type: 'error',
    category: 'lager',
    title: '🚨 Artikel leer: Hydrauliköl HLP46',
    desc: 'Hydrauliköl HLP46 – Bestand: 0 Liter',
    link: '/dashboard/lager',
    timestamp: new Date(),
  },
  {
    id: 'demo-2',
    type: 'warn',
    category: 'lager',
    title: '⚠️ Niedriger Bestand: Stahlrohr 40x40',
    desc: 'Noch 3 Stück (Mindest: 10)',
    link: '/dashboard/lager',
    timestamp: new Date(),
  },
  {
    id: 'demo-3',
    type: 'error',
    category: 'büro',
    title: '💸 Überfällige Rechnung',
    desc: 'RE-2025-077 · Schmidt & Partner · 4.850,00 €',
    link: '/dashboard/buero',
    timestamp: new Date(),
  },
  {
    id: 'demo-4',
    type: 'warn',
    category: 'büro',
    title: '📮 Mahnung ausstehend',
    desc: 'RE-2025-061 · Müller GmbH',
    link: '/dashboard/buero',
    timestamp: new Date(),
  },
  {
    id: 'demo-5',
    type: 'error',
    category: 'werkstatt',
    title: '🔴 Kritische Arbeitskarte',
    desc: 'AK-0042: Getriebe-Reparatur Anlage 3',
    link: '/dashboard/werkstatt',
    timestamp: new Date(),
  },
  {
    id: 'demo-6',
    type: 'error',
    category: 'planung',
    title: '🔴 Projekt kritisch',
    desc: 'Produktionsanlage Umbau Q2',
    link: '/dashboard/planung',
    timestamp: new Date(),
  },
]

export async function getAppWarnings(isDemo: boolean): Promise<Warning[]> {
  if (isDemo) {
    return DEMO_WARNINGS
  }

  const warnings: Warning[] = []

  // ── Lager ──────────────────────────────────────────────────────────────────
  try {
    const artikel = await getLagerArtikel()
    for (const a of artikel) {
      if (a.status === 'leer') {
        warnings.push({
          id: `lager-leer-${a.id}`,
          type: 'error',
          category: 'lager',
          title: `🚨 Artikel leer: ${a.name}`,
          desc: `${a.name} – Bestand: 0 ${a.einheit ?? ''}`.trim(),
          link: '/dashboard/lager',
          timestamp: new Date(),
        })
      } else if (a.status === 'niedrig') {
        warnings.push({
          id: `lager-niedrig-${a.id}`,
          type: 'warn',
          category: 'lager',
          title: `⚠️ Niedriger Bestand: ${a.name}`,
          desc: `Noch ${a.bestand} ${a.einheit ?? ''} (Mindest: ${a.mindestbestand ?? '–'})`.trim(),
          link: '/dashboard/lager',
          timestamp: new Date(),
        })
      }
    }
  } catch {
    // Lager nicht verfügbar – ignorieren
  }

  // ── Büro ───────────────────────────────────────────────────────────────────
  try {
    const rechnungen = await getBueroRechnungen()
    for (const r of rechnungen) {
      if (r.status === 'Überfällig') {
        warnings.push({
          id: `buero-ueberfaellig-${r.id}`,
          type: 'error',
          category: 'büro',
          title: '💸 Überfällige Rechnung',
          desc: `${r.id} · ${r.kunde ?? '–'} · ${r.betrag ?? '–'}`,
          link: '/dashboard/buero',
          timestamp: new Date(),
        })
      } else if (r.status === 'Mahnung') {
        warnings.push({
          id: `buero-mahnung-${r.id}`,
          type: 'warn',
          category: 'büro',
          title: '📮 Mahnung ausstehend',
          desc: `${r.id} · ${r.kunde ?? '–'}`,
          link: '/dashboard/buero',
          timestamp: new Date(),
        })
      }
    }
  } catch {
    // Büro nicht verfügbar – ignorieren
  }

  // ── Werkstatt ──────────────────────────────────────────────────────────────
  try {
    const karten = await getWerkstattKarten()
    for (const k of karten) {
      if (k.prioritaet === 'Kritisch' && k.status !== 'Fertig') {
        warnings.push({
          id: `werkstatt-kritisch-${k.id}`,
          type: 'error',
          category: 'werkstatt',
          title: '🔴 Kritische Arbeitskarte',
          desc: `${k.id}: ${k.beschreibung ?? '–'}`,
          link: '/dashboard/werkstatt',
          timestamp: new Date(),
        })
      } else if (k.status === 'Warten') {
        warnings.push({
          id: `werkstatt-warten-${k.id}`,
          type: 'warn',
          category: 'werkstatt',
          title: '⏸️ Arbeitskarte wartet',
          desc: `${k.id} wartet auf Material/Freigabe`,
          link: '/dashboard/werkstatt',
          timestamp: new Date(),
        })
      }
    }
  } catch {
    // Werkstatt nicht verfügbar – ignorieren
  }

  // ── Planung ────────────────────────────────────────────────────────────────
  try {
    const projekte = await getPlanungProjekte()
    for (const p of projekte) {
      if (p.status === 'Kritisch') {
        warnings.push({
          id: `planung-kritisch-${p.id}`,
          type: 'error',
          category: 'planung',
          title: '🔴 Projekt kritisch',
          desc: `${p.name}`,
          link: '/dashboard/planung',
          timestamp: new Date(),
        })
      }
    }
  } catch {
    // Planung nicht verfügbar – ignorieren
  }

  // ── Steuer ─────────────────────────────────────────────────────────────────
  try {
    const belege = await getSteuerBelege()
    const ohneSteuersatz = belege.filter(b => b.steuersatz == null)
    if (ohneSteuersatz.length > 0) {
      warnings.push({
        id: 'steuer-kein-steuersatz',
        type: 'warn',
        category: 'büro',
        title: '🧾 Belege ohne Steuersatz',
        desc: `${ohneSteuersatz.length} Beleg(e) haben keinen Steuersatz`,
        link: '/dashboard/steuer',
        timestamp: new Date(),
      })
    }
    const nullBelege = belege.filter(b => !b.betrag || b.betrag === 0)
    if (nullBelege.length > 0) {
      warnings.push({
        id: 'steuer-null-betrag',
        type: 'warn',
        category: 'büro',
        title: '⚠️ Belege mit 0€',
        desc: `${nullBelege.length} Beleg(e) haben keinen Betrag`,
        link: '/dashboard/steuer',
        timestamp: new Date(),
      })
    }
  } catch {
    // Steuer nicht verfügbar – ignorieren
  }

  return warnings
}

export async function getSteuerWarnings(isDemo: boolean): Promise<Warning[]> {
  if (isDemo) {
    return [
      {
        id: 'steuer-demo-1',
        type: 'warn',
        category: 'büro',
        title: '🧾 Beleg ohne Steuersatz',
        desc: 'Lieferant "Büromaterial GmbH" – kein Steuersatz hinterlegt',
        link: '/dashboard/steuer',
        timestamp: new Date(),
      },
      {
        id: 'steuer-demo-2',
        type: 'error',
        category: 'büro',
        title: '🔴 Doppelter Beleg',
        desc: '2× gleicher Betrag (480,00 €) am 15.04.2025',
        link: '/dashboard/steuer',
        timestamp: new Date(),
      },
      {
        id: 'steuer-demo-3',
        type: 'info',
        category: 'büro',
        title: '📅 UStVA April noch nicht geprüft',
        desc: 'Monat April 2025 wurde noch nicht als geprüft markiert',
        link: '/dashboard/steuer',
        timestamp: new Date(),
      },
    ]
  }

  const warnings: Warning[] = []
  try {
    const belege = await getSteuerBelege()

    const ohneSteuersatz = belege.filter(b => b.steuersatz == null)
    if (ohneSteuersatz.length > 0)
      warnings.push({
        id: 'steuer-kein-steuersatz',
        type: 'warn',
        category: 'büro',
        title: '🧾 Belege ohne Steuersatz',
        desc: `${ohneSteuersatz.length} Beleg(e) ohne Steuersatz`,
        link: '/dashboard/steuer',
        timestamp: new Date(),
      })

    const nullBelege = belege.filter(b => !b.betrag || b.betrag === 0)
    if (nullBelege.length > 0)
      warnings.push({
        id: 'steuer-null-betrag',
        type: 'warn',
        category: 'büro',
        title: '⚠️ Belege mit 0€',
        desc: `${nullBelege.length} Beleg(e) ohne Betrag`,
        link: '/dashboard/steuer',
        timestamp: new Date(),
      })

    // Duplikat-Erkennung
    const seen = new Map<string, number>()
    for (const b of belege) {
      const key = `${b.datum}-${b.betrag}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    const dups = Array.from(seen.entries()).filter(([, count]) => count > 1)
    for (const [key] of dups) {
      const [datum, betrag] = key.split('-')
      warnings.push({
        id: `steuer-duplikat-${key}`,
        type: 'error',
        category: 'büro',
        title: '🔴 Möglicher Doppelbeleg',
        desc: `${dups.length}× Betrag ${betrag}€ am ${datum}`,
        link: '/dashboard/steuer',
        timestamp: new Date(),
      })
    }
  } catch {}

  return warnings
}
