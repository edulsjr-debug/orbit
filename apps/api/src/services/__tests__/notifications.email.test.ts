import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEmailsSend = vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null })

vi.mock('resend', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Resend: vi.fn(function (this: any) { return { emails: { send: mockEmailsSend } } }),
}))

describe('sendWelcomeEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_FROM = 'Orbit <noreply@prumosaas.com.br>'
    mockEmailsSend.mockClear()
  })

  it('chama resend.emails.send com destinatário e assunto corretos', async () => {
    const { sendWelcomeEmail } = await import('../notifications.js')
    await sendWelcomeEmail('teste@example.com', 'Ana')

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'teste@example.com',
        subject: 'Bem-vindo ao Orbit',
      })
    )
  })

  it('usa EMAIL_FROM como remetente', async () => {
    const { sendWelcomeEmail } = await import('../notifications.js')
    await sendWelcomeEmail('teste@example.com', 'Carlos')

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Orbit <noreply@prumosaas.com.br>',
      })
    )
  })

  it('inclui nome do usuário no corpo HTML', async () => {
    const { sendWelcomeEmail } = await import('../notifications.js')
    await sendWelcomeEmail('teste@example.com', 'Beatriz')

    const callArg = mockEmailsSend.mock.calls[0][0] as { html: string }
    expect(callArg.html).toContain('Beatriz')
  })

  it('não chama Resend quando RESEND_API_KEY está ausente', async () => {
    delete process.env.RESEND_API_KEY
    const { sendWelcomeEmail } = await import('../notifications.js')
    // getResendClient() lança em runtime ao verificar process.env — sendEmail captura o erro
    await sendWelcomeEmail('teste@example.com', 'Diego')
    expect(mockEmailsSend).not.toHaveBeenCalled()
  })
})

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_FROM = 'Orbit <noreply@prumosaas.com.br>'
    mockEmailsSend.mockClear()
  })

  it('envia com assunto correto', async () => {
    const { sendPasswordResetEmail } = await import('../notifications.js')
    await sendPasswordResetEmail('user@example.com', 'Ab3Xy9Qz')

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Sua nova senha do Orbit',
      })
    )
  })

  it('inclui a nova senha no HTML', async () => {
    const { sendPasswordResetEmail } = await import('../notifications.js')
    await sendPasswordResetEmail('user@example.com', 'Ab3Xy9Qz')

    const callArg = mockEmailsSend.mock.calls[0][0] as { html: string }
    expect(callArg.html).toContain('Ab3Xy9Qz')
  })

  it('não chama Resend quando RESEND_API_KEY está ausente', async () => {
    delete process.env.RESEND_API_KEY
    const { sendPasswordResetEmail } = await import('../notifications.js')
    await sendPasswordResetEmail('user@example.com', 'Ab3Xy9Qz')
    expect(mockEmailsSend).not.toHaveBeenCalled()
  })
})
