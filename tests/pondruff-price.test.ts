import { describe, it, expect } from 'vitest'
import {
  blankPricePosition,
  calcPricePosition,
  isPondruffUser,
  normalizePriceCoating,
  priceDefaultFactor,
  priceLookupRate,
  money,
  PRICE_COATINGS,
  PRICE_EXCEL_PI,
} from '../lib/pondruff'

describe('isPondruffUser', () => {
  it('matcht die offizielle Pondruff-Email case-insensitive', () => {
    expect(isPondruffUser('info@pondruffpolierservice.de')).toBe(true)
    expect(isPondruffUser('Info@PondruffPolierservice.de')).toBe(true)
  })
  it('lehnt andere Emails ab', () => {
    expect(isPondruffUser('info@petersen-ki-pilot.de')).toBe(false)
    expect(isPondruffUser(null)).toBe(false)
    expect(isPondruffUser(undefined)).toBe(false)
    expect(isPondruffUser('')).toBe(false)
  })
})

describe('normalizePriceCoating', () => {
  it('mappt bekannte Varianten auf kanonische Namen', () => {
    expect(normalizePriceCoating('crn')).toBe('CrN')
    expect(normalizePriceCoating('crn-dlc')).toBe('CrN-DLC')
    expect(normalizePriceCoating('duplex meta va')).toBe('Duplex Meta-VA')
    expect(normalizePriceCoating('tialn')).toBe('TiaLN')
  })
  it('fällt auf TiCN zurück bei Unbekanntem oder Leerem', () => {
    expect(normalizePriceCoating('')).toBe('TiCN')
    expect(normalizePriceCoating('völlig unbekannt')).toBe('TiCN')
  })
  it('belässt bereits korrekte Namen', () => {
    for (const c of PRICE_COATINGS) {
      expect(normalizePriceCoating(c)).toBe(c)
    }
  })
})

describe('priceDefaultFactor', () => {
  it('liefert konfigurierten Faktor', () => {
    expect(priceDefaultFactor('CrN')).toBe(1.10)
    expect(priceDefaultFactor('CrN-DLC')).toBe(1.60)
    expect(priceDefaultFactor('Duplex Meta-CAX')).toBe(1.50)
  })
  it('liefert 1.0 bei unbekannter Beschichtung', () => {
    expect(priceDefaultFactor('NichtExistent')).toBe(1.0)
  })
})

describe('priceLookupRate', () => {
  it('liefert ersten Tabellenwert für sehr kleine Volumen', () => {
    expect(priceLookupRate(500)).toBeCloseTo(2.55645940598109, 6)
    expect(priceLookupRate(1000)).toBeCloseTo(2.55645940598109, 6)
  })
  it('greift Stufen korrekt', () => {
    expect(priceLookupRate(2000)).toBeCloseTo(1.27822970299055, 6)
    expect(priceLookupRate(50000)).toBeCloseTo(0.460162693076597, 6)
    expect(priceLookupRate(1_000_000)).toBeCloseTo(0.214742590102412, 6)
  })
  it('liefert 0 bei nicht-positivem Volumen', () => {
    expect(priceLookupRate(0)).toBe(0)
    expect(priceLookupRate(-100)).toBe(0)
  })
  it('liefert den letzten Stufenwert für sehr große Volumen', () => {
    expect(priceLookupRate(50_000_000)).toBeCloseTo(0.0511291881196219, 6)
  })
})

describe('money', () => {
  it('rundet kaufmännisch auf 2 Nachkommastellen', () => {
    expect(money(1.005)).toBe(1.01)
    expect(money(2.345)).toBe(2.35)
    expect(money(0)).toBe(0)
  })
})

describe('calcPricePosition', () => {
  it('berechnet eckige Position korrekt', () => {
    const pos = { ...blankPricePosition('Eckig'), length: 100, width: 50, height: 20, coating: 'CrN', quantity: 1, factor: 0 }
    const r = calcPricePosition(pos)
    expect(r.volume).toBe(100 * 50 * 20)
    expect(r.unit_price).toBeGreaterThan(0)
    expect(r.final_total).toBe(r.normal_total)
  })

  it('berechnet runde Position mit PI', () => {
    const pos = { ...blankPricePosition('Rund'), diameter: 50, length: 100, coating: 'TiCN', quantity: 1, factor: 0 }
    const r = calcPricePosition(pos)
    expect(r.volume).toBeCloseTo((50 * 50) * PRICE_EXCEL_PI / 4 * 100, 4)
  })

  it('TiN nutzt anderen Multiplier (1.0 statt 1.2)', () => {
    const baseEckig = blankPricePosition('Eckig')
    const posTiCN = { ...baseEckig, length: 100, width: 100, height: 100, coating: 'TiCN', quantity: 1, factor: 0 }
    const posTiN = { ...baseEckig, length: 100, width: 100, height: 100, coating: 'TiN', quantity: 1, factor: 0 }
    const rTiCN = calcPricePosition(posTiCN)
    const rTiN = calcPricePosition(posTiN)
    expect(rTiN.unit_price).toBeLessThan(rTiCN.unit_price)
  })

  it('Rabatt reduziert final_total', () => {
    const pos = { ...blankPricePosition('Eckig'), length: 100, width: 50, height: 20, coating: 'CrN', quantity: 2, factor: 0, discount: 10 }
    const r = calcPricePosition(pos)
    expect(r.final_total).toBeLessThan(r.normal_total)
    expect(r.discount_amount).toBeCloseTo(r.normal_total - r.final_total, 2)
    expect(r.final_total).toBeCloseTo(money(r.normal_total * 0.9), 2)
  })

  it('liefert 0-Preis bei Volumen 0', () => {
    const pos = { ...blankPricePosition('Eckig'), length: 0, width: 0, height: 0, coating: 'CrN', quantity: 1, factor: 0 }
    const r = calcPricePosition(pos)
    expect(r.unit_price).toBe(0)
    expect(r.normal_total).toBe(0)
    expect(r.final_total).toBe(0)
  })

  it('Discount wird auf [0, 100] geklemmt', () => {
    const base = { ...blankPricePosition('Eckig'), length: 100, width: 50, height: 20, coating: 'CrN', quantity: 1, factor: 0 }
    const r100 = calcPricePosition({ ...base, discount: 100 })
    expect(r100.final_total).toBe(0)
    const rNeg = calcPricePosition({ ...base, discount: -50 })
    expect(rNeg.final_total).toBe(rNeg.normal_total)
  })
})

describe('mhdStatus-Logik (Verhalten-Spec)', () => {
  // mhdStatus lebt heute lokal in lager/page.tsx. Dieser Test dokumentiert die erwartete
  // Logik als Spec — wenn die Funktion einmal extrahiert wird, kann sie hier direkt importiert werden.
  function mhdStatus(mhd: string | undefined, now = Date.now()): 'abgelaufen' | 'kritisch' | 'ok' | 'kein' {
    if (!mhd) return 'kein'
    const diff = (new Date(mhd).getTime() - now) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'abgelaufen'
    if (diff < 30) return 'kritisch'
    return 'ok'
  }

  const now = new Date('2026-05-19T12:00:00Z').getTime()

  it('gibt "kein" bei leerem MHD', () => {
    expect(mhdStatus(undefined, now)).toBe('kein')
    expect(mhdStatus('', now)).toBe('kein')
  })
  it('gibt "abgelaufen" wenn in der Vergangenheit', () => {
    expect(mhdStatus('2026-05-01', now)).toBe('abgelaufen')
  })
  it('gibt "kritisch" wenn < 30 Tage entfernt', () => {
    expect(mhdStatus('2026-05-25', now)).toBe('kritisch')
    expect(mhdStatus('2026-06-15', now)).toBe('kritisch')
  })
  it('gibt "ok" wenn >= 30 Tage entfernt', () => {
    expect(mhdStatus('2026-07-01', now)).toBe('ok')
    expect(mhdStatus('2027-01-01', now)).toBe('ok')
  })
})
