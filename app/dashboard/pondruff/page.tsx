'use client'
import Link from 'next/link'

const TILES = [
  { href: '/dashboard/pondruff/wareneingang', icon: '📥', label: 'Wareneingang', desc: 'Lieferschein, Bauteile & Verpackung erfassen' },
  { href: '/dashboard/pondruff/preisrechner', icon: '💶', label: 'Preisrechner', desc: 'Positionen kalkulieren, WISO-Auftrag erzeugen' },
  { href: '/dashboard/pondruff/buero-wiso', icon: '🧾', label: 'Büro / WISO', desc: 'Aufträge, Copy/Paste und CSV für WISO MeinBüro' },
]

export default function PondruffHome() {
  return (
    <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
      {TILES.map(t => (
        <Link key={t.href} href={t.href} className="pk-card" style={{ textDecoration: 'none', color: 'inherit', padding: 18 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{t.label}</div>
          <div style={{ fontSize: 13, color: '#aeb9c8' }}>{t.desc}</div>
        </Link>
      ))}
    </div>
  )
}
