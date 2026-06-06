'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { GoogleLogin } from '@react-oauth/google'

function OrbitMark({ size = 84 }: { size?: number }) {
  return (
    <div
      style={{ ...styles.orbitMark, width: size, height: size, borderRadius: Math.round(size * 0.28) }}
      aria-hidden="true"
    >
      <span
        style={{
          ...styles.orbitRing,
          inset: Math.round(size * 0.2),
          borderWidth: Math.max(2, Math.round(size * 0.035)),
        }}
      />
      <span style={{ ...styles.orbitCore, inset: Math.round(size * 0.375) }} />
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

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) {
      setError('Falha ao autenticar com o Google. Tente novamente.')
      return
    }
    setLoading(true)
    setError('')
    setLoginFailed(false)
    setResetSent(false)
    try {
      await api.post('/auth/google', { credential: credentialResponse.credential })
      router.push('/inicio')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
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
                <h1 style={styles.heroTitle}>Organize o dia com clareza.</h1>
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

            <div style={{ ...styles.googleSection, pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1 }}>
              <div style={styles.googleClip}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Falha ao autenticar com o Google. Tente novamente.')}
                  text="continue_with"
                  theme="outline"
                  size="large"
                  width={800}
                />
              </div>
            </div>

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
              <span style={styles.footerLine} />
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
    padding: 'clamp(16px, 3vw, 32px)',
    background:
      'radial-gradient(circle at top left, rgba(90,90,230,0.18), transparent 28%), linear-gradient(135deg, #050B14 0%, #0B1421 40%, #101C2B 100%)',
  },
  frame: {
    minHeight: 'calc(100vh - 64px)',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    borderRadius: '32px',
    overflow: 'hidden',
    border: '1px solid rgba(245,242,236,0.12)',
    boxShadow: '0 30px 90px rgba(0,0,0,0.32)',
    background: '#F5F2EC',
  },
  brandPanel: {
    position: 'relative',
    background: 'linear-gradient(180deg, rgba(5,11,20,0.96) 0%, rgba(9,18,30,0.98) 100%)',
    color: '#F5F2EC',
    overflow: 'hidden',
  },
  brandGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(245,242,236,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245,242,236,0.05) 1px, transparent 1px)',
    backgroundSize: '72px 72px',
    maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.65), transparent 88%)',
  },
  brandGlow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '50%',
    top: -120,
    right: -120,
    background: 'radial-gradient(circle, rgba(90,90,230,0.2), transparent 70%)',
  },
  brandInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '100%',
    padding: 'clamp(24px, 4vw, 40px)',
  },
  heroBlock: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 22,
    alignItems: 'center',
    marginTop: 8,
  },
  orbitMark: {
    position: 'relative',
    background: 'linear-gradient(180deg, #050B14 0%, #0E1724 100%)',
    border: '1px solid rgba(245,242,236,0.12)',
    flexShrink: 0,
  },
  orbitRing: {
    position: 'absolute',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.95)',
  },
  orbitCore: {
    position: 'absolute',
    borderRadius: '50%',
    background: '#FFFFFF',
  },
  productLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: 'rgba(245,242,236,0.92)',
    letterSpacing: '-0.02em',
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 'clamp(38px, 6vw, 52px)',
    lineHeight: 1.02,
    letterSpacing: '-0.05em',
    fontWeight: 700,
  },
  heroText: {
    marginTop: 14,
    maxWidth: 460,
    color: 'rgba(245,242,236,0.74)',
    fontSize: 16,
    lineHeight: 1.7,
  },
  heroCard: {
    marginTop: 34,
    background: 'rgba(245,242,236,0.04)',
    border: '1px solid rgba(245,242,236,0.1)',
    borderRadius: 24,
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
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'rgba(245,242,236,0.58)',
  },
  metricValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: '-0.04em',
  },
  metricPill: {
    padding: '10px 12px',
    borderRadius: 999,
    background: 'rgba(90,90,230,0.16)',
    color: '#E3E5FF',
    fontSize: 12,
    fontWeight: 600,
  },
  previewList: {
    marginTop: 26,
    display: 'grid',
    gap: 12,
  },
  previewItem: {
    display: 'grid',
    gridTemplateColumns: '68px 1fr',
    alignItems: 'center',
    gap: 14,
    paddingTop: 12,
    borderTop: '1px solid rgba(245,242,236,0.08)',
  },
  previewTime: {
    color: '#AEB4FF',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  previewText: {
    color: 'rgba(245,242,236,0.88)',
    fontSize: 14,
  },
  featureStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginTop: 30,
  },
  featureItem: {
    padding: '18px 18px 20px',
    borderRadius: 20,
    background: 'rgba(245,242,236,0.04)',
    border: '1px solid rgba(245,242,236,0.08)',
  },
  featureKicker: {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(245,242,236,0.56)',
  },
  featureValue: {
    display: 'block',
    marginTop: 10,
    fontSize: 15,
    lineHeight: 1.5,
    color: '#F5F2EC',
  },
  formPanel: {
    background:
      'linear-gradient(180deg, rgba(245,242,236,0.98) 0%, rgba(240,235,226,0.98) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(24px, 4vw, 32px) clamp(18px, 3vw, 24px)',
  },
  formShell: {
    width: '100%',
    maxWidth: 450,
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  headerBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  endorsementLight: {
    fontSize: 11,
    color: '#64748B',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  formTitle: {
    fontSize: 'clamp(34px, 6vw, 42px)',
    lineHeight: 1.05,
    letterSpacing: '-0.05em',
    color: '#050B14',
    fontWeight: 700,
  },
  formText: {
    marginTop: 14,
    color: '#475569',
    fontSize: 15,
    lineHeight: 1.7,
  },
  modeSwitch: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: 4,
    borderRadius: 16,
    background: 'rgba(5,11,20,0.06)',
    border: '1px solid rgba(5,11,20,0.08)',
  },
  modeButton: {
    border: 'none',
    background: 'transparent',
    borderRadius: 12,
    padding: '14px 16px',
    fontSize: 14,
    fontWeight: 700,
    color: '#64748B',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  modeButtonActive: {
    background: '#FFFFFF',
    color: '#050B14',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
  },
  form: {
    display: 'grid',
    gap: 16,
  },
  field: {
    display: 'grid',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  input: {
    width: '100%',
    border: '1px solid rgba(5,11,20,0.1)',
    background: 'rgba(255,255,255,0.78)',
    borderRadius: 16,
    padding: '15px 16px',
    fontSize: 15,
    color: '#050B14',
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
  },
  error: {
    borderRadius: 16,
    padding: '14px 16px',
    background: 'rgba(153, 27, 27, 0.08)',
    border: '1px solid rgba(153, 27, 27, 0.14)',
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 1.6,
  },
  submitButton: {
    marginTop: 8,
    border: 'none',
    borderRadius: 16,
    padding: '16px 18px',
    background: 'linear-gradient(135deg, #050B14 0%, #101C2B 100%)',
    color: '#F5F2EC',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 18px 36px rgba(5,11,20,0.18)',
  },
  footerNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#64748B',
    fontSize: 13,
    lineHeight: 1.6,
  },
  footerLine: {
    width: 32,
    height: 1,
    background: 'rgba(5,11,20,0.18)',
    flexShrink: 0,
  },
  forgotButton: {
    border: 'none',
    background: 'transparent',
    padding: '0 4px',
    fontSize: 13,
    color: '#475569',
    cursor: 'pointer',
    textDecoration: 'underline',
    textAlign: 'left' as const,
    fontWeight: 500,
  },
  resetMessage: {
    borderRadius: 16,
    padding: '14px 16px',
    background: 'rgba(5, 100, 5, 0.06)',
    border: '1px solid rgba(5, 100, 5, 0.14)',
    color: '#166534',
    fontSize: 13,
    lineHeight: 1.6,
  },
  googleSection: {
    width: '100%',
  },
  googleClip: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'rgba(5,11,20,0.12)',
    display: 'block',
  } as React.CSSProperties,
  dividerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 500,
    letterSpacing: '0.04em',
  },
}
