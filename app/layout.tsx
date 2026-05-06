import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Petersen KI Betriebssteuerung',
  description: 'KI-unterstütztes Warenwirtschaftssystem – Modulare Piloten für Ihren Betrieb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
