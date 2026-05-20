import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { ToastProvider } from '@/components/ui/ToastProvider'

export const metadata: Metadata = {
  title: 'Petersen KI Betriebssteuerung',
  description: 'KI-unterstütztes Warenwirtschaftssystem – Modulare Piloten für Ihren Betrieb',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-96.png',    sizes: '96x96',  type: 'image/png' },
      { url: '/icon-192.png',   sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Petersen KI',
    startupImage: '/icon-512.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#05070b',
}

/**
 * FOUC-Prevention Script — läuft synchron vor dem ersten Paint.
 * Liest localStorage und setzt Body-Attribute + CSS-Variablen,
 * damit Theme/Farben/Typografie sofort korrekt dargestellt werden.
 * Kein Framework-Code — reines vanilla JS, kein React nötig.
 */
const FOUC_SCRIPT = `(function(){
  try {
    var p = JSON.parse(localStorage.getItem('pk_design_prefs') || '{}');
    var b = document.body;
    var r = document.documentElement.style;
    // Theme (+ Auto-Theme via prefers-color-scheme)
    var t = p.theme || 'classic';
    if (p.autoTheme) {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'classic' : 'light';
    }
    if (t !== 'classic') b.setAttribute('data-design', t);
    if (p.accent) b.setAttribute('data-accent', p.accent);
    if (p.glowIntensity) b.setAttribute('data-glow-intensity', p.glowIntensity);
    // Typografie (verhindert Layout-Shift)
    var ty = p.typography;
    if (ty && ty.enabled) {
      b.setAttribute('data-pers-typo', 'on');
      if (ty.baseFontSize)             r.setProperty('--user-font-base', ty.baseFontSize + 'px');
      if (ty.lineHeight)               r.setProperty('--user-line-height', String(ty.lineHeight));
      if (ty.letterSpacing != null)    r.setProperty('--user-letter-spacing', ty.letterSpacing + 'em');
      if (ty.headingScale)             r.setProperty('--user-heading-scale', String(ty.headingScale));
      if (ty.fontFamily && ty.fontFamily !== 'system') b.setAttribute('data-font', ty.fontFamily);
    }
    // Farben (verhindert Farb-Flash)
    var co = p.colors;
    if (co && co.enabled) {
      b.setAttribute('data-pers-colors', 'on');
      if (co.primaryAccent)   r.setProperty('--user-primary', co.primaryAccent);
      if (co.secondaryAccent) r.setProperty('--user-secondary', co.secondaryAccent);
      if (co.errorColor)      r.setProperty('--user-error', co.errorColor);
      if (co.successColor)    r.setProperty('--user-success', co.successColor);
      if (co.backgroundColor) {
        var bg = co.backgroundColor === 'ultra-dark' ? '#020409'
               : co.backgroundColor === 'warm'       ? '#0f1015'
               : co.backgroundColor === 'warm-tint'  ? '#11100c' : '#05070b';
        r.setProperty('--user-bg', bg);
        b.setAttribute('data-bg-variant', co.backgroundColor);
      }
    }
    // Layout-Dichte
    var la = p.layout;
    if (la && la.enabled) {
      b.setAttribute('data-pers-layout', 'on');
      if (la.density) b.setAttribute('data-density', la.density);
    }
  } catch(e) {}
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        {/* FOUC-Prevention: läuft synchron vor React-Hydration */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
