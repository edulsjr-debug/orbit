'use client'

import useSWR from 'swr'
import { api } from '@/lib/api'

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

export default function DashboardPage() {
  const { data: events } = useSWR('/events', fetcher)
  const { data: tasks } = useSWR('/tasks', fetcher)
  const { data: projects } = useSWR('/projects', fetcher)
  const { data: notifCount } = useSWR('/notifications/unread-count', fetcher)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayEvents = (events ?? []).filter((e: any) => {
    const d = new Date(e.startAt)
    return d >= today && d < tomorrow
  })

  const overdue = (tasks ?? []).filter((t: any) => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < today)
  const urgent = (tasks ?? []).filter((t: any) => t.status !== 'done' && t.priority === 'high')

  return (
    <div>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Bom dia! ☀️</h2>
          <p style={S.sub}>
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {todayEvents.length > 0 && ` · ${todayEvents.length} compromisso${todayEvents.length > 1 ? 's' : ''} hoje`}
          </p>
        </div>
      </div>

      <div style={S.stats}>
        <StatCard icon="📅" value={todayEvents.length} label="Compromissos hoje" color="#eef2ff" />
        <StatCard icon="✔️" value={(tasks ?? []).filter((t: any) => t.status !== 'done').length} label="Tarefas pendentes" color="#ecfdf5" />
        <StatCard icon="📁" value={(projects ?? []).length} label="Projetos ativos" color="#eff6ff" />
        <StatCard icon="🔔" value={notifCount?.count ?? 0} label="Notif. não lidas" color="#fff7ed" />
      </div>

      <div style={S.grid}>
        <Section title="📅 Compromissos hoje" empty={todayEvents.length === 0} emptyMsg="Nenhum compromisso hoje">
          {todayEvents.map((e: any) => (
            <ListItem
              key={e.id}
              title={e.title}
              sub={new Date(e.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              dot="#6366f1"
              right={e.hasHistory ? <EditedBadge /> : null}
            />
          ))}
        </Section>

        <Section title="⚠️ Tarefas urgentes" empty={urgent.length === 0} emptyMsg="Sem tarefas urgentes">
          {overdue.map((t: any) => (
            <ListItem key={t.id} title={t.title} sub="Atrasada" dot="#ef4444" right={<span style={S.badgeRed}>Atrasada</span>} />
          ))}
          {urgent.filter((t: any) => !overdue.find((o: any) => o.id === t.id)).map((t: any) => (
            <ListItem key={t.id} title={t.title} sub={t.project?.name ?? 'Sem projeto'} dot="#f59e0b" right={<span style={S.badgeYellow}>Alta</span>} />
          ))}
        </Section>
      </div>

      {(projects ?? []).length > 0 && (
        <div style={S.card}>
          <div style={S.cardHead}><span style={{ fontWeight: 700 }}>📊 Projetos</span></div>
          <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 20 }}>
            {(projects ?? []).map((p: any) => (
              <div key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{p.emoji} {p.name}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{p.taskCount > 0 ? Math.round((p.taskDone / p.taskCount) * 100) : 0}%</span>
                </div>
                <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: p.color, borderRadius: 3, width: `${p.taskCount > 0 ? (p.taskDone / p.taskCount) * 100 : 0}%` }} />
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{p.taskDone}/{p.taskCount} tarefas</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    </div>
  )
}

function Section({ title, children, empty, emptyMsg }: any) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0' }}>
      <div style={S.cardHead}><span style={{ fontWeight: 700 }}>{title}</span></div>
      <div style={{ padding: '8px 12px' }}>
        {empty ? <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{emptyMsg}</div> : children}
      </div>
    </div>
  )
}

function ListItem({ title, sub, dot, right }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sub}</div>
      </div>
      {right}
    </div>
  )
}

function EditedBadge() {
  return <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: 10 }}>✏ editado</span>
}

const S: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 20, fontWeight: 800 },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 },
  card: { background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0' },
  cardHead: { padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontSize: 14 },
  badgeRed: { padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#dc2626' },
  badgeYellow: { padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#fffbeb', color: '#d97706' },
}
