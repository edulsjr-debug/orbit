'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { PushSetup } from '@/components/PushSetup'

type User = { id: string; name: string; email: string }
type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string }

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

const NAV = [
  { href: '/dashboard', short: 'IN', label: 'Início' },
  { href: '/dashboard/compromissos', short: 'CO', label: 'Compromissos' },
  { href: '/dashboard/tarefas', short: 'TA', label: 'Tarefas' },
  { href: '/dashboard/projetos', short: 'PR', label: 'Projetos' },
  { href: '/dashboard/notificacoes', short: 'NO', label: 'Notificações' },
  { href: '/dashboard/config', short: 'CF', label: 'Configurações' },
]

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
const COMMIT = (process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev').slice(0, 7)

function PrumoMark({ size = 14, dark = false }: { size?: number; dark?: boolean }) {
  const stem = dark ? '#050B14' : '#F5F2EC'
  const brass = '#B8924F'

  return (
    <svg viewBox="0 0 28 56" width={size / 2} height={size} fill="none" aria-hidden="true">
      <rect x="6" y="4" width="4" height="48" fill={stem} />
      <rect x="10" y="4" width="12" height="16" fill={brass} />
    </svg>
  )
}

function OrbitMark() {
  return (
    <div style={S.orbitMark} aria-hidden="true">
      <span style={S.orbitRing} />
      <span style={S.orbitCore} />
      <span style={S.orbitDot} />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [bellOpen, setBellOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 980)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [pathname, isMobile])

  const { data: user } = useSWR<User>('/auth/me', fetcher)
  const { data: countData } = useSWR('/notifications/unread-count', fetcher, {
    refreshInterval: 30000,
  })
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

  const showSidebar = isMobile ? sidebarOpen : true

  return (
    <div style={S.page}>
      <PushSetup />

      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={S.overlay} />}

      {showSidebar && (
        <aside
          style={{
            ...S.sidebar,
            ...(isMobile
              ? {
                  position: 'fixed',
                  top: 16,
                  left: 16,
                  bottom: 16,
                  zIndex: 50,
                  maxWidth: 320,
                  transform: sidebarOpen ? 'translateX(0)' : 'translateX(-115%)',
                  transition: 'transform 0.25s ease',
                }
              : {}),
          }}
        >
          <div style={S.sidebarTop}>
            <div style={S.logoRow}>
              <OrbitMark />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.logoName}>Orbit</div>
                <div style={S.logoSub}>Organização com estrutura</div>
              </div>
              {isMobile && (
                <button onClick={() => setSidebarOpen(false)} style={S.closeButton}>
                  ×
                </button>
              )}
            </div>

            <div style={S.endorsement}>
              <span style={S.endorsementLabel}>Um produto</span>
              <span style={S.endorsementBrand}>
                <PrumoMark size={14} />
                Prumo
              </span>
            </div>
          </div>

          <nav style={S.nav}>
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  style={{
                    ...S.navItem,
                    ...(active ? S.navItemActive : {}),
                  }}
                >
                  <span style={{ ...S.navGlyph, ...(active ? S.navGlyphActive : {}) }}>
                    {item.short}
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div style={S.sidebarBottom}>
            <button style={S.userCard} onClick={() => router.push('/dashboard/config')}>
              <div style={S.avatar}>{initial}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.userName}>{firstName}</div>
                <div style={S.userMeta}>Conta e preferências</div>
              </div>
            </button>

            <button style={S.logoutButton} onClick={logout}>
              Sair da sessão
            </button>

            <div style={S.versionBar}>
              Orbit v{VERSION} · <span style={{ fontFamily: 'monospace' }}>{COMMIT}</span>
            </div>
          </div>
        </aside>
      )}

      <div style={S.main}>
        <header style={S.topbar}>
          <div style={S.topbarLeft}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={S.menuButton}>
                ☰
              </button>
            )}
            <div>
              <div style={S.topbarTitle}>Painel Orbit</div>
              <div style={S.topbarSub}>Rotina, tarefas e projetos em um só fluxo</div>
            </div>
          </div>

          <div style={S.topbarActions}>
            <div style={{ position: 'relative' }}>
              <button style={S.bellBtn} onClick={() => setBellOpen((v) => !v)}>
                <span style={S.bellIcon}>Notifs</span>
                {unreadCount > 0 && (
                  <span style={S.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {bellOpen && (
                <div
                  style={{
                    ...S.bellDrop,
                    width: isMobile ? 'min(360px, calc(100vw - 24px))' : 340,
                    right: isMobile ? -18 : 0,
                  }}
                >
                  <div style={S.bellHead}>
                    <span style={S.bellTitle}>Notificações</span>
                    {unreadCount > 0 && (
                      <button style={S.bellAction} onClick={markAllRead}>
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  {recentNotifs.length === 0 ? (
                    <div style={S.bellEmpty}>
                      {unreadCount === 0 ? 'Nenhuma notificação não lida' : 'Carregando...'}
                    </div>
                  ) : (
                    recentNotifs.map((n) => (
                      <div key={n.id} style={S.notificationItem}>
                        <div style={S.notificationTitle}>{n.title}</div>
                        <div style={S.notificationBody}>{n.body}</div>
                      </div>
                    ))
                  )}

                  <div style={S.bellFooter}>
                    <button
                      style={S.bellFooterLink}
                      onClick={() => {
                        setBellOpen(false)
                        router.push('/dashboard/notificacoes')
                      }}
                    >
                      Ver central completa
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button style={S.userChip} onClick={() => router.push('/dashboard/config')}>
              <div style={S.avatarSmall}>{initial}</div>
              {!isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={S.userChipName}>{firstName}</span>
                  <span style={S.userChipSub}>Perfil</span>
                </div>
              )}
            </button>
          </div>
        </header>

        <main style={S.content}>{children}</main>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    background: '#EEF1F4',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5,11,20,0.48)',
    zIndex: 40,
  },
  sidebar: {
    width: 288,
    flexShrink: 0,
    background: 'linear-gradient(180deg, #050B14 0%, #0E1724 100%)',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(245,242,236,0.08)',
    color: '#F5F2EC',
  },
  sidebarTop: {
    padding: '24px 20px 18px',
    borderBottom: '1px solid rgba(245,242,236,0.08)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  orbitMark: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 16,
    background: 'rgba(245,242,236,0.04)',
    border: '1px solid rgba(245,242,236,0.12)',
    flexShrink: 0,
  },
  orbitRing: {
    position: 'absolute',
    inset: 9,
    borderRadius: '50%',
    border: '1.8px solid rgba(245,242,236,0.88)',
    transform: 'rotate(-18deg)',
  },
  orbitCore: {
    position: 'absolute',
    inset: 18,
    borderRadius: '50%',
    background: '#B8924F',
  },
  orbitDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#F5F2EC',
  },
  logoName: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.04em',
  },
  logoSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(245,242,236,0.46)',
  },
  closeButton: {
    border: 'none',
    background: 'transparent',
    color: 'rgba(245,242,236,0.7)',
    fontSize: 26,
    cursor: 'pointer',
    lineHeight: 1,
  },
  endorsement: {
    marginTop: 18,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(245,242,236,0.48)',
  },
  endorsementLabel: {},
  endorsementBrand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: '#F5F2EC',
    fontWeight: 600,
    letterSpacing: '0.06em',
  },
  nav: {
    flex: 1,
    display: 'grid',
    gap: 6,
    padding: '18px 14px',
    alignContent: 'start',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 12px',
    borderRadius: 16,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'rgba(245,242,236,0.72)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  navItemActive: {
    background: 'rgba(245,242,236,0.06)',
    border: '1px solid rgba(245,242,236,0.08)',
    color: '#F5F2EC',
  },
  navGlyph: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: 'rgba(245,242,236,0.04)',
    border: '1px solid rgba(245,242,236,0.08)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    letterSpacing: '0.1em',
    color: 'rgba(245,242,236,0.62)',
    flexShrink: 0,
  },
  navGlyphActive: {
    background: 'rgba(184,146,79,0.14)',
    border: '1px solid rgba(184,146,79,0.24)',
    color: '#E9D3A9',
  },
  sidebarBottom: {
    padding: '14px',
    borderTop: '1px solid rgba(245,242,236,0.08)',
    display: 'grid',
    gap: 10,
  },
  userCard: {
    border: '1px solid rgba(245,242,236,0.08)',
    background: 'rgba(245,242,236,0.04)',
    borderRadius: 18,
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    color: '#F5F2EC',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #B8924F 0%, #D4B170 100%)',
    color: '#050B14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 14,
    flexShrink: 0,
  },
  userName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#F5F2EC',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userMeta: {
    marginTop: 3,
    fontSize: 11,
    color: 'rgba(245,242,236,0.44)',
  },
  logoutButton: {
    border: '1px solid rgba(245,242,236,0.08)',
    background: 'transparent',
    color: 'rgba(245,242,236,0.76)',
    borderRadius: 14,
    padding: '11px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  versionBar: {
    fontSize: 10,
    color: 'rgba(245,242,236,0.28)',
    textAlign: 'center',
    paddingTop: 4,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  topbar: {
    height: 78,
    background: 'rgba(245,242,236,0.88)',
    borderBottom: '1px solid rgba(5,11,20,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    padding: '0 clamp(16px, 3vw, 28px)',
    flexShrink: 0,
    backdropFilter: 'blur(10px)',
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  menuButton: {
    border: '1px solid rgba(5,11,20,0.1)',
    background: '#FFFFFF',
    color: '#050B14',
    width: 42,
    height: 42,
    borderRadius: 14,
    fontSize: 18,
    cursor: 'pointer',
    flexShrink: 0,
  },
  topbarTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: '#050B14',
  },
  topbarSub: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
  topbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  bellBtn: {
    position: 'relative',
    minWidth: 82,
    height: 42,
    padding: '0 14px',
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bellIcon: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#475569',
  },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    background: '#991B1B',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #FFFFFF',
    padding: '0 3px',
  },
  bellDrop: {
    position: 'absolute',
    top: 50,
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 20,
    boxShadow: '0 24px 48px rgba(5,11,20,0.14)',
    overflow: 'hidden',
    zIndex: 100,
  },
  bellHead: {
    padding: '16px 18px',
    borderBottom: '1px solid #EDF1F4',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  bellTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: '#050B14',
  },
  bellAction: {
    background: 'transparent',
    border: 'none',
    color: '#8A6A2F',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  bellEmpty: {
    padding: '22px 18px',
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
  },
  notificationItem: {
    padding: '14px 18px',
    borderBottom: '1px solid #F3F5F7',
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#050B14',
  },
  notificationBody: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 1.5,
  },
  bellFooter: {
    padding: '14px 18px',
    textAlign: 'center',
  },
  bellFooterLink: {
    background: 'transparent',
    border: 'none',
    color: '#8A6A2F',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '5px 12px 5px 5px',
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 30,
    cursor: 'pointer',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #B8924F 0%, #D4B170 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#050B14',
    fontWeight: 800,
    fontSize: 12,
    flexShrink: 0,
  },
  userChipName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#050B14',
  },
  userChipSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: 'clamp(16px, 3vw, 28px)',
  },
}
