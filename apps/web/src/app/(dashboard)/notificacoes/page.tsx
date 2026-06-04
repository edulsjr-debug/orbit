'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'

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
          <div style={S.emptyEmoji}>🔔</div>
          <div style={S.emptyTitle}>Nenhuma notificação</div>
          <div style={S.emptyText}>
            Os alertas de compromissos, tarefas e projetos aparecerão aqui.
          </div>
        </div>
      ) : (
        <div style={{ ...S.mainGrid, ...(isMobile ? S.mainGridMobile : null) }}>
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
                      ...(isMobile ? S.cardUnreadMobile : null),
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
                    <button style={{ ...S.readBtn, ...(isMobile ? S.readBtnMobile : null) }} onClick={() => markRead(n.id)}>
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
    color: '#8A6A2F',
    marginBottom: 10,
  },
  title: {
    fontSize: 'clamp(28px, 4vw, 38px)',
    fontWeight: 700,
    letterSpacing: '-0.05em',
    color: '#050B14',
  },
  sub: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
    lineHeight: 1.7,
  },
  btnGhost: {
    padding: '12px 18px',
    background: '#F4F6F8',
    color: '#475569',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 14,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '70px 24px',
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1px solid rgba(5,11,20,0.08)',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: 700,
    fontSize: 18,
    color: '#050B14',
    marginBottom: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 1.7,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  mainGridMobile: {
    gridTemplateColumns: '1fr',
  },
  panel: {
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1px solid rgba(5,11,20,0.08)',
    overflow: 'hidden',
  },
  panelHead: {
    padding: '18px 20px',
    borderBottom: '1px solid #EDF1F4',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#050B14',
  },
  panelSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
  },
  list: {
    display: 'grid',
    gap: 12,
    padding: 14,
  },
  emptyInline: {
    padding: '16px 8px',
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 1.7,
  },
  loadMoreBtn: {
    display: 'block',
    width: '100%',
    padding: '12px',
    background: 'transparent',
    border: '1px dashed rgba(5,11,20,0.12)',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 600,
    color: '#64748B',
    cursor: 'pointer',
    margin: '8px 0 4px',
  },
  cardUnread: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#FBFCFD',
    border: '1px solid rgba(184,146,79,0.16)',
    borderRadius: 18,
    padding: '16px 16px',
  },
  cardUnreadMobile: {
    flexDirection: 'column',
  },
  cardRead: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#FBFCFD',
    border: '1px solid #EDF1F4',
    borderRadius: 18,
    padding: '16px 16px',
    opacity: 0.72,
  },
  cardSignal: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#B8924F',
    marginTop: 7,
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#050B14',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 10,
    lineHeight: 1.6,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: '#64748B',
    flexWrap: 'wrap',
  },
  metaPill: {
    background: '#F4F6F8',
    color: '#475569',
    padding: '4px 8px',
    borderRadius: 999,
    fontWeight: 700,
  },
  entityTag: {
    background: '#FBF4E4',
    color: '#8A6A2F',
    padding: '4px 8px',
    borderRadius: 999,
    fontWeight: 700,
  },
  entityTagMuted: {
    background: '#F1F5F9',
    color: '#64748B',
    padding: '4px 8px',
    borderRadius: 999,
    fontWeight: 700,
  },
  readBtn: {
    background: '#F0FDF4',
    border: '1px solid rgba(15,118,110,0.2)',
    borderRadius: 999,
    padding: '9px 12px',
    color: '#0F766E',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  readBtnMobile: {
    width: '100%',
  },
}
