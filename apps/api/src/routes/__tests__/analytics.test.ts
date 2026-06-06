import { describe, it, expect, vi, beforeEach } from 'vitest'

// As importações de 'analytics' são sempre dinâmicas (await import) dentro de cada teste.
// vi.resetModules() no beforeEach reseta o singleton — se importar no topo do arquivo, o singleton
// fica cacheado e os testes interferem entre si.

// Mock posthog-node antes de importar o módulo
vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    shutdown: vi.fn(),
  })),
}))

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.POSTHOG_KEY = 'phc_test'
    process.env.POSTHOG_HOST = 'https://app.posthog.com'
    process.env.NODE_ENV = 'test'
  })

  it('capture chama posthog.capture com evento e propriedades corretos', async () => {
    const { PostHog } = await import('posthog-node')
    const mockCapture = vi.fn()
    ;(PostHog as any).mockImplementation(function() { return { capture: mockCapture, shutdown: vi.fn() } })

    const { capture } = await import('../../services/analytics.js')
    capture('user-123', 'user_logged_in', { method: 'email' })

    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user-123',
      event: 'user_logged_in',
      properties: expect.objectContaining({
        method: 'email',
        environment: 'test',
      }),
    })
  })

  it('capture não lança exceção se POSTHOG_KEY não estiver definido', async () => {
    delete process.env.POSTHOG_KEY
    const { capture } = await import('../../services/analytics.js')
    expect(() => capture('user-123', 'test_event')).not.toThrow()
  })

  it('capture não propaga exceção interna do posthog', async () => {
    const { PostHog } = await import('posthog-node')
    ;(PostHog as any).mockImplementation(function() {
      return {
        capture: vi.fn().mockImplementation(() => { throw new Error('posthog error') }),
        shutdown: vi.fn(),
      }
    })
    const { capture } = await import('../../services/analytics.js')
    expect(() => capture('user-123', 'test_event')).not.toThrow()
  })
})
