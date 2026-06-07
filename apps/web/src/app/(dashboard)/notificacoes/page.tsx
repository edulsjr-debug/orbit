'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'
import { Bell } from 'lucide-react'

type Notification = {
  id: string
  title: string
  body: string
  channel: string
  read: boolean
  entityType?: string
  createdAt: string
}

const CHANNEL_LABEL: Record<string, string> = {
  push: 'Push',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  in_app: 'App',
}

const ENTITY_LABEL: Record<string, string> = {
  event: 'Compromisso',
  task: 'Tarefa',
  project: 'Projeto',
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

const PAGE_SIZE = 5

export default function NotificacoesPage() {
  const isMobile = useIsMobile()
  const { data: notifications = [] } = useSWR<Notification[]>('/notifications', fetcher)
  const { data: countData } = useSWR('/notifications/unread-count', fetcher)

  const [readLimit, setReadLimit] = useState(PAGE_SIZE)

  const unread = notifications.filter((n) => !n.read)
  const read = notifications.filter((n) => n.read)
  const readVisible = read.slice(0, readLimit)
  const hasMoreRead = read.length > readLimit

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`, {})
    mutate('/notifications')
    mutate('/notifications/unread-count')
  }

  async function markAllRead() {
    await api.post('/notifications/read-all', {})
    mutate('/notifications')
    mutate('/notifications/unread-count')
  }

  return (
    <div>
      <section style={S.hero}>
        <div>
          <div style={S.eyebrow}>Central de alertas</div>
          <h1 style={S.title}>Notificações com contexto.</h1>
          <p style={S.sub}>
            {countData?.count ?? 0} não lida{(countData?.count ?? 0) !== 1 ? 's' : ''} e{' '}
            {notifications.length} registro{notifications.length !== 1 ? 's' : ''} no total.
          </p>
        </div>
        {unread.length > 0 && (
          <button style={S.btnGhost} onClick={markAllRead}>
            Marcar todas como lidas
          </button>
        )}
      </section>

      {notifications.length === 0 ? (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}><Bell size={40} strokeWidth={1.5} color="var(--brand-400, #5B8FEA)" /></div>
          <div style={S.emptyTitle}>Nenhuma notificação</div>
          <div style={S.emptyText}>
            Os alertas de compromissos, tarefas e projetos aparecerão aqui.
          </div>
        </div>
      ) : (
        <div style={{ ...S.mainGrid, ...(isMobile ? { gridTemplateColumns: '1fr' } : null) }}>
          <section style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <div style={S.panelTitle}>Não lidas</div>
                <div style={S.panelSub}>Itens que ainda pedem sua atenção</div>
              </div>
            </div>

            <div style={S.list}>
              {unread.length === 0 ? (
                <div style={S.emptyInline}>Tudo certo por aqui. Nenhum alerta pendente.</div>
              ) : (
                unread.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      ...S.cardUnread,
                      ...(isMobile ? { flexDirection: 'column' as const } : null),
                    }}
                  >
                    <div style={S.cardSignal} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.cardTitle}>{n.title}</div>
                      <div style={S.cardBody}>{n.body}</div>
                      <div style={S.cardMeta}>
                        <span style={S.metaPill}>{CHANNEL_LABEL[n.channel] ?? n.channel}</span>
                        {n.entityType && (
                          <span style={S.entityTag}>
                            {ENTITY_LABEL[n.entityType] ?? n.entityType}
                          </span>
                        )}
                        <span>{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                    <button style={{ ...S.readBtn, ...(isMobile ? { width: '100%' } : null) }} onClick={() => markRead(n.id)}>
                      Marcar lida
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <div style={S.panelTitle}>Histórico lido</div>
                <div style={S.panelSub}>Notificações já processadas</div>
              </div>
            </div>

            <div style={S.list}>
              {read.length === 0 ? (
                <div style={S.emptyInline}>Ainda não há notificações concluídas.</div>
              ) : (
                <>
                  {readVisible.map((n) => (
                    <div key={n.id} style={S.cardRead}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.cardTitle}>{n.title}</div>
                        <div style={S.cardBody}>{n.body}</div>
                        <div style={S.cardMeta}>
                          <span style={S.metaPill}>{CHANNEL_LABEL[n.channel] ?? n.channel}</span>
                          {n.entityType && (
                            <span style={S.entityTagMuted}>
                              {ENTITY_LABEL[n.entityType] ?? n.entityType}
                            </span>
                          )}
                          <span>{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasMoreRead && (
                    <button
                      style={S.loadMoreBtn}
                      onClick={() => setReadLimit((l) => l + PAGE_SIZE)}
                    >
                      Ver mais {read.length - readLimit} notificações
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
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
  btnGhost: {
    padding: '10px 16px',
    background: 'var(--bg-subtle, #FAFBFC)',
    color: 'var(--fg-2, #374151)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '70px 24px',
    background: 'var(--bg, #FFFFFF)',
    borderRadius: 14,
    border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'var(--brand-50, #F4F8FE)',
    margin: '0 auto 16px',
  },
  emptyTitle: {
    fontWeight: 700,
    fontSize: 18,
    color: 'var(--fg-1, #111827)',
    marginBottom: 8,
  },
  emptyText: {
    color: 'var(--fg-3, #6B7280)',
    fontSize: 14,
    lineHeight: 1.7,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  panel: {
    background: 'var(--bg, #FFFFFF)',
    borderRadius: 14,
    border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
    overflow: 'hidden',
  },
  panelHead: {
    padding: '18px 20px',
    borderBottom: '1px solid var(--ink-200, #E5E7EB)',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--fg-1, #111827)',
  },
  panelSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
  },
  list: {
    display: 'grid',
    gap: 10,
    padding: 14,
  },
  emptyInline: {
    padding: '16px 8px',
    color: 'var(--fg-3, #6B7280)',
    fontSize: 13,
    lineHeight: 1.7,
  },
  loadMoreBtn: {
    display: 'block',
    width: '100%',
    padding: '12px',
    background: 'transparent',
    border: '1px dashed var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--fg-3, #6B7280)',
    cursor: 'pointer',
    margin: '8px 0 4px',
  },
  cardUnread: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: 'var(--brand-50, #F4F8FE)',
    border: '1px solid var(--brand-200, #BFDBFE)',
    borderRadius: 10,
    padding: '14px 16px',
  },
  cardRead: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: 'var(--bg-subtle, #FAFBFC)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    padding: '14px 16px',
    opacity: 0.72,
  },
  cardSignal: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--brand-500, #2F6FE0)',
    marginTop: 7,
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 13,
    color: 'var(--fg-2, #374151)',
    marginBottom: 10,
    lineHeight: 1.6,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    flexWrap: 'wrap',
    fontFamily: 'var(--font-mono)',
  },
  metaPill: {
    background: 'var(--ink-100, #F3F4F6)',
    color: 'var(--fg-2, #374151)',
    padding: '3px 8px',
    borderRadius: 6,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  entityTag: {
    background: 'var(--brand-50, #F4F8FE)',
    color: 'var(--brand-700, #0E335A)',
    padding: '3px 8px',
    borderRadius: 6,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  entityTagMuted: {
    background: 'var(--ink-100, #F3F4F6)',
    color: 'var(--fg-3, #6B7280)',
    padding: '3px 8px',
    borderRadius: 6,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  readBtn: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 8,
    padding: '7px 12px',
    color: '#16A34A',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
}
