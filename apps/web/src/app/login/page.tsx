'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useGoogleLogin } from '@react-oauth/google'
import { BellRing } from 'lucide-react'

function OrbitMark({ size = 84 }: { size?: number }) {
  const r = Math.round(size * 0.28)
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: 'var(--brand-600, #1E4FA0)',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        inset: Math.round(size * 0.2),
        borderRadius: '50%',
        border: `${Math.max(2, Math.round(size * 0.04))}px solid rgba(255,255,255,0.9)`,
      }} />
      <span style={{
        position: 'absolute',
        inset: Math.round(size * 0.38),
        borderRadius: '50%',
        background: '#fff',
      }} />
      <span style={{
        position: 'absolute',
        top: Math.round(size * 0.2),
        right: Math.round(size * 0.2),
        width: Math.max(4, Math.round(size * 0.1)),
        height: Math.max(4, Math.round(size * 0.1)),
        borderRadius: '50%',
        background: 'var(--brand-300, #8FB3F4)',
      }} />
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginFailed, setLoginFailed] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [failedEmail, setFailedEmail] = useState('')

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async ({ access_token }) => {
      setLoading(true)
      setError('')
      setLoginFailed(false)
      setResetSent(false)
      try {
        await api.post('/auth/google', { access_token })
        router.push('/inicio')
        router.refresh()
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Falha ao autenticar com o Google. Tente novamente.'),
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoginFailed(false)
    setResetSent(false)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const password = fd.get('password') as string
    const name = fd.get('name') as string

    try {
      if (mode === 'login') {
        await api.post('/auth/login', { email, password })
      } else {
        await api.post('/auth/register', { name, email, password })
      }
      router.push('/inicio')
      router.refresh()
    } catch (err: any) {
      const errCode = (err as any).code
      if (errCode === 'USE_GOOGLE_LOGIN') {
        setError('Esta conta foi criada com Google. Use o botão "Continuar com o Google" acima.')
      } else {
        setError(err.message)
      }
      if (mode === 'login') {
        setLoginFailed(errCode !== 'USE_GOOGLE_LOGIN')
        setFailedEmail(fd.get('email') as string)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    // lê o email atual do campo (não o capturado no erro — pode ter sido corrigido)
    const currentEmail = (document.querySelector('input[name="email"]') as HTMLInputElement)?.value ?? failedEmail
    setResetLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: currentEmail })
    } catch {
      // always show generic message — don't reveal failures
    } finally {
      setResetSent(true)
      setLoginFailed(false)
      setResetLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.frame}>
        <section style={styles.brandPanel}>
          <div style={styles.brandGrid} />
          <div style={styles.brandGlow} />

          <div style={styles.brandInner}>
            <div style={styles.heroBlock}>
              <OrbitMark />
              <div>
                <div style={styles.productLabel}>Orbit</div>
                <h1 style={styles.heroTitle}>
                  Organize o dia{' '}
                  <span style={styles.heroTitleAccent}>com clareza.</span>
                </h1>
                <p style={styles.heroText}>
                  Compromissos, tarefas e projetos em um fluxo confiavel, continuo e facil
                  de acompanhar.
                </p>
              </div>
            </div>

            <div style={styles.heroCard}>
              <div style={styles.metricRow}>
                <div>
                  <div style={styles.metricLabel}>Hoje</div>
                  <div style={styles.metricValue}>08 tarefas</div>
                </div>
                <div style={styles.metricPill}>3 alertas ativos</div>
              </div>

              <div style={styles.previewList}>
                <div style={styles.previewItem}>
                  <span style={styles.previewTime}>09:00</span>
                  <span style={styles.previewText}>Revisao de prioridades</span>
                </div>
                <div style={styles.previewItem}>
                  <span style={styles.previewTime}>11:30</span>
                  <span style={styles.previewText}>Follow-up com cliente</span>
                </div>
                <div style={styles.previewItem}>
                  <span style={styles.previewTime}>15:00</span>
                  <span style={styles.previewText}>Entrega de projeto</span>
                </div>
              </div>
            </div>

            <div style={styles.featureStrip}>
              <div style={styles.featureItem}>
                <span style={styles.featureKicker}>Notificações</span>
                <strong style={styles.featureValue}>Celular + navegador</strong>
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureKicker}>Fluxo</span>
                <strong style={styles.featureValue}>Tudo no mesmo espaço</strong>
              </div>
            </div>
          </div>
        </section>

        <section style={styles.formPanel}>
          <div style={styles.formShell}>
            <div style={styles.headerBlock}>
              <div style={styles.endorsementLight}>Orbit, um produto Prumo</div>

              <div>
                <h2 style={styles.formTitle}>
                  {mode === 'login' ? 'Entrar no seu fluxo' : 'Criar sua conta'}
                </h2>
                <p style={styles.formText}>
                  {mode === 'login'
                    ? 'Acesse sua rotina com compromissos, tarefas e notificacoes no mesmo lugar.'
                    : 'Comece com uma base simples e confiavel para organizar o trabalho.'}
                </p>
              </div>
            </div>

            <div style={styles.modeSwitch}>
              <button
                type="button"
                onClick={() => { setMode('login'); setLoginFailed(false); setResetSent(false) }}
                style={{
                  ...styles.modeButton,
                  ...(mode === 'login' ? styles.modeButtonActive : {}),
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setLoginFailed(false); setResetSent(false) }}
                style={{
                  ...styles.modeButton,
                  ...(mode === 'register' ? styles.modeButtonActive : {}),
                }}
              >
                Criar conta
              </button>
            </div>

            <button
              type="button"
              onClick={() => loginWithGoogle()}
              disabled={loading}
              style={styles.googleButton}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar com o Google
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>ou</span>
              <span style={styles.dividerLine} />
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {mode === 'register' && (
                <div style={styles.field}>
                  <label style={styles.label}>Nome</label>
                  <input
                    name="name"
                    type="text"
                    required
                    style={styles.input}
                    placeholder="Seu nome"
                  />
                </div>
              )}

              <div style={styles.field}>
                <label style={styles.label}>E-mail</label>
                <input
                  name="email"
                  type="email"
                  required
                  style={styles.input}
                  placeholder="seu@email.com"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Senha</label>
                <input
                  name="password"
                  type="password"
                  required
                  style={styles.input}
                  placeholder="••••••••"
                />
              </div>

              {error && <div style={styles.error}>{error}</div>}

              {loginFailed && !resetSent && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  style={{ ...styles.forgotButton, ...(resetLoading ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                >
                  {resetLoading ? 'Enviando...' : 'Esqueci minha senha'}
                </button>
              )}

              {resetSent && (
                <div style={styles.resetMessage}>
                  Se esse email está cadastrado, você receberá a nova senha em breve.
                </div>
              )}

              <button type="submit" disabled={loading} style={styles.submitButton}>
                {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            <div style={styles.footerNote}>
              <BellRing size={14} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2, color: 'var(--brand-400, #5C90EE)' }} />
              <span>Notificações em tempo real para compromissos, tarefas e projetos.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg-subtle, #FAFBFC)',
    padding: 'clamp(16px, 3vw, 32px)',
  },
  frame: {
    width: '100%',
    maxWidth: 1080,
    minHeight: 600,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 20px 60px rgba(11,15,20,0.12)',
  },
  brandPanel: {
    position: 'relative',
    background: 'radial-gradient(120% 90% at 8% 0%, var(--brand-700, #0E335A) 0%, var(--brand-900, #061A33) 55%, #04101F 100%)',
    color: '#fff',
    overflow: 'hidden',
    minHeight: 480,
  },
  brandGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
    backgroundSize: '64px 64px',
    maskImage: 'radial-gradient(ellipse at top left, black 30%, transparent 70%)',
  },
  brandGlow: {
    position: 'absolute',
    display: 'none',
  },
  brandInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
    minHeight: 480,
    padding: 'clamp(28px, 4vw, 44px)',
  },
  heroBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  orbitMark: {},
  orbitRing: {},
  orbitCore: {},
  productLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--brand-300, #8FB3F4)',
  },
  heroTitle: {
    fontSize: 'clamp(34px, 5vw, 48px)',
    lineHeight: 1.05,
    letterSpacing: '-0.03em',
    fontWeight: 700,
    color: '#fff',
    marginTop: 8,
  },
  heroTitleAccent: {
    fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
    fontStyle: 'italic',
    color: 'var(--brand-300, #8FB3F4)',
  },
  heroText: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 1.7,
    maxWidth: 420,
  },
  heroCard: {
    marginTop: 'auto',
    paddingTop: 28,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 24,
    backdropFilter: 'blur(10px)',
  },
  metricRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.58)',
  },
  metricValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: '-0.03em',
  },
  metricPill: {
    padding: '8px 12px',
    borderRadius: 9999,
    background: 'rgba(143,179,244,0.16)',
    color: 'var(--brand-200, #C5D7F9)',
    fontSize: 11,
    fontWeight: 600,
  },
  previewList: {
    marginTop: 20,
    display: 'grid',
    gap: 10,
  },
  previewItem: {
    display: 'grid',
    gridTemplateColumns: '64px 1fr',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  previewTime: {
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    color: 'var(--brand-300, #8FB3F4)',
    fontSize: 12,
    fontWeight: 500,
  },
  previewText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
  },
  featureStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginTop: 24,
  },
  featureItem: {
    padding: '16px 18px 18px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  featureKicker: {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.56)',
  },
  featureValue: {
    display: 'block',
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.5,
    color: '#fff',
  },
  formPanel: {
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(28px, 4vw, 48px) clamp(20px, 3vw, 40px)',
  },
  formShell: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  headerBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  endorsementLight: {
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  },
  formTitle: {
    fontSize: 'clamp(28px, 4vw, 36px)',
    lineHeight: 1.1,
    letterSpacing: '-0.03em',
    color: 'var(--fg-1, #111827)',
    fontWeight: 700,
  },
  formText: {
    marginTop: 10,
    color: 'var(--fg-2, #4B5563)',
    fontSize: 14,
    lineHeight: 1.7,
  },
  modeSwitch: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: 4,
    borderRadius: 12,
    background: 'var(--ink-100, #F3F4F6)',
    border: '1px solid var(--ink-200, #E5E7EB)',
  },
  modeButton: {
    border: 'none',
    background: 'transparent',
    borderRadius: 8,
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--fg-3, #6B7280)',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  modeButtonActive: {
    background: '#fff',
    color: 'var(--fg-1, #111827)',
    boxShadow: '0 1px 4px rgba(11,15,20,0.10)',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    border: '1px solid var(--ink-200, #E5E7EB)',
    background: '#fff',
    borderRadius: 10,
    padding: '13px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
    transition: 'background 120ms',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--ink-200, #E5E7EB)',
    display: 'block',
  } as React.CSSProperties,
  dividerText: {
    fontSize: 12,
    color: 'var(--fg-4, #9CA3AF)',
    fontWeight: 500,
  },
  form: {
    display: 'grid',
    gap: 14,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--fg-2, #4B5563)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  input: {
    width: '100%',
    border: '1px solid var(--ink-200, #E5E7EB)',
    background: '#fff',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    color: 'var(--fg-1, #111827)',
    outline: 'none',
    transition: 'border-color 120ms, box-shadow 120ms',
  },
  error: {
    borderRadius: 10,
    padding: '12px 14px',
    background: '#FEE2E2',
    border: '1px solid #FECACA',
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 1.6,
  },
  submitButton: {
    marginTop: 4,
    border: 'none',
    borderRadius: 10,
    padding: '14px 18px',
    background: 'var(--brand-500, #2F6FE0)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 120ms',
  },
  footerNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    color: 'var(--fg-3, #6B7280)',
    fontSize: 12,
    lineHeight: 1.6,
  },
  footerLine: {},
  forgotButton: {
    border: 'none',
    background: 'transparent',
    padding: '0 4px',
    fontSize: 13,
    color: 'var(--brand-500, #2F6FE0)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textAlign: 'left' as const,
    fontWeight: 500,
  },
  resetMessage: {
    borderRadius: 10,
    padding: '12px 14px',
    background: '#DCFCE7',
    border: '1px solid #BBF7D0',
    color: '#166534',
    fontSize: 13,
    lineHeight: 1.6,
  },
}
