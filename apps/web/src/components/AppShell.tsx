'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import posthog from 'posthog-js'
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  FolderKanban,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Watch,
} from 'lucide-react'

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
  { href: '/inicio',       label: 'Início',       Icon: LayoutDashboard },
  { href: '/compromissos', label: 'Compromissos',  Icon: CalendarDays    },
  { href: '/tarefas',      label: 'Tarefas',       Icon: ListChecks      },
  { href: '/projetos',     label: 'Projetos',      Icon: FolderKanban    },
  { href: '/notificacoes', label: 'Notificações',  Icon: Bell            },
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

function OrbitMark({ size = 40 }: { size?: number }) {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [bellOpen, setBellOpen] = useState(false)
  const [chipOpen, setChipOpen] = useState(false)
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

  const { data: user } = useSWR<User>('/auth/me', fetcher)

  useEffect(() => {
    if (!user) return
    posthog.identify(user.id, { email: user.email, name: user.name })
  }, [user])
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

  return (
    <div style={S.page}>
      {(bellOpen || chipOpen) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => { setBellOpen(false); setChipOpen(false) }}
        />
      )}

      {!isMobile && (
        <aside style={S.sidebar}>
          <div style={S.sidebarTop}>
            <div style={S.logoRow}>
              <OrbitMark size={32} />
              <span style={S.logoName}>Orbit</span>
            </div>
          </div>

          <nav style={S.nav}>
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  style={{ ...S.navItem, ...(active ? S.navItemActive : {}) }}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    style={{ color: active ? 'var(--brand-500, #2F6FE0)' : 'var(--fg-3, #6B7280)', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                </button>
              )
            })}
          </nav>

          <div style={S.sidebarBottom}>
            <button onClick={() => router.push('/config')} style={S.watchLink}>
              <Watch size={13} strokeWidth={1.75} />
              Ver no Apple Watch →
            </button>
            <span style={S.versionBar}>
              Orbit v{VERSION} · <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{COMMIT}</span>
            </span>
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
            <div>
              <div style={S.topbarTitle}>
                {NAV.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Orbit'}
              </div>
              <div style={S.topbarSub}>Painel Orbit — Rotina, tarefas e projetos em um só fluxo</div>
            </div>
          </div>

          <div style={S.topbarActions}>
            {/* Bell */}
            <div style={{ position: 'relative' }}>
              <button style={S.bellBtn} onClick={() => setBellOpen((v) => !v)} aria-label="Notificações">
                <Bell size={18} strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span style={S.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {bellOpen && (
                <div style={{
                  ...S.bellDrop,
                  width: isMobile ? 'min(360px, calc(100vw - 24px))' : 340,
                  right: isMobile ? -18 : 0,
                }}>
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
                      {unreadCount === 0 ? 'Nenhuma notificação não lida' : 'Carregando...'}
                    </div>
                  ) : (
                    recentNotifs.map((notification) => (
                      <button
                        key={notification.id}
                        style={S.notificationItem}
                        onClick={() => { setBellOpen(false); void openNotification(notification) }}
                      >
                        <div style={S.notificationTitle}>{notification.title}</div>
                        <div style={S.notificationBody}>{notification.body}</div>
                      </button>
                    ))
                  )}

                  <div style={S.bellFooter}>
                    <button
                      style={S.bellFooterLink}
                      onClick={() => { setBellOpen(false); router.push('/notificacoes') }}
                    >
                      Ver central completa
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User chip */}
            <div style={{ position: 'relative' }}>
              <button style={S.userChip} onClick={() => setChipOpen((v) => !v)}>
                <div style={S.avatarSmall}>{initial}</div>
                {!isMobile && <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--fg-3)' }} />}
              </button>
              {chipOpen && (
                <div style={S.chipDrop} onClick={() => setChipOpen(false)}>
                  <div style={S.chipUserInfo}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{user?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{user?.email}</div>
                  </div>
                  <hr style={S.chipDivider} />
                  <button style={S.chipDropItem} onClick={() => router.push('/config')}>
                    <Settings size={14} strokeWidth={1.75} />
                    Configurações
                  </button>
                  <button style={{ ...S.chipDropItem, color: '#EF4444' }} onClick={() => void logout()}>
                    <LogOut size={14} strokeWidth={1.75} />
                    Sair da sessão
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ ...S.content, ...(isMobile ? { paddingBottom: 80 } : {}) }}>{children}</main>
      </div>

      {/* Bottom navigation — mobile only */}
      {isMobile && (
        <nav style={S.bottomNav}>
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                style={{ ...S.bottomNavItem, ...(active ? S.bottomNavItemActive : {}) }}
              >
                <div style={{ position: 'relative' }}>
                  <Icon size={22} strokeWidth={1.75} />
                  {href === '/notificacoes' && unreadCount > 0 && (
                    <span style={S.bottomNavBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </div>
                <span style={{ ...S.bottomNavLabel, ...(active ? { color: 'var(--brand-500, #2F6FE0)' } : {}) }}>
                  {label}
                </span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg-subtle, #FAFBFC)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5,11,20,0.4)',
    zIndex: 40,
  },
  // Sidebar
  sidebar: {
    width: 248,
    flexShrink: 0,
    background: '#fff',
    borderRight: '1px solid var(--ink-200, #E5E7EB)',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  sidebarTop: {
    padding: '20px 16px 12px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logoName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--fg-1, #111827)',
    letterSpacing: '-0.02em',
    flex: 1,
  },
  closeButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--fg-3, #6B7280)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 4,
    borderRadius: 6,
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 12px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--fg-2, #4B5563)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 120ms, color 120ms',
  },
  navItemActive: {
    background: 'var(--brand-50, #F4F8FE)',
    color: 'var(--brand-700, #0E335A)',
    fontWeight: 600,
  },
  sidebarBottom: {
    padding: '12px 16px 16px',
    borderTop: '1px solid var(--ink-200, #E5E7EB)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  watchLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
    cursor: 'pointer',
    padding: '4px 0',
    transition: 'color 120ms',
  },
  versionBar: {
    fontSize: 11,
    color: 'var(--fg-4, #9CA3AF)',
  },
  // Main area
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    position: 'relative',
  },
  content: {
    flex: 1,
    padding: 'clamp(20px, 3vw, 32px)',
  },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: 64,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--ink-150, #EEF0F3)',
    display: 'flex',
    alignItems: 'stretch',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  bottomNavItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--fg-3, #6B7280)',
    padding: '4px 0',
    position: 'relative',
  },
  bottomNavItemActive: {
    color: 'var(--brand-500, #2F6FE0)',
  },
  bottomNavLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--fg-3, #6B7280)',
    letterSpacing: '0.01em',
  },
  bottomNavBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    background: '#EF4444',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #fff',
    padding: '0 2px',
  },
  // Toast
  toastStack: {
    position: 'fixed',
    top: 80,
    right: 20,
    zIndex: 120,
    display: 'grid',
    gap: 10,
    width: 340,
    pointerEvents: 'none',
  },
  toastStackMobile: {
    top: 70,
    right: 12,
    left: 12,
    width: 'auto',
  },
  toastCard: {
    position: 'relative',
    overflow: 'hidden',
    background: '#fff',
    border: '1px solid var(--brand-200, #C5D7F9)',
    borderRadius: 14,
    boxShadow: '0 8px 24px rgba(11,15,20,0.12)',
    padding: '16px 16px 14px',
    backdropFilter: 'blur(14px)',
    pointerEvents: 'auto',
  },
  toastGlow: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at top right, rgba(47,111,224,0.08), transparent 50%)',
    pointerEvents: 'none',
  },
  toastHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  toastEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--brand-600, #1E4FA0)',
  },
  toastTime: {
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    fontWeight: 500,
  },
  toastTitle: {
    fontSize: 15,
    lineHeight: 1.3,
    fontWeight: 700,
    color: 'var(--fg-1, #111827)',
    marginBottom: 4,
    letterSpacing: '-0.02em',
  },
  toastBody: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--fg-2, #4B5563)',
    marginBottom: 12,
  },
  toastActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  toastPrimary: {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--brand-500, #2F6FE0)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  toastSecondary: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--ink-200, #E5E7EB)',
    background: 'var(--bg-subtle, #FAFBFC)',
    color: 'var(--fg-2, #4B5563)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  toastGhost: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--ink-200, #E5E7EB)',
    background: '#fff',
    color: 'var(--fg-3, #6B7280)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  // Topbar/header
  topbar: {
    height: 64,
    backdropFilter: 'blur(20px)',
    background: 'rgba(255,255,255,0.72)',
    borderBottom: '1px solid var(--ink-150, #EEF0F3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '0 clamp(16px, 3vw, 28px)',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  menuButton: {
    border: '1px solid var(--ink-200, #E5E7EB)',
    background: '#fff',
    color: 'var(--fg-2, #4B5563)',
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  topbarTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
    letterSpacing: '-0.01em',
  },
  topbarSub: {
    marginTop: 1,
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
  },
  topbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  bellBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    background: '#fff',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--fg-2, #4B5563)',
  },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    background: '#EF4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #fff',
    padding: '0 3px',
  },
  bellDrop: {
    position: 'absolute',
    top: 46,
    background: '#fff',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 14,
    boxShadow: '0 8px 24px rgba(11,15,20,0.10)',
    overflow: 'hidden',
    zIndex: 101,
  },
  bellHead: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--ink-150, #EEF0F3)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  bellTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--fg-1, #111827)',
  },
  bellAction: {
    background: 'transparent',
    border: 'none',
    color: 'var(--brand-500, #2F6FE0)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  bellEmpty: {
    padding: '24px 16px',
    textAlign: 'center',
    color: 'var(--fg-3, #6B7280)',
    fontSize: 13,
  },
  notificationItem: {
    width: '100%',
    padding: '12px 16px',
    borderBottom: '1px solid var(--ink-100, #F3F4F6)',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
  },
  notificationBody: {
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
    marginTop: 2,
    lineHeight: 1.5,
  },
  bellFooter: {
    padding: '12px 16px',
    textAlign: 'center',
  },
  bellFooterLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--brand-500, #2F6FE0)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 10px 5px 5px',
    background: '#fff',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    cursor: 'pointer',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--brand-100, #E6EEFC)',
    color: 'var(--brand-700, #0E335A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 12,
    flexShrink: 0,
  },
  chipDrop: {
    position: 'absolute',
    top: 46,
    right: 0,
    minWidth: 200,
    background: '#fff',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(11,15,20,0.10)',
    padding: 6,
    zIndex: 101,
  },
  chipUserInfo: {
    padding: '8px 10px 6px',
  },
  chipDivider: {
    border: 'none',
    borderTop: '1px solid var(--ink-150, #EEF0F3)',
    margin: '4px 0',
  },
  chipDropItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '9px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    color: 'var(--fg-2, #4B5563)',
    cursor: 'pointer',
    transition: 'background 120ms',
  },
}
