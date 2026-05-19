import { describe, it, expect } from 'vitest'
import { mhdStatus, getBestStellplatz, type LagerHelperArtikel, type LagerHelperStellplatz } from '../lib/lager-helpers'

describe('mhdStatus', () => {
  const now = new Date('2026-05-19T12:00:00Z').getTime()

  it('liefert "kein" bei leerem MHD', () => {
    expect(mhdStatus(undefined, now)).toBe('kein')
    expect(mhdStatus('', now)).toBe('kein')
  })

  it('liefert "abgelaufen" wenn Datum in Vergangenheit', () => {
    expect(mhdStatus('2026-05-01', now)).toBe('abgelaufen')
    expect(mhdStatus('2025-12-31', now)).toBe('abgelaufen')
  })

  it('liefert "kritisch" bei < 30 Tagen', () => {
    expect(mhdStatus('2026-05-25', now)).toBe('kritisch')
    expect(mhdStatus('2026-06-15', now)).toBe('kritisch')
  })

  it('liefert "ok" bei >= 30 Tagen', () => {
    expect(mhdStatus('2026-07-01', now)).toBe('ok')
    expect(mhdStatus('2027-01-01', now)).toBe('ok')
  })
})

describe('getBestStellplatz', () => {
  const artikel: LagerHelperArtikel = {
    id: 'ART-1',
    name: 'Bohrer 10mm',
    kategorie: 'Werkzeuge',
    bestand: 5,
    einheit: 'Stk',
    lagerplatz: 'A-01-02',
    status: 'ok',
  }

  const sp = (id: string, partial: Partial<LagerHelperStellplatz> = {}): LagerHelperStellplatz => ({
    id,
    code: id,
    aktiv: true,
    ...partial,
  })

  it('liefert null bei undefined artikel', () => {
    expect(getBestStellplatz(undefined, [], [])).toBeNull()
  })

  it('liefert null wenn keine aktiven Stellplätze', () => {
    const sps = [sp('SP-1', { aktiv: false })]
    expect(getBestStellplatz(artikel, sps, [])).toBeNull()
  })

  it('Warengruppen-Match liefert höchsten Score', () => {
    const sps = [
      sp('SP-1', { code: 'B-01-01' }),
      sp('SP-2', { code: 'B-02-01', warengruppe: 'Werkzeuge' }),
      sp('SP-3', { code: 'B-03-01' }),
    ]
    const result = getBestStellplatz(artikel, sps, [])
    expect(result?.stellplatz.id).toBe('SP-2')
    expect(result?.grund).toContain('gleiche Warengruppe')
  })

  it('Lagerplatz-Prefix-Match wirkt', () => {
    const sps = [
      sp('SP-1', { code: 'A-99-99' }),  // prefix-match auf 'A-'
      sp('SP-2', { code: 'B-01-01' }),
    ]
    const result = getBestStellplatz(artikel, sps, [{ stellplatz_id: 'SP-1' }, { stellplatz_id: 'SP-2' }])
    // SP-1: prefix-match (+1), nicht frei (0) = 1
    // SP-2: nicht frei (0) = 0
    expect(result?.stellplatz.id).toBe('SP-1')
  })

  it('freier Stellplatz wird bevorzugt wenn alles andere gleich', () => {
    const sps = [
      sp('SP-1', { code: 'B-01-01' }),  // belegt
      sp('SP-2', { code: 'B-02-01' }),  // frei
    ]
    const result = getBestStellplatz(artikel, sps, [{ stellplatz_id: 'SP-1' }])
    expect(result?.stellplatz.id).toBe('SP-2')
    expect(result?.grund).toContain('freier Stellplatz')
  })

  it('Kühl-Typ für Betriebsstoffe', () => {
    const betriebsstoff: LagerHelperArtikel = { ...artikel, kategorie: 'Betriebsstoffe', lagerplatz: '' }
    const sps = [
      sp('SP-1', { code: 'X-01-01' }),
      sp('SP-2', { code: 'X-02-01', typ: 'Kühlung' }),
    ]
    const result = getBestStellplatz(betriebsstoff, sps, [])
    expect(result?.stellplatz.id).toBe('SP-2')
    expect(result?.grund).toContain('passende Temperaturzone')
  })

  it('fallback auf ersten aktiven Stellplatz wenn kein Score', () => {
    const artikelNoLocation: LagerHelperArtikel = { ...artikel, kategorie: 'Sonstiges', lagerplatz: '' }
    const sps = [
      sp('SP-1', { code: 'X-01-01' }),
      sp('SP-2', { code: 'X-02-01' }),
    ]
    // Beide nicht-belegt → beide +2, gleichstand → erster.
    const result = getBestStellplatz(artikelNoLocation, sps, [{ stellplatz_id: 'SP-1' }, { stellplatz_id: 'SP-2' }])
    // Beide belegt, kein Score → fallback erster aktiver
    expect(result?.stellplatz.id).toBe('SP-1')
    expect(result?.grund[0]).toContain('kein spezifischer Treffer')
  })
})
