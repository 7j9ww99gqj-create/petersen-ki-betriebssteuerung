import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock lib/auth.ts → hasDemoCookie steuerbar
const hasDemoCookieMock = vi.fn<() => boolean>()
vi.mock('../lib/auth', () => ({
  hasDemoCookie: () => hasDemoCookieMock(),
}))

// Import erst NACH dem Mock
import { ifLive, skipInDemo, useDemoCheck } from '../lib/demo'

describe('ifLive', () => {
  beforeEach(() => hasDemoCookieMock.mockReset())

  it('ruft fn auf, wenn kein Demo-Cookie', async () => {
    hasDemoCookieMock.mockReturnValue(false)
    const fn = vi.fn().mockResolvedValue('echte-daten')
    const result = await ifLive(fn, 'fallback')
    expect(result).toBe('echte-daten')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('liefert demoFallback, wenn Demo-Cookie gesetzt — fn nicht aufgerufen', async () => {
    hasDemoCookieMock.mockReturnValue(true)
    const fn = vi.fn().mockResolvedValue('echte-daten')
    const result = await ifLive(fn, 'demo-daten')
    expect(result).toBe('demo-daten')
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('skipInDemo', () => {
  beforeEach(() => hasDemoCookieMock.mockReset())

  it('führt fn aus und liefert result, wenn live', async () => {
    hasDemoCookieMock.mockReturnValue(false)
    const fn = vi.fn().mockResolvedValue({ id: '1' })
    const out = await skipInDemo(fn)
    expect(out.skipped).toBe(false)
    expect(out.result).toEqual({ id: '1' })
  })

  it('überspringt und liefert skipped=true im Demo-Modus', async () => {
    hasDemoCookieMock.mockReturnValue(true)
    const fn = vi.fn()
    const out = await skipInDemo(fn)
    expect(out.skipped).toBe(true)
    expect(out.result).toBeUndefined()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('useDemoCheck', () => {
  beforeEach(() => hasDemoCookieMock.mockReset())

  it('exponiert isDemo + when + whenAsync', () => {
    hasDemoCookieMock.mockReturnValue(false)
    const c = useDemoCheck()
    expect(c.isDemo).toBe(false)
    expect(c.when(() => 'live', 'demo')).toBe('live')
  })

  it('when liefert Demo-Wert im Demo-Modus', () => {
    hasDemoCookieMock.mockReturnValue(true)
    const c = useDemoCheck()
    expect(c.isDemo).toBe(true)
    const liveFn = vi.fn().mockReturnValue('live')
    expect(c.when(liveFn, 'demo')).toBe('demo')
    expect(liveFn).not.toHaveBeenCalled()
  })

  it('whenAsync liefert Demo-Wert im Demo-Modus', async () => {
    hasDemoCookieMock.mockReturnValue(true)
    const c = useDemoCheck()
    const liveFn = vi.fn().mockResolvedValue('live')
    await expect(c.whenAsync(liveFn, 'demo')).resolves.toBe('demo')
    expect(liveFn).not.toHaveBeenCalled()
  })
})
