import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

describe('rate-limit', () => {
  it('erlaubt die ersten Requests im default-Bucket', () => {
    const userId = `test-default-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(userId, 'default')).toBeNull()
    }
  })

  it('blockt nach max-Anzahl im ai-Bucket', () => {
    const userId = `test-ai-${Date.now()}`
    // 20 erlaubt im ai-Bucket
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(userId, 'ai')).toBeNull()
    }
    // 21. Anfrage muss blocken
    const blocked = checkRateLimit(userId, 'ai')
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)
  })

  it('blockt nach 10 im ocr-Bucket', () => {
    const userId = `test-ocr-${Date.now()}`
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(userId, 'ocr')).toBeNull()
    }
    expect(checkRateLimit(userId, 'ocr')!.status).toBe(429)
  })

  it('isoliert Buckets — ai-Limit beeinflusst ocr nicht', () => {
    const userId = `test-isolation-${Date.now()}`
    // ai voll machen
    for (let i = 0; i < 21; i++) checkRateLimit(userId, 'ai')
    // ocr darf noch
    expect(checkRateLimit(userId, 'ocr')).toBeNull()
  })

  it('isoliert User — ein User-Limit beeinflusst anderen nicht', () => {
    const userA = `test-userA-${Date.now()}`
    const userB = `test-userB-${Date.now()}`
    for (let i = 0; i < 21; i++) checkRateLimit(userA, 'ai')
    expect(checkRateLimit(userB, 'ai')).toBeNull()
  })

  it('429-Response enthält retryAfter-Header', async () => {
    const userId = `test-header-${Date.now()}`
    for (let i = 0; i < 20; i++) checkRateLimit(userId, 'ai')
    const blocked = checkRateLimit(userId, 'ai')!
    expect(blocked.headers.get('Retry-After')).toBeDefined()
    const body = await blocked.json()
    expect(body.retryAfter).toBeGreaterThan(0)
    expect(body.error).toMatch(/Rate-Limit/)
  })
})
