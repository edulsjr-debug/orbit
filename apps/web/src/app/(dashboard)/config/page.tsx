'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { registerSW, subscribePush, unsubscribePush } from '@/lib/push'
import { useIsMobile } from '@/lib/use-mobile'

type User = {
  id: string
  name: string
  email: string
  phone?: string
  createdAt: string
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

function PrumoMark() {
  return (
    <svg viewBox="0 0 28 56" width="8" height="16" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="4" height="48" fill="#050B14" />
      <rect x="10" y="4" width="12" height="16" fill="#2F6FE0" />
    </svg>
  )
}

export default function ConfigPage() {
  const isMobile = useIsMobile()
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


  const [pushStatus, setPushStatus] = useState<
    'loading' | 'unsupported' | 'denied' | 'active' | 'inactive'
  >('loading')
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
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        setPushStatus('unsupported')
        return
      }
      const perm = Notification.permission
      if (perm === 'denied') {
        setPushStatus('denied')
        return
      }

      await registerSW()
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
      setProfileMsg({ ok: true, text: 'Perfil atualizado com sucesso.' })
    } catch (e: any) {
      setProfileMsg({ ok: false, text: e.message })
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (pwNew !== pwConfirm) {
      setPwMsg({ ok: false, text: 'As senhas não coincidem.' })
      return
    }
    if (pwNew.length < 6) {
      setPwMsg({ ok: false, text: 'A nova senha deve ter pelo menos 6 caracteres.' })
      return
    }
    setSavingPw(true)
    setPwMsg(null)
    try {
      await api.patch('/auth/me', { password: pwNew, currentPassword: pwCurrent })
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
      setPwMsg({ ok: true, text: 'Senha alterada com sucesso.' })
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
      await registerSW()

      const vapidRes = await fetch('/api/push/vapid-key', { credentials: 'include' })
      if (!vapidRes.ok) throw new Error('Não foi possível carregar a chave de notificações.')
      const { publicKey } = await vapidRes.json()
      if (!publicKey) throw new Error('Chave VAPID não disponível.')

      const subscription = await subscribePush(publicKey)
      if (!subscription) throw new Error('Permissão negada ou navegador sem suporte.')

      const subscribeRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      if (!subscribeRes.ok) {
        const err = await subscribeRes.json().catch(() => null)
        throw new Error(err?.error ?? 'Não foi possível salvar a inscrição de notificações.')
      }

      setPushStatus('active')
      setPushMsg({ ok: true, text: 'Notificações ativadas com sucesso.' })

      const testRes = await fetch('/api/notifications/push-test', {
        method: 'POST',
        credentials: 'include',
      })
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => null)
        throw new Error(err?.error ?? 'A inscrição foi salva, mas o push de teste falhou.')
      }
    } catch (e: any) {
      setPushMsg({ ok: false, text: e.message ?? 'Erro ao ativar notificações.' })
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
      setPushMsg({ ok: true, text: 'Notificações desativadas.' })
    } catch (e: any) {
      setPushMsg({ ok: false, text: e.message })
    } finally {
      setPushBusy(false)
    }
  }

  const pushLabels: Record<string, string> = {
    loading: 'Verificando',
    unsupported: 'Sem suporte neste navegador',
    denied: 'Bloqueado no navegador',
    active: 'Ativo',
    inactive: 'Desativado',
  }

  return (
    <div>
      <section style={S.hero}>
        <div>
          <div style={S.eyebrow}>Conta e preferências</div>
          <h1 style={S.title}>Configurações do Orbit.</h1>
          <p style={S.sub}>
            Ajuste perfil, segurança e notificações mantendo o produto alinhado ao seu fluxo.
          </p>
        </div>

        <div style={S.endorsement}>
          <span>Orbit, um produto</span>
          <span style={S.endorsementBrand}>
            <PrumoMark />
            Prumo
          </span>
        </div>
      </section>

      <div style={{ ...S.grid, ...(isMobile ? { gridTemplateColumns: '1fr' } : null) }}>
        <section style={S.card}>
          <div style={S.cardHead}>
            <div>
              <div style={S.cardTitle}>Perfil</div>
              <div style={S.cardSub}>Dados básicos da conta</div>
            </div>
          </div>

          <div style={S.avatarRow}>
            <div style={S.avatar}>{user?.name?.[0]?.toUpperCase() ?? '?'}</div>
            <div>
              <div style={S.profileName}>{user?.name}</div>
              <div style={S.profileEmail}>{user?.email}</div>
            </div>
          </div>

          <Field label="Nome">
            <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input
              style={S.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 51 99999-9999"
            />
          </Field>
          <Field label="E-mail">
            <input
              style={{ ...S.input, background: 'var(--bg-subtle, #FAFBFC)', color: 'var(--fg-3, #6B7280)' }}
              value={user?.email ?? ''}
              disabled
            />
          </Field>

          {profileMsg && (
            <div
              style={{
                ...S.msg,
                color: profileMsg.ok ? '#16A34A' : '#DC2626',
                background: profileMsg.ok ? 'rgba(34,197,94,.08)' : 'rgba(220,38,38,.08)',
              }}
            >
              {profileMsg.text}
            </div>
          )}

          <button style={S.btnPrimary} onClick={saveProfile} disabled={savingProfile || !name}>
            {savingProfile ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </section>

        <section style={S.card}>
          <div style={S.cardHead}>
            <div>
              <div style={S.cardTitle}>Notificações push</div>
              <div style={S.cardSub}>Alertas no navegador e no dispositivo</div>
            </div>
          </div>

          <div style={S.statusRow}>
            <span style={S.statusLabel}>Status</span>
            <span style={S.statusValue}>{pushLabels[pushStatus]}</span>
          </div>

          {pushMsg && (
            <div
              style={{
                ...S.msg,
                color: pushMsg.ok ? '#16A34A' : '#DC2626',
                background: pushMsg.ok ? 'rgba(34,197,94,.08)' : 'rgba(220,38,38,.08)',
              }}
            >
              {pushMsg.text}
            </div>
          )}

          {pushStatus === 'inactive' && (
            <button style={S.btnPrimary} onClick={enablePush} disabled={pushBusy}>
              {pushBusy ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}

          {pushStatus === 'active' && (
            <div style={S.actionsRow}>
              <button style={S.btnPrimary} onClick={enablePush} disabled={pushBusy}>
                {pushBusy ? 'Enviando...' : 'Push de teste'}
              </button>
              <button style={S.btnGhost} onClick={disablePush} disabled={pushBusy}>
                Desativar
              </button>
            </div>
          )}

          {pushStatus === 'denied' && (
            <div style={S.helpText}>
              Libere as notificações no navegador para voltar a receber alertas.
            </div>
          )}
        </section>

        <section style={S.card}>
          <div style={S.cardHead}>
            <div>
              <div style={S.cardTitle}>Segurança</div>
              <div style={S.cardSub}>Atualize sua senha de acesso</div>
            </div>
          </div>

          <Field label="Senha atual">
            <input
              type="password"
              style={S.input}
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Nova senha">
            <input
              type="password"
              style={S.input}
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type="password"
              style={S.input}
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </Field>

          {pwMsg && (
            <div
              style={{
                ...S.msg,
                color: pwMsg.ok ? '#16A34A' : '#DC2626',
                background: pwMsg.ok ? 'rgba(34,197,94,.08)' : 'rgba(220,38,38,.08)',
              }}
            >
              {pwMsg.text}
            </div>
          )}

          <button
            style={S.btnPrimary}
            onClick={savePassword}
            disabled={savingPw || !pwCurrent || !pwNew}
          >
            {savingPw ? 'Salvando...' : 'Alterar senha'}
          </button>
        </section>

      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={S.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 18,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--brand-500, #2F6FE0)',
    marginBottom: 10,
  },
  title: {
    fontSize: 'clamp(28px, 4vw, 38px)',
    fontWeight: 700,
    letterSpacing: '-0.05em',
    color: 'var(--fg-1, #111827)',
  },
  sub: {
    marginTop: 10,
    fontSize: 14,
    color: 'var(--fg-3, #6B7280)',
    lineHeight: 1.7,
  },
  endorsement: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    background: 'var(--bg, #FFFFFF)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    color: 'var(--fg-3, #6B7280)',
    fontSize: 12,
    fontWeight: 600,
  },
  endorsementBrand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--fg-1, #111827)',
    fontWeight: 700,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'var(--bg, #FFFFFF)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
    borderRadius: 14,
    padding: '20px 22px',
  },
  cardHead: {
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: '1px solid var(--ink-200, #E5E7EB)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--fg-1, #111827)',
  },
  cardSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    padding: '14px 16px',
    background: 'var(--bg-subtle, #FAFBFC)',
    borderRadius: 10,
    border: '1px solid var(--ink-200, #E5E7EB)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'var(--brand-500, #2F6FE0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: 20,
  },
  profileName: {
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--fg-1, #111827)',
  },
  profileEmail: {
    fontSize: 13,
    color: 'var(--fg-3, #6B7280)',
    marginTop: 4,
  },
  fieldLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--fg-3, #6B7280)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    background: 'var(--bg, #FFFFFF)',
    color: 'var(--fg-1, #111827)',
  },
  btnPrimary: {
    padding: '10px 18px',
    background: 'var(--brand-500, #2F6FE0)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '10px 18px',
    background: 'var(--bg-subtle, #FAFBFC)',
    color: 'var(--fg-2, #374151)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  actionsRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: '12px 14px',
    background: 'var(--bg-subtle, #FAFBFC)',
    borderRadius: 10,
    border: '1px solid var(--ink-200, #E5E7EB)',
  },
  statusLabel: {
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
  },
  statusValue: {
    fontSize: 13,
    color: 'var(--fg-1, #111827)',
    fontWeight: 700,
  },
  helpText: {
    marginTop: 12,
    fontSize: 12,
    color: '#DC2626',
    lineHeight: 1.6,
  },
  msg: {
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 14,
  },
}
