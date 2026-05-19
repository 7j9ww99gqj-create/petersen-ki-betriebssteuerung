import { describe, it, expect } from 'vitest'
import { calcCostEur, extractUsage } from '@/lib/ai-usage'

describe('ai-usage', () => {
  describe('calcCostEur', () => {
    it('berechnet gpt-4o-mini Input-Kosten', () => {
      // 1M Input-Tokens = 0,138 EUR
      expect(calcCostEur('gpt-4o-mini', 1_000_000, 0)).toBeCloseTo(0.138, 4)
    })

    it('berechnet gpt-4o-mini Output-Kosten', () => {
      // 1M Output-Tokens = 0,552 EUR
      expect(calcCostEur('gpt-4o-mini', 0, 1_000_000)).toBeCloseTo(0.552, 4)
    })

    it('berechnet kombinierte Kosten', () => {
      // 1000 in + 500 out
      const cost = calcCostEur('gpt-4o-mini', 1000, 500)
      // (1000 * 0.138 + 500 * 0.552) / 1_000_000 = (138 + 276) / 1M = 0.000414
      expect(cost).toBeCloseTo(0.000414, 6)
    })

    it('nutzt gpt-4o-mini als Fallback für unbekanntes Modell', () => {
      const fallback = calcCostEur('unknown-model', 1000, 500)
      const reference = calcCostEur('gpt-4o-mini', 1000, 500)
      expect(fallback).toBe(reference)
    })

    it('handhabt null Model', () => {
      expect(calcCostEur(null, 1000, 0)).toBeGreaterThan(0)
    })

    it('handhabt 0 Tokens', () => {
      expect(calcCostEur('gpt-4o-mini', 0, 0)).toBe(0)
    })

    it('gpt-4o ist teurer als gpt-4o-mini', () => {
      const mini = calcCostEur('gpt-4o-mini', 1000, 1000)
      const full = calcCostEur('gpt-4o', 1000, 1000)
      expect(full).toBeGreaterThan(mini)
    })

    it('rundet auf 6 Dezimalstellen', () => {
      const cost = calcCostEur('gpt-4o-mini', 1, 1)
      // Sollte gerundet sein
      const decimals = String(cost).split('.')[1] ?? ''
      expect(decimals.length).toBeLessThanOrEqual(6)
    })
  })

  describe('extractUsage', () => {
    it('extrahiert OpenAI Chat-Completions Format', () => {
      const usage = extractUsage({ usage: { prompt_tokens: 100, completion_tokens: 50 } })
      expect(usage).toEqual({ input: 100, output: 50 })
    })

    it('extrahiert OpenAI Responses-API Format', () => {
      const usage = extractUsage({ usage: { input_tokens: 200, output_tokens: 75 } })
      expect(usage).toEqual({ input: 200, output: 75 })
    })

    it('bevorzugt input_tokens vor prompt_tokens', () => {
      const usage = extractUsage({ usage: { input_tokens: 200, prompt_tokens: 100 } })
      expect(usage.input).toBe(200)
    })

    it('liefert 0/0 bei fehlender Usage', () => {
      expect(extractUsage({})).toEqual({ input: 0, output: 0 })
      expect(extractUsage(null)).toEqual({ input: 0, output: 0 })
      expect(extractUsage(undefined)).toEqual({ input: 0, output: 0 })
    })

    it('liefert 0 für fehlende Einzelfelder', () => {
      const usage = extractUsage({ usage: { prompt_tokens: 100 } })
      expect(usage).toEqual({ input: 100, output: 0 })
    })
  })
})
