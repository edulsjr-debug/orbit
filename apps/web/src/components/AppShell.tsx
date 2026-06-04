'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'

type User = { id: string; name: string; email: string }
type Notification = {
  id: string
  title: string
  body: string
  channel: string
  read: boolean
  entityType?: string
  entityId?: string
  createdAt: string
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

const NAV = [
  { href: '/inicio', short: 'IN', label: 'Inicio' },
  { href: '/compromissos', short: 'CO', label: 'Compromissos' },
  { href: '/tarefas', short: 'TA', label: 'Tarefas' },
  { href: '/projetos', short: 'PR', label: 'Projetos' },
  { href: '/notificacoes', short: 'NO', label: 'Notificações' },
]

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
const COMMIT = (process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev').slice(0, 7)
const SNOOZE_KEY = 'orbit-toast-snooze'

const ENTITY_LABEL: Record<string, string> = {
  event: 'Compromisso',
  task: 'Tarefa',
  project: 'Projeto',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

function routeForNotification(notification: Pick<Notification, 'entityType'>) {
  switch (notification.entityType) {
    case 'event':   return '/compromissos'
    case 'task':    return '/tarefas'
    case 'project': return '/projetos'
    default:        return '/notificacoes'
  }
}

function readSnoozed() {
  if (typeof window === 'undefined') return {} as Record<string, number>
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function OrbitMark({ size = 48 }: { size?: number }) {
  return (
    <div
      style={{ ...S.orbitMark, width: size, height: size, borderRadius: Math.round(size * 0.28) }}
      aria-hidden="true"
    >
      <span
        style={{
          ...S.orbitRing,
          inset: Math.round(size * 0.2),
          borderWidth: Math.max(2, Math.round(size * 0.035)),
        }}
      />
      <span style={{ ...S.orbitCore, inset: Math.round(size * 0.375) }} />
      <span
        style={{
          ...S.orbitDot,
          top: Math.round(size * 0.22),
          right: Math.round(size * 0.22),
          width: Math.max(5, Math.round(size * 0.1)),
          height: Math.max(5, Math.round(size * 0.1)),
        }}
      />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [bellOpen, setBellOpen] = useState(false)
  const [chipOpen, setChipOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [snoozed, setSnoozed] = useState<Record<string, number>>({})
  const [sessionStartedAt] = useState(() => Date.now())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 980)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setSnoozed(readSnoozed())
  }, [])

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [pathname, isMobile])

  const { data: user } = useSWR<User>('/auth/me', fetcher)
  const { data: countData } = useSWR('/notifications/unread-count', fetcher, {
    refreshInterval: 30000,
  })
  const { data: unreadNotifications = [] } = useSWR<Notification[]>(
    '/notifications?read=false',
    fetcher,
    {
      refreshInterval: 15000,
    }
  )
  const { data: notifications = [] } = useSWR<Notification[]>(
    bellOpen ? '/notifications' : null,
    fetcher
  )

  const unreadCount: number = countData?.count ?? 0
  const firstName = user?.name?.split(' ')[0] ?? '...'
  const initial = user?.name?.[0]?.toUpperCase() ?? '?'
  const recentNotifs = notifications.filter((n) => !n.read).slice(0, 3)
  const activeToasts = unreadNotifications
    .filter((notification) => {
      if (notification.channel !== 'in_app') return false
      if (new Date(notification.createdAt).getTime() < sessionStartedAt) return false
      const until = snoozed[notification.id]
      return !until || until <= Date.now()
    })
    .slice(0, isMobile ? 1 : 2)

  async function refreshNotifications() {
    await Promise.all([
      mutate('/notifications/unread-count'),
      mutate('/notifications'),
      mutate('/notifications?read=false'),
    ])
  }

  async function logout() {
    await api.post('/auth/logout', {})
    router.push('/login')
    router.refresh()
  }

  async function markAllRead() {
    await api.post('/notifications/read-all', {})
    await refreshNotifications()
  }

  async function markNotificationRead(id: string) {
    await api.patch(`/notifications/${id}/read`, {})
    await refreshNotifications()
  }

  function snoozeNotification(id: string, minutes: number) {
    const next = { ...readSnoozed(), [id]: Date.now() + minutes * 60_000 }
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(next))
    setSnoozed(next)
  }

  async function openNotification(notification: Notification) {
    await markNotificationRead(notification.id)
    router.push(routeForNotification(notification))
  }

  const showSidebar = isMobile ? sidebarOpen : true

  return (
    <div style={S.page}>
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={S.overlay} />}
      {(bellOpen || chipOpen) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => { setBellOpen(false); setChipOpen(false) }}
        />
      )}

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
              <OrbitMark size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.logoName}>Orbit</div>
                <div style={S.logoSub}>Seu espaço de organização</div>
              </div>
              {isMobile && (
                <button onClick={() => setSidebarOpen(false)} style={S.closeButton}>
                  x
                </button>
              )}
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
            <div style={S.versionBar}>
              Orbit v{VERSION} · <span style={{ fontFamily: 'monospace' }}>{COMMIT}</span>
            </div>
            <div style={S.brandFootnote}>Orbit, um produto Prumo</div>
          </div>
        </aside>
      )}

      <div style={S.main}>
        {activeToasts.length > 0 && (
          <div style={{ ...S.toastStack, ...(isMobile ? S.toastStackMobile : null) }}>
            {activeToasts.map((notification) => (
              <div key={notification.id} style={S.toastCard}>
                <div style={S.toastGlow} />
                <div style={S.toastHead}>
                  <span style={S.toastEyebrow}>
                    {ENTITY_LABEL[notification.entityType ?? ''] ?? 'Alerta'}
                  </span>
                  <span style={S.toastTime}>{timeAgo(notification.createdAt)}</span>
                </div>
                <div style={S.toastTitle}>{notification.title}</div>
                <div style={S.toastBody}>{notification.body}</div>
                <div style={S.toastActions}>
                  <button
                    style={S.toastPrimary}
                    onClick={() => {
                      void openNotification(notification)
                    }}
                  >
                    Abrir
                  </button>
                  <button
                    style={S.toastSecondary}
                    onClick={() => snoozeNotification(notification.id, 5)}
                  >
                    Adiar 5 min
                  </button>
                  <button
                    style={S.toastGhost}
                    onClick={() => {
                      void markNotificationRead(notification.id)
                    }}
                  >
                    Marcar lida
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <header style={S.topbar}>
          <div style={S.topbarLeft}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={S.menuButton}>
                ≡
              </button>
            )}
            <div>
              <div style={S.topbarTitle}>Painel Orbit</div>
              <div style={S.topbarSub}>Rotina, tarefas e projetos em um so fluxo</div>
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
                      <button style={S.bellAction} onClick={() => void markAllRead()}>
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  {recentNotifs.length === 0 ? (
                    <div style={S.bellEmpty}>
                      {unreadCount === 0 ? 'Nenhuma notificacao nao lida' : 'Carregando...'}
                    </div>
                  ) : (
                    recentNotifs.map((notification) => (
                      <button
                        key={notification.id}
                        style={S.notificationItem}
                        onClick={() => {
                          setBellOpen(false)
                          void openNotification(notification)
                        }}
                      >
                        <div style={S.notificationTitle}>{notification.title}</div>
                        <div style={S.notificationBody}>{notification.body}</div>
                      </button>
                    ))
                  )}

                  <div style={S.bellFooter}>
                    <button
                      style={S.bellFooterLink}
                      onClick={() => {
                        setBellOpen(false)
                        router.push('/notificacoes')
                      }}
                    >
                      Ver central completa
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button style={S.userChip} onClick={() => setChipOpen((v) => !v)}>
                <div style={S.avatarSmall}>{initial}</div>
                {!isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={S.userChipName}>{firstName}</span>
                    <span style={S.userChipSub}>Perfil</span>
                  </div>
                )}
              </button>
              {chipOpen && (
                <div style={S.chipDrop} onClick={() => setChipOpen(false)}>
                  <button style={S.chipDropItem} onClick={() => router.push('/config')}>
                    Configurações
                  </button>
                  <button style={{ ...S.chipDropItem, color: '#991B1B' }} onClick={() => void logout()}>
                    Sair da sessão
                  </button>
                </div>
              )}
            </div>
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
  orbitDot: {
    position: 'absolute',
    borderRadius: '50%',
    background: '#FFFFFF',
  },
  logoName: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.04em',
  },
  logoSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(245,242,236,0.52)',
  },
  closeButton: {
    border: 'none',
    background: 'transparent',
    color: 'rgba(245,242,236,0.7)',
    fontSize: 24,
    cursor: 'pointer',
    lineHeight: 1,
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
    background: 'rgba(90,90,230,0.16)',
    border: '1px solid rgba(111,112,242,0.3)',
    color: '#FFFFFF',
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
  brandFootnote: {
    fontSize: 10,
    color: 'rgba(245,242,236,0.38)',
    textAlign: 'center',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    position: 'relative',
  },
  toastStack: {
    position: 'fixed',
    top: 92,
    right: 26,
    zIndex: 120,
    display: 'grid',
    gap: 12,
    width: 360,
    pointerEvents: 'none',
  },
  toastStackMobile: {
    top: 84,
    right: 12,
    left: 12,
    width: 'auto',
  },
  toastCard: {
    position: 'relative',
    overflow: 'hidden',
    background: 'rgba(255,251,243,0.98)',
    border: '1px solid rgba(184,146,79,0.26)',
    borderRadius: 22,
    boxShadow: '0 22px 40px rgba(5,11,20,0.16)',
    padding: '16px 16px 14px',
    backdropFilter: 'blur(14px)',
    pointerEvents: 'auto',
  },
  toastGlow: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at top right, rgba(212,177,112,0.25), transparent 42%)',
    pointerEvents: 'none',
  },
  toastHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  toastEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#8A6A2F',
  },
  toastTime: {
    fontSize: 11,
    color: '#667085',
    fontWeight: 600,
  },
  toastTitle: {
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 700,
    color: '#101828',
    marginBottom: 6,
    letterSpacing: '-0.03em',
  },
  toastBody: {
    fontSize: 13,
    lineHeight: 1.6,
    color: '#475467',
    marginBottom: 14,
  },
  toastActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  toastPrimary: {
    padding: '10px 14px',
    borderRadius: 12,
    border: 'none',
    background: '#111827',
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  toastSecondary: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(184,146,79,0.28)',
    background: '#F7EEDC',
    color: '#7C5B20',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  toastGhost: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(5,11,20,0.08)',
    background: '#FFFFFF',
    color: '#475467',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
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
    zIndex: 101,
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
    color: '#5A5AE6',
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
    width: '100%',
    padding: '14px 18px',
    borderBottom: '1px solid #F3F5F7',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
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
    color: '#5A5AE6',
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
  chipDrop: {
    position: 'absolute',
    top: 50,
    right: 0,
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 14,
    boxShadow: '0 12px 32px rgba(5,11,20,0.12)',
    overflow: 'hidden',
    zIndex: 110,
    minWidth: 160,
  },
  chipDropItem: {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #F3F5F7',
    fontSize: 13,
    fontWeight: 600,
    color: '#050B14',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: 'clamp(16px, 3vw, 28px)',
  },
}
