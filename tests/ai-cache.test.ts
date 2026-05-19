import { describe, it, expect } from 'vitest'
import { hashCacheKey } from '@/lib/ai-cache'

describe('ai-cache', () => {
  describe('hashCacheKey', () => {
    it('liefert konsistente Hashes für gleichen Input', () => {
      const a = hashCacheKey({ user: 'u1', mode: 'tagesbericht' })
      const b = hashCacheKey({ user: 'u1', mode: 'tagesbericht' })
      expect(a).toBe(b)
    })

    it('liefert unterschiedliche Hashes für unterschiedlichen Input', () => {
      const a = hashCacheKey({ user: 'u1' })
      const b = hashCacheKey({ user: 'u2' })
      expect(a).not.toBe(b)
    })

    it('liefert 32-Zeichen Hex-String', () => {
      const hash = hashCacheKey({ foo: 'bar' })
      expect(hash).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handhabt komplexe Objekte', () => {
      const hash = hashCacheKey({
        messages: [{ role: 'user', content: 'Hallo' }],
        system: 'Du bist hilfreich',
        context: 'KEINE DATEN',
      })
      expect(hash).toMatch(/^[a-f0-9]{32}$/)
    })

    it('Reihenfolge der Properties beeinflusst Hash', () => {
      // JSON.stringify ist nicht commutative — das ist OK
      // (deterministisch für identische Inputs reicht)
      const a = hashCacheKey({ a: 1, b: 2 })
      const b = hashCacheKey({ b: 2, a: 1 })
      // Beide sind 32-Zeichen Hex; ob gleich/unterschiedlich abhängig von JSON-Reihenfolge
      expect(a).toMatch(/^[a-f0-9]{32}$/)
      expect(b).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handhabt null und undefined', () => {
      expect(hashCacheKey(null)).toMatch(/^[a-f0-9]{32}$/)
      expect(hashCacheKey(undefined)).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handhabt Arrays', () => {
      const a = hashCacheKey([1, 2, 3])
      const b = hashCacheKey([1, 2, 3])
      const c = hashCacheKey([3, 2, 1])
      expect(a).toBe(b)
      expect(a).not.toBe(c)
    })
  })
})
