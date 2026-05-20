// Zentrale Farb-Palette für alle Piloten.
// Jeder Pilot hat eine eindeutige Signaturfarbe, die in Header, Tab-Highlight,
// aktiven Menüpunkten und Status-Akzenten durchgängig verwendet wird.
//
// Verwendung:
//   import { PILOT_COLORS } from '@/lib/pilot-colors'
//   const c = PILOT_COLORS.lager
//   <div style={{ background: c.bgSoft, border: `1px solid ${c.border}` }}>...</div>

export type PilotKey =
  | 'lager' | 'buero' | 'werkstatt' | 'marketing' | 'analyse'
  | 'planung' | 'ki' | 'steuer' | 'qm' | 'cloud' | 'archiv' | 'einstellungen'

export interface PilotColor {
  /** Hauptfarbe als Hex */
  primary: string
  /** Heller Akzent (für Gradients & Glow) */
  light: string
  /** Soft-Background (rgba mit ~15% Alpha) für Header-Icon-Boxen */
  bgSoft: string
  /** Schwacher Hintergrund (rgba ~6%) für Hover-States */
  bgFaint: string
  /** Rand-Farbe (rgba ~30% Alpha) für Outlines */
  border: string
  /** Glow-Shadow für aktive Buttons */
  glow: string
  /** Gradient für Cards / Buttons */
  gradient: string
}

export const PILOT_COLORS: Record<PilotKey, PilotColor> = {
  lager: {
    primary: '#1684ff', light: '#20c8ff',
    bgSoft:  'rgba(22,132,255,.15)', bgFaint: 'rgba(22,132,255,.06)',
    border:  'rgba(22,132,255,.30)',  glow:   '0 0 16px rgba(22,132,255,.35)',
    gradient: 'linear-gradient(135deg, #1684ff, #20c8ff)',
  },
  buero: {
    primary: '#20c8ff', light: '#67e8f9',
    bgSoft:  'rgba(32,200,255,.15)', bgFaint: 'rgba(32,200,255,.06)',
    border:  'rgba(32,200,255,.30)',  glow:   '0 0 16px rgba(32,200,255,.35)',
    gradient: 'linear-gradient(135deg, #20c8ff, #67e8f9)',
  },
  werkstatt: {
    primary: '#a78bfa', light: '#c4b5fd',
    bgSoft:  'rgba(167,139,250,.15)', bgFaint: 'rgba(167,139,250,.06)',
    border:  'rgba(167,139,250,.30)',  glow:   '0 0 16px rgba(167,139,250,.35)',
    gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  },
  marketing: {
    primary: '#f97316', light: '#fb923c',
    bgSoft:  'rgba(249,115,22,.15)', bgFaint: 'rgba(249,115,22,.06)',
    border:  'rgba(249,115,22,.30)',  glow:   '0 0 16px rgba(249,115,22,.35)',
    gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
  },
  analyse: {
    primary: '#10b981', light: '#34d399',
    bgSoft:  'rgba(16,185,129,.15)', bgFaint: 'rgba(16,185,129,.06)',
    border:  'rgba(16,185,129,.30)',  glow:   '0 0 16px rgba(16,185,129,.35)',
    gradient: 'linear-gradient(135deg, #059669, #10b981)',
  },
  planung: {
    primary: '#f43f5e', light: '#fb7185',
    bgSoft:  'rgba(244,63,94,.15)', bgFaint: 'rgba(244,63,94,.06)',
    border:  'rgba(244,63,94,.30)',  glow:   '0 0 16px rgba(244,63,94,.35)',
    gradient: 'linear-gradient(135deg, #e11d48, #f43f5e)',
  },
  ki: {
    primary: '#c084fc', light: '#d8b4fe',
    bgSoft:  'rgba(192,132,252,.15)', bgFaint: 'rgba(192,132,252,.06)',
    border:  'rgba(192,132,252,.30)',  glow:   '0 0 16px rgba(192,132,252,.35)',
    gradient: 'linear-gradient(135deg, #9333ea, #c084fc)',
  },
  steuer: {
    primary: '#fbbf24', light: '#fcd34d',
    bgSoft:  'rgba(251,191,36,.15)', bgFaint: 'rgba(251,191,36,.06)',
    border:  'rgba(251,191,36,.30)',  glow:   '0 0 16px rgba(251,191,36,.35)',
    gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
  },
  qm: {
    primary: '#06b6d4', light: '#22d3ee',
    bgSoft:  'rgba(6,182,212,.15)', bgFaint: 'rgba(6,182,212,.06)',
    border:  'rgba(6,182,212,.30)',  glow:   '0 0 16px rgba(6,182,212,.35)',
    gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)',
  },
  cloud: {
    primary: '#64748b', light: '#94a3b8',
    bgSoft:  'rgba(100,116,139,.15)', bgFaint: 'rgba(100,116,139,.06)',
    border:  'rgba(100,116,139,.30)',  glow:   '0 0 16px rgba(100,116,139,.35)',
    gradient: 'linear-gradient(135deg, #475569, #64748b)',
  },
  archiv: {
    primary: '#94a3b8', light: '#cbd5e1',
    bgSoft:  'rgba(148,163,184,.15)', bgFaint: 'rgba(148,163,184,.06)',
    border:  'rgba(148,163,184,.30)',  glow:   '0 0 16px rgba(148,163,184,.35)',
    gradient: 'linear-gradient(135deg, #64748b, #94a3b8)',
  },
  einstellungen: {
    primary: '#aeb9c8', light: '#cbd5e1',
    bgSoft:  'rgba(174,185,200,.15)', bgFaint: 'rgba(174,185,200,.06)',
    border:  'rgba(174,185,200,.30)',  glow:   '0 0 16px rgba(174,185,200,.35)',
    gradient: 'linear-gradient(135deg, #94a3b8, #aeb9c8)',
  },
}

// Hilfsfunktion: gibt Style-Objekt für eine farbige Tab-Pille zurück
export function pilotTabStyle(pilot: PilotKey, active: boolean): React.CSSProperties {
  const c = PILOT_COLORS[pilot]
  return {
    background: active ? c.bgSoft : 'rgba(255,255,255,.03)',
    border: `1px solid ${active ? c.border : 'rgba(255,255,255,.06)'}`,
    color: active ? c.primary : '#aeb9c8',
    fontWeight: active ? 800 : 600,
    boxShadow: active ? `0 4px 14px ${c.bgSoft}` : 'none',
    transition: 'all .15s',
  }
}

// Hilfsfunktion: gibt Style-Objekt für Header-Icon-Box zurück
export function pilotHeaderIconStyle(pilot: PilotKey): React.CSSProperties {
  const c = PILOT_COLORS[pilot]
  return {
    width: 52, height: 52, borderRadius: 14,
    background: c.bgSoft, border: `1px solid ${c.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, flexShrink: 0,
    boxShadow: c.glow,
  }
}
