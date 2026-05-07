import {
  getLagerArtikel,
  getBueroRechnungen,
  getWerkstattKarten,
  getPlanungProjekte,
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

  return warnings
}
