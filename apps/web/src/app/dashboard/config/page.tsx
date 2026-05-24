'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { subscribePush, unsubscribePush } from '@/lib/push'

type User = {
  id: string
  name: string
  email: string
  phone?: string
  createdAt: string
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

export default function ConfigPage() {
  const { data: user } = useSWR<User>('/auth/me', fetcher)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Server status
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'slow' | 'offline'>('checking')
  const [serverMs, setServerMs] = useState<number | null>(null)

  useEffect(() => {
    async function checkServer() {
      setServerStatus('checking')
      const t0 = Date.now()
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        const ms = Date.now() - t0
        setServerMs(ms)
        setServerStatus(res.ok ? (ms > 3000 ? 'slow' : 'online') : 'offline')
      } catch {
        setServerStatus('offline')
        setServerMs(null)
      }
    }
    checkServer()
    const iv = setInterval(checkServer, 30_000)
    return () => clearInterval(iv)
  }, [])

  // Push state
  const [pushStatus, setPushStatus] = useState<'loading' | 'unsupported' | 'denied' | 'active' | 'inactive'>('loading')
  const [pushMsg, setPushMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setPhone(user.phone ?? '')
    }
  }, [user])

  useEffect(() => {
    async function checkPush() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushStatus('unsupported')
        return
      }
      const perm = Notification.permission
      if (perm === 'denied') { setPushStatus('denied'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setPushStatus(sub ? 'active' : 'inactive')
    }
    checkPush()
  }, [])

  async function saveProfile() {
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      await api.patch('/auth/me', { name, phone: phone || undefined })
      mutate('/auth/me')
      setProfileMsg({ ok: true, text: '✓ Perfil atualizado com sucesso' })
    } catch (e: any) {
      setProfileMsg({ ok: false, text: e.message })
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: 'As senhas não coincidem' }); return }
    if (pwNew.length < 6) { setPwMsg({ ok: false, text: 'A nova senha deve ter pelo menos 6 caracteres' }); return }
    setSavingPw(true)
    setPwMsg(null)
    try {
      await api.patch('/auth/me', { password: pwNew, currentPassword: pwCurrent })
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwMsg({ ok: true, text: '✓ Senha alterada com sucesso' })
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.message })
    } finally {
      setSavingPw(false)
    }
  }

  async function enablePush() {
    setPushBusy(true)
    setPushMsg(null)
    try {
      const vapidRes = await fetch('/api/push/vapid-key', { credentials: 'include' })
      const { publicKey } = await vapidRes.json()
      if (!publicKey) throw new Error('Chave VAPID não disponível')

      const subscription = await subscribePush(publicKey)
      if (!subscription) throw new Error('Permissão negada ou navegador não suporta push')

      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      setPushStatus('active')
      setPushMsg({ ok: true, text: '✓ Notificações ativadas com sucesso!' })

      // Envia push de teste para confirmar
      await fetch('/api/notifications/push-test', { method: 'POST', credentials: 'include' })
    } catch (e: any) {
      setPushMsg({ ok: false, text: e.message ?? 'Erro ao ativar notificações' })
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePush() {
    setPushBusy(true)
    try {
      await unsubscribePush()
      await fetch('/api/push/subscribe', { method: 'DELETE', credentials: 'include' })
      setPushStatus('inactive')
      setPushMsg({ ok: true, text: 'Notificações desativadas' })
    } catch (e: any) {
      setPushMsg({ ok: false, text: e.message })
    } finally {
      setPushBusy(false)
    }
  }

  const pushLabels: Record<string, string> = {
    loading: 'Verificando...',
    unsupported: 'Não suportado neste navegador',
    denied: 'Bloqueado — libere nas configurações do navegador',
    active: '🟢 Notificações ativas',
    inactive: '⚪ Notificações desativadas',
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={S.title}>Configurações</h2>
        <p style={S.sub}>Gerencie seu perfil e preferências</p>
      </div>

      {/* Perfil */}
      <div style={S.section}>
        <div style={S.sectionTitle}>👤 Perfil</div>
        <div style={S.avatarRow}>
          <div style={S.avatar}>{user?.name?.[0]?.toUpperCase() ?? '?'}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{user?.email}</div>
          </div>
        </div>
        <Field label="Nome">
          <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Telefone">
          <input style={S.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 51 99999-9999" />
        </Field>
        <Field label="E-mail">
          <input style={{ ...S.input, background: '#f8fafc', color: '#94a3b8' }} value={user?.email ?? ''} disabled />
        </Field>
        {profileMsg && (
          <div style={{ ...S.msg, color: profileMsg.ok ? '#16a34a' : '#dc2626', background: profileMsg.ok ? '#f0fdf4' : '#fef2f2' }}>
            {profileMsg.text}
          </div>
        )}
        <button style={S.btn} onClick={saveProfile} disabled={savingProfile || !name}>
          {savingProfile ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>

      {/* Notificações Push */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🔔 Notificações push</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
          Receba alertas de compromissos diretamente no navegador.
        </div>
        <div style={{ fontSize: 13, marginBottom: 16, color: '#374151' }}>
          Status: <strong>{pushLabels[pushStatus]}</strong>
        </div>
        {pushMsg && (
          <div style={{ ...S.msg, color: pushMsg.ok ? '#16a34a' : '#dc2626', background: pushMsg.ok ? '#f0fdf4' : '#fef2f2', marginBottom: 14 }}>
            {pushMsg.text}
          </div>
        )}
        {pushStatus === 'inactive' && (
          <button style={S.btn} onClick={enablePush} disabled={pushBusy}>
            {pushBusy ? 'Ativando...' : 'Ativar notificações'}
          </button>
        )}
        {pushStatus === 'active' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={S.btn} onClick={enablePush} disabled={pushBusy}>
              {pushBusy ? 'Testando...' : 'Enviar push de teste'}
            </button>
            <button
              style={{ ...S.btn, background: '#f1f5f9', color: '#64748b' }}
              onClick={disablePush}
              disabled={pushBusy}
            >
              Desativar
            </button>
          </div>
        )}
        {pushStatus === 'denied' && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
            Para reativar: clique no cadeado na barra de endereço → Notificações → Permitir
          </div>
        )}
      </div>

      {/* Senha */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🔒 Alterar senha</div>
        <Field label="Senha atual">
          <input type="password" style={S.input} value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="••••••••" />
        </Field>
        <Field label="Nova senha">
          <input type="password" style={S.input} value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </Field>
        <Field label="Confirmar nova senha">
          <input type="password" style={S.input} value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Repita a nova senha" />
        </Field>
        {pwMsg && (
          <div style={{ ...S.msg, color: pwMsg.ok ? '#16a34a' : '#dc2626', background: pwMsg.ok ? '#f0fdf4' : '#fef2f2' }}>
            {pwMsg.text}
          </div>
        )}
        <button style={S.btn} onClick={savePassword} disabled={savingPw || !pwCurrent || !pwNew}>
          {savingPw ? 'Salvando...' : 'Alterar senha'}
        </button>
      </div>

      {/* Sobre */}
      <div style={S.section}>
        <div style={S.sectionTitle}>ℹ️ Informações da conta</div>
        <div style={S.infoRow}>
          <span style={{ color: '#64748b', fontSize: 13 }}>Conta criada em</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '—'}
          </span>
        </div>
        <div style={S.infoRow}>
          <span style={{ color: '#64748b', fontSize: 13 }}>Versão do Orbit</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>1.0.0</span>
        </div>
        <div style={{ ...S.infoRow, borderBottom: 'none', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: 13 }}>Servidor</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
              background: serverStatus === 'online' ? '#22c55e'
                : serverStatus === 'slow' ? '#f59e0b'
                : serverStatus === 'offline' ? '#ef4444'
                : '#94a3b8',
              boxShadow: serverStatus === 'online' ? '0 0 6px #22c55e'
                : serverStatus === 'slow' ? '0 0 6px #f59e0b'
                : serverStatus === 'offline' ? '0 0 6px #ef4444'
                : 'none',
            }} />
            {serverStatus === 'checking' && 'Verificando…'}
            {serverStatus === 'online' && `Online${serverMs ? ` · ${serverMs}ms` : ''}`}
            {serverStatus === 'slow' && `Acordando… · ${serverMs}ms`}
            {serverStatus === 'offline' && 'Offline'}
          </span>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</label>
      {children}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title: { fontSize: 20, fontWeight: 800 },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  section: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' },
  avatarRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '12px 14px', background: '#f8fafc', borderRadius: 10 },
  avatar: { width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20 },
  btn: { padding: '10px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 4 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  msg: { padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc' },
}
