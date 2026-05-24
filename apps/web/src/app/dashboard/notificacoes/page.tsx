'use client'

import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'

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
  push: '🔔 Push', email: '📧 E-mail', whatsapp: '💬 WhatsApp', in_app: '🔔 App',
}
const ENTITY_LABEL: Record<string, string> = {
  event: 'Compromisso', task: 'Tarefa', project: 'Projeto',
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

export default function NotificacoesPage() {
  const { data: notifications = [] } = useSWR<Notification[]>('/notifications', fetcher)
  const { data: countData } = useSWR('/notifications/unread-count', fetcher)

  const unread = notifications.filter((n) => !n.read)
  const read = notifications.filter((n) => n.read)

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
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Notificações</h2>
          <p style={S.sub}>{countData?.count ?? 0} não lida{(countData?.count ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        {unread.length > 0 && (
          <button style={S.btnGhost} onClick={markAllRead}>Marcar todas como lidas</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={S.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Nenhuma notificação</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Você receberá notificações sobre seus compromissos e tarefas aqui</div>
        </div>
      ) : (
        <>
          {unread.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={S.groupLabel}>Não lidas</div>
              <div style={S.list}>
                {unread.map((n) => (
                  <div key={n.id} style={{ ...S.card, ...S.cardUnread }}>
                    <div style={S.dot} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.cardTitle}>{n.title}</div>
                      <div style={S.cardBody}>{n.body}</div>
                      <div style={S.cardMeta}>
                        <span>{CHANNEL_LABEL[n.channel] ?? n.channel}</span>
                        {n.entityType && <span style={S.entityTag}>{ENTITY_LABEL[n.entityType] ?? n.entityType}</span>}
                        <span style={{ color: '#94a3b8' }}>{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                    <button style={S.readBtn} onClick={() => markRead(n.id)}>✓ Lida</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {read.length > 0 && (
            <div>
              <div style={S.groupLabel}>Lidas</div>
              <div style={S.list}>
                {read.map((n) => (
                  <div key={n.id} style={{ ...S.card, opacity: 0.65 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.cardTitle}>{n.title}</div>
                      <div style={S.cardBody}>{n.body}</div>
                      <div style={S.cardMeta}>
                        <span>{CHANNEL_LABEL[n.channel] ?? n.channel}</span>
                        {n.entityType && <span style={S.entityTag}>{ENTITY_LABEL[n.entityType] ?? n.entityType}</span>}
                        <span style={{ color: '#94a3b8' }}>{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 800 },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  btnGhost: { padding: '8px 16px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  groupLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  card: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 },
  cardUnread: { borderLeftColor: '#6366f1', borderLeftWidth: 4 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#6366f1', marginTop: 5, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: 600, marginBottom: 3 },
  cardBody: { fontSize: 13, color: '#374151', marginBottom: 8 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' },
  entityTag: { background: '#eef2ff', color: '#6366f1', padding: '1px 6px', borderRadius: 6, fontWeight: 600, fontSize: 11 },
  readBtn: { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '5px 10px', color: '#16a34a', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 },
}
