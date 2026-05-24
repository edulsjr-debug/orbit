'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { PushSetup } from '@/components/PushSetup'

type User = { id: string; name: string; email: string }
type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string }

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

const NAV = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/dashboard/compromissos', icon: '📅', label: 'Compromissos' },
  { href: '/dashboard/tarefas', icon: '✔️', label: 'Tarefas' },
  { href: '/dashboard/projetos', icon: '📁', label: 'Projetos' },
  { href: '/dashboard/notificacoes', icon: '🔔', label: 'Notificações' },
  { href: '/dashboard/config', icon: '⚙️', label: 'Configurações' },
]

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
const COMMIT = (process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev').slice(0, 7)

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [bellOpen, setBellOpen] = useState(false)

  const { data: user } = useSWR<User>('/auth/me', fetcher)
  const { data: countData } = useSWR('/notifications/unread-count', fetcher, { refreshInterval: 30000 })
  const { data: notifications = [] } = useSWR<Notification[]>(
    bellOpen ? '/notifications' : null,
    fetcher
  )

  const unreadCount: number = countData?.count ?? 0
  const firstName = user?.name?.split(' ')[0] ?? '...'
  const initial = user?.name?.[0]?.toUpperCase() ?? '?'

  const recentNotifs = notifications.filter((n) => !n.read).slice(0, 3)

  async function logout() {
    await api.post('/auth/logout', {})
    router.push('/login')
    router.refresh()
  }

  async function markAllRead() {
    await api.post('/notifications/read-all', {})
    mutate('/notifications/unread-count')
    mutate('/notifications')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <PushSetup />

      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🌀</div>
          <div>
            <div style={S.logoName}>Orbit</div>
            <div style={S.logoSub}>Agenda inteligente</div>
          </div>
        </div>

        <nav style={{ padding: '14px 12px', flex: 1 }}>
          {NAV.map((item) => (
            <div
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{ ...S.navItem, ...(pathname === item.href ? S.navActive : {}) }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        <div style={S.userRow} onClick={logout} title="Clique para sair">
          <div style={S.avatar}>{initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</div>
            <div style={{ color: '#475569', fontSize: 11 }}>Sair ↩</div>
          </div>
        </div>

        {/* Versão */}
        <div style={S.versionBar}>
          v{VERSION} · <span style={{ fontFamily: 'monospace' }}>{COMMIT}</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={S.topbar}>
          <div style={{ flex: 1 }} />

          {/* Bell */}
          <div style={{ position: 'relative' }}>
            <button style={S.bellBtn} onClick={() => setBellOpen((v) => !v)}>
              🔔
              {unreadCount > 0 && (
                <span style={S.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {bellOpen && (
              <div style={S.bellDrop}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Notificações</span>
                  {unreadCount > 0 && (
                    <button style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer' }} onClick={markAllRead}>
                      Marcar todas como lidas
                    </button>
                  )}
                </div>

                {recentNotifs.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    {unreadCount === 0 ? 'Nenhuma notificação não lida' : 'Carregando...'}
                  </div>
                ) : recentNotifs.map((n) => (
                  <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{n.body}</div>
                  </div>
                ))}

                <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span
                    style={{ color: '#6366f1', fontSize: 13, cursor: 'pointer' }}
                    onClick={() => { setBellOpen(false); router.push('/dashboard/notificacoes') }}
                  >
                    Ver todas →
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* User chip */}
          <div style={S.chip} onClick={() => router.push('/dashboard/config')}>
            <div style={S.avatar}>{initial}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{firstName}</span>
          </div>
        </header>

        <main style={S.content}>{children}</main>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  sidebar: { width: 240, flexShrink: 0, background: '#0f172a', display: 'flex', flexDirection: 'column' },
  logo: { padding: '20px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { width: 38, height: 38, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  logoName: { color: '#fff', fontSize: 18, fontWeight: 800 },
  logoSub: { color: '#475569', fontSize: 10 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', marginBottom: 2, fontSize: 13.5, fontWeight: 500 },
  navActive: { background: '#1e1b4b', color: '#818cf8' },
  userRow: { padding: 12, borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  versionBar: { padding: '6px 14px', borderTop: '1px solid #1e293b', fontSize: 10, color: '#334155', textAlign: 'center' },
  topbar: { height: 60, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0 },
  bellBtn: { position: 'relative', width: 38, height: 38, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 17 },
  bellBadge: { position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', padding: '0 3px' },
  bellDrop: { position: 'absolute', top: 46, right: 0, width: 320, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, boxShadow: '0 16px 32px rgba(0,0,0,.12)', zIndex: 100 },
  chip: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 30, cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', padding: 24 },
}
