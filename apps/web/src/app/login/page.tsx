'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
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
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.logo}>
          <div style={styles.icon}>🌀</div>
          <h1 style={styles.h1}>Orbit</h1>
          <p style={styles.sub}>Agenda inteligente com notificações em tempo real</p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={styles.field}>
              <label style={styles.label}>Nome</label>
              <input name="name" type="text" required style={styles.input} placeholder="Seu nome" />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>E-mail</label>
            <input name="email" type="email" required style={styles.input} placeholder="seu@email.com" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input name="password" type="password" required style={styles.input} placeholder="••••••••" />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div style={styles.footer}>
          {mode === 'login' ? (
            <>Não tem conta? <a onClick={() => setMode('register')} style={styles.link}>Criar conta</a></>
          ) : (
            <>Já tem conta? <a onClick={() => setMode('login')} style={styles.link}>Entrar</a></>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1e1b4b,#312e81,#4338ca)' },
  box: { background: '#fff', borderRadius: 20, padding: '48px 40px', width: 400, boxShadow: '0 25px 50px rgba(0,0,0,.25)' },
  logo: { textAlign: 'center', marginBottom: 32 },
  icon: { width: 60, height: 60, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 12 },
  h1: { fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: -1 },
  sub: { color: '#64748b', fontSize: 13, marginTop: 4 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' },
  input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', color: '#0f172a' },
  error: { background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  btn: { width: '100%', padding: 13, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  footer: { textAlign: 'center', marginTop: 18, fontSize: 13, color: '#94a3b8' },
  link: { color: '#6366f1', cursor: 'pointer' },
}
