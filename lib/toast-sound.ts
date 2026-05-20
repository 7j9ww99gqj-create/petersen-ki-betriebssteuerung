// Toast-Sound-Helper
// Spielt einen kurzen Beep per Web-Audio-API ab.
// - Keine externe Audiodatei nötig (kein Bundle-Bloat)
// - Verschiedene Töne für success / error / info
// - Wirft NICHT, wenn AudioContext fehlt (z.B. SSR oder alter Browser)
// - Berücksichtigt User-Interaction-Gate (AudioContext braucht User-Click)
//   → bei Fehler wird leise zurückgekehrt

'use client'

export type ToastSoundType = 'success' | 'error' | 'info'

// Lazy-initialisierter AudioContext (darf erst nach erstem User-Click erstellt werden,
// sonst suspended in modernen Browsern)
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  try {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return null
    ctx = new AudioCtor()
    return ctx
  } catch {
    return null
  }
}

interface BeepSpec {
  frequency: number   // Hz
  duration: number    // ms
  type?: OscillatorType
  volume?: number     // 0–1
  decay?: number      // ms — fade-out am Ende
}

function playBeep(spec: BeepSpec) {
  const c = getCtx()
  if (!c) return
  // Falls Context suspended ist (z.B. wegen Autoplay-Policy), versuchen zu resumen
  if (c.state === 'suspended') {
    c.resume().catch(() => {})
  }
  try {
    const now = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = spec.type ?? 'sine'
    osc.frequency.setValueAtTime(spec.frequency, now)
    const vol = spec.volume ?? 0.08  // sehr leise per Default
    const durSec = spec.duration / 1000
    const decaySec = (spec.decay ?? 60) / 1000
    // Attack
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.01)
    // Release
    gain.gain.setValueAtTime(vol, now + durSec - decaySec)
    gain.gain.linearRampToValueAtTime(0, now + durSec)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(now)
    osc.stop(now + durSec + 0.05)
  } catch {
    // Silently fail — Sound ist nice-to-have
  }
}

export function playToastSound(type: ToastSoundType = 'info') {
  if (type === 'success') {
    // Zwei aufsteigende Töne (C5 → E5)
    playBeep({ frequency: 523.25, duration: 110, type: 'sine', volume: 0.07 })
    setTimeout(() => playBeep({ frequency: 659.25, duration: 140, type: 'sine', volume: 0.07 }), 90)
  } else if (type === 'error') {
    // Zwei absteigende Töne (A4 → F4) mit Square-Wave (markanter)
    playBeep({ frequency: 440, duration: 130, type: 'triangle', volume: 0.08 })
    setTimeout(() => playBeep({ frequency: 349.23, duration: 180, type: 'triangle', volume: 0.08 }), 110)
  } else {
    // Info: ein klarer Ton (E5)
    playBeep({ frequency: 659.25, duration: 130, type: 'sine', volume: 0.06 })
  }
}
