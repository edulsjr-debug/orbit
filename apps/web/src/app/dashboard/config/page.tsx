'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'

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

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setPhone(user.phone ?? '')
    }
  }, [user])

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
    if (pwNew !== pwConfirm) {
      setPwMsg({ ok: false, text: 'As senhas não coincidem' })
      return
    }
    if (pwNew.length < 6) {
      setPwMsg({ ok: false, text: 'A nova senha deve ter pelo menos 6 caracteres' })
      return
    }
    setSavingPw(true)
    setPwMsg(null)
    try {
      await api.patch('/auth/me', { password: pwNew, currentPassword: pwCurrent })
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
      setPwMsg({ ok: true, text: '✓ Senha alterada com sucesso' })
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.message })
    } finally {
      setSavingPw(false)
    }
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
