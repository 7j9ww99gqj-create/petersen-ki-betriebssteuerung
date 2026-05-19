import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  promptTextSchema,
  shortTextSchema,
  decimalAmountSchema,
  isoDateSchema,
} from '@/lib/validation'

describe('validation schemas', () => {
  describe('promptTextSchema', () => {
    it('akzeptiert normalen Text', () => {
      expect(promptTextSchema.safeParse('Hallo Welt').success).toBe(true)
    })

    it('lehnt leeren String ab', () => {
      expect(promptTextSchema.safeParse('').success).toBe(false)
    })

    it('lehnt nur-Whitespace ab', () => {
      expect(promptTextSchema.safeParse('   ').success).toBe(false)
    })

    it('lehnt Text über 8000 Zeichen ab', () => {
      expect(promptTextSchema.safeParse('a'.repeat(8001)).success).toBe(false)
    })

    it('akzeptiert 8000 Zeichen genau', () => {
      expect(promptTextSchema.safeParse('a'.repeat(8000)).success).toBe(true)
    })

    it('trimmt Whitespace am Rand', () => {
      const result = promptTextSchema.parse('  Hallo  ')
      expect(result).toBe('Hallo')
    })

    it('lehnt Nicht-Strings ab', () => {
      expect(promptTextSchema.safeParse(null).success).toBe(false)
      expect(promptTextSchema.safeParse(123).success).toBe(false)
      expect(promptTextSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('shortTextSchema', () => {
    it('akzeptiert kurze Strings', () => {
      expect(shortTextSchema.safeParse('Test').success).toBe(true)
    })

    it('lehnt String über 500 Zeichen ab', () => {
      expect(shortTextSchema.safeParse('a'.repeat(501)).success).toBe(false)
    })
  })

  describe('decimalAmountSchema', () => {
    it('akzeptiert deutsche Dezimalzahlen mit Komma', () => {
      expect(decimalAmountSchema.safeParse('123,45').success).toBe(true)
    })

    it('akzeptiert englische Dezimalzahlen mit Punkt', () => {
      expect(decimalAmountSchema.safeParse('123.45').success).toBe(true)
    })

    it('akzeptiert Ganzzahlen', () => {
      expect(decimalAmountSchema.safeParse('100').success).toBe(true)
    })

    it('akzeptiert negative Beträge', () => {
      expect(decimalAmountSchema.safeParse('-50,00').success).toBe(true)
    })

    it('lehnt Buchstaben ab', () => {
      expect(decimalAmountSchema.safeParse('abc').success).toBe(false)
    })

    it('lehnt mehrere Dezimaltrennzeichen ab', () => {
      expect(decimalAmountSchema.safeParse('1.2.3').success).toBe(false)
    })
  })

  describe('isoDateSchema', () => {
    it('akzeptiert YYYY-MM-DD', () => {
      expect(isoDateSchema.safeParse('2026-05-19').success).toBe(true)
    })

    it('akzeptiert ISO-Timestamp', () => {
      expect(isoDateSchema.safeParse('2026-05-19T12:34:56.789Z').success).toBe(true)
    })

    it('lehnt DD.MM.YYYY ab', () => {
      expect(isoDateSchema.safeParse('19.05.2026').success).toBe(false)
    })

    it('lehnt leeren String ab', () => {
      expect(isoDateSchema.safeParse('').success).toBe(false)
    })
  })

  describe('Composite Schemas (Beispiel-Use-Case)', () => {
    const MahnungInput = z.object({
      betrag: decimalAmountSchema,
      faellig: isoDateSchema,
      ton: z.enum(['freundlich', 'bestimmt', 'streng']).optional(),
    })

    it('valider Mahnungs-Input passt', () => {
      const result = MahnungInput.safeParse({
        betrag: '199,99',
        faellig: '2026-06-30',
        ton: 'bestimmt',
      })
      expect(result.success).toBe(true)
    })

    it('invalider Ton wird abgelehnt', () => {
      const result = MahnungInput.safeParse({
        betrag: '100,00',
        faellig: '2026-06-30',
        ton: 'agressiv',
      })
      expect(result.success).toBe(false)
    })
  })
})
