'use client'

import useSWR from 'swr'
import { api } from '@/lib/api'

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

export default function DashboardPage() {
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const from = today.toISOString()
  const to = endOfDay(now).toISOString()

  const { data: events, isLoading: loadingEvents } = useSWR(
    `/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    fetcher
  )
  const { data: tasks, isLoading: loadingTasks } = useSWR('/tasks?status=pending', fetcher)
  const { data: projects, isLoading: loadingProjects } = useSWR('/projects', fetcher)
  const { data: notifications, isLoading: loadingNotifications } = useSWR('/notifications?read=false', fetcher)

  const todayEvents = (events ?? []).filter((e: any) => {
    const date = new Date(e.startAt)
    return date >= today && date < tomorrow
  })

  const overdueTasks = (tasks ?? []).filter((t: any) => t.dueAt && new Date(t.dueAt) < now)
  const dueTodayTasks = (tasks ?? []).filter((t: any) => {
    if (!t.dueAt) return false
    const dueAt = new Date(t.dueAt)
    return dueAt >= today && dueAt < tomorrow
  })

  const hasLoadingStats = loadingEvents || loadingTasks || loadingProjects || loadingNotifications
  const hasLoadingLists = loadingEvents || loadingTasks
  const hasLoadingProjects = loadingProjects

  return (
    <div>
      <style>{`
        @keyframes orbitSkeletonFade {
          0% { opacity: .45; }
          50% { opacity: .9; }
          100% { opacity: .45; }
        }
      `}</style>

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
        <StatCard icon="📅" value={todayEvents.length} label="Compromissos hoje" color="#eef2ff" loading={hasLoadingStats} />
        <StatCard icon="✔️" value={(tasks ?? []).length} label="Tarefas pendentes" color="#ecfdf5" loading={hasLoadingStats} />
        <StatCard icon="📁" value={(projects ?? []).length} label="Projetos ativos" color="#eff6ff" loading={hasLoadingStats} />
        <StatCard icon="🔔" value={(notifications ?? []).length} label="Notif. não lidas" color="#fff7ed" loading={hasLoadingStats} />
      </div>

      <div style={S.grid}>
        <Section title="📅 Compromissos hoje" empty={todayEvents.length === 0} emptyMsg="Nenhum compromisso hoje" loading={hasLoadingLists}>
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

        <Section title="⚠️ Tarefas urgentes" empty={overdueTasks.length === 0 && dueTodayTasks.length === 0} emptyMsg="Sem tarefas urgentes" loading={hasLoadingLists}>
          {overdueTasks.map((t: any) => (
            <ListItem key={t.id} title={t.title} sub="Atrasada" dot="#ef4444" right={<span style={S.badgeRed}>Atrasada</span>} />
          ))}
          {dueTodayTasks
            .filter((t: any) => !overdueTasks.find((o: any) => o.id === t.id))
            .map((t: any) => (
              <ListItem
                key={t.id}
                title={t.title}
                sub="Vence hoje"
                dot="#f59e0b"
                right={<span style={S.badgeYellow}>Hoje</span>}
              />
            ))}
        </Section>
      </div>

      {(hasLoadingProjects || (projects ?? []).length > 0) && (
        <div style={S.card}>
          <div style={S.cardHead}><span style={{ fontWeight: 700 }}>📊 Projetos</span></div>
          <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 20 }}>
            {hasLoadingProjects
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index}>
                    <SkeletonLine width="70%" height={14} />
                    <div style={{ height: 5 }} />
                    <SkeletonLine width="100%" height={5} />
                    <div style={{ height: 6 }} />
                    <SkeletonLine width="40%" height={11} />
                  </div>
                ))
              : (projects ?? []).map((p: any) => {
                  const totalTasks = (p.tasks ?? []).length
                  const doneTasks = (p.tasks ?? []).filter((t: any) => t.status === 'done').length
                  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0

                  return (
                    <div key={p.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{p.emoji} {p.name}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{Math.round(progress)}%</span>
                      </div>
                      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: p.color, borderRadius: 3, width: `${progress}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{doneTasks}/{totalTasks} tarefas</div>
                    </div>
                  )
                })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, value, label, color, loading }: { icon: string; value: number; label: string; color: string; loading?: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
      {loading ? <SkeletonLine width="48px" height={30} /> : <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</div>}
      {loading ? <SkeletonLine width="90px" height={12} /> : <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>}
    </div>
  )
}

function Section({ title, children, empty, emptyMsg, loading }: any) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0' }}>
      <div style={S.cardHead}><span style={{ fontWeight: 700 }}>{title}</span></div>
      <div style={{ padding: '8px 12px' }}>
        {loading ? (
          <div>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </div>
        ) : empty ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{emptyMsg}</div>
        ) : children}
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

function SkeletonItem() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8 }}>
      <SkeletonLine width={8} height={8} rounded="50%" />
      <div style={{ flex: 1 }}>
        <SkeletonLine width="58%" height={13} />
        <div style={{ height: 6 }} />
        <SkeletonLine width="36%" height={11} />
      </div>
      <SkeletonLine width="54px" height={20} rounded="20px" />
    </div>
  )
}

function SkeletonLine({ width, height, rounded = '8px' }: { width: string | number; height: string | number; rounded?: string }) {
  return <div style={{ width, height, borderRadius: rounded, background: '#f1f5f9', animation: 'orbitSkeletonFade 1.2s ease-in-out infinite' }} />
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
