'use client'

import useSWR from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'

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

function formatLongDate(date: Date) {
  const formatted = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default function DashboardPage() {
  const isMobile = useIsMobile()
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
  const { data: notifications, isLoading: loadingNotifications } = useSWR(
    '/notifications?read=false',
    fetcher
  )

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

  const pendingTasks = (tasks ?? []).length
  const activeProjects = (projects ?? []).length
  const unreadNotifications = (notifications ?? []).length

  const hasLoadingStats =
    loadingEvents || loadingTasks || loadingProjects || loadingNotifications
  const hasLoadingLists = loadingEvents || loadingTasks
  const hasLoadingProjects = loadingProjects

  return (
    <div>
      <style>{`
        @keyframes orbitSkeletonFade {
          0% { opacity: .42; }
          50% { opacity: .92; }
          100% { opacity: .42; }
        }
      `}</style>

      <section
        style={{
          ...S.hero,
          ...(isMobile ? S.heroMobile : null),
        }}
      >
        <div style={S.heroPanel}>
          <div>
            <div style={S.eyebrow}>Visão diária</div>
            <h1 style={S.heroTitle}>Seu trabalho em prumo.</h1>
            <p style={S.heroText}>
              {formatLongDate(today)} · {todayEvents.length} compromisso
              {todayEvents.length === 1 ? '' : 's'} hoje, {pendingTasks} tarefa
              {pendingTasks === 1 ? '' : 's'} pendente
              {pendingTasks === 1 ? '' : 's'} e {activeProjects} projeto
              {activeProjects === 1 ? '' : 's'} em andamento.
            </p>
          </div>

          <div style={S.heroMetrics}>
            <MetricMini label="Urgência" value={overdueTasks.length} tone="danger" />
            <MetricMini label="Hoje" value={dueTodayTasks.length} tone="warning" />
            <MetricMini label="Alertas" value={unreadNotifications} tone="neutral" />
          </div>
        </div>

        <div style={S.heroRail}>
          <div style={S.heroNote}>
            <span style={S.heroNoteLabel}>Próxima janela</span>
            <strong style={S.heroNoteValue}>
              {todayEvents[0]
                ? new Date(todayEvents[0].startAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Sem agenda'}
            </strong>
          </div>

          <div style={S.heroTimeline}>
            {(todayEvents.slice(0, 3) ?? []).map((event: any) => (
              <div key={event.id} style={S.heroTimelineItem}>
                <span style={S.heroTimelineTime}>
                  {new Date(event.startAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span style={S.heroTimelineText}>{event.title}</span>
              </div>
            ))}

            {todayEvents.length === 0 && (
              <div style={S.heroTimelineEmpty}>Nenhum compromisso previsto para hoje.</div>
            )}
          </div>
        </div>
      </section>

      <section style={S.statsGrid}>
        <StatCard
          accent="#B8924F"
          title="Compromissos hoje"
          value={todayEvents.length}
          detail="Agenda do dia"
          loading={hasLoadingStats}
        />
        <StatCard
          accent="#0F766E"
          title="Tarefas pendentes"
          value={pendingTasks}
          detail="Fila operacional"
          loading={hasLoadingStats}
        />
        <StatCard
          accent="#1D4ED8"
          title="Projetos ativos"
          value={activeProjects}
          detail="Frentes abertas"
          loading={hasLoadingStats}
        />
        <StatCard
          accent="#991B1B"
          title="Não lidas"
          value={unreadNotifications}
          detail="Central de alertas"
          loading={hasLoadingStats}
        />
      </section>

      <section style={{ ...S.mainGrid, ...(isMobile ? S.mainGridMobile : null) }}>
        <Section
          title="Compromissos do dia"
          subtitle="Os próximos pontos da sua rotina"
          empty={todayEvents.length === 0}
          emptyMsg="Nenhum compromisso hoje"
          loading={hasLoadingLists}
        >
          {todayEvents.map((e: any) => (
            <ListItem
              key={e.id}
              title={e.title}
              sub={new Date(e.startAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              tone="#B8924F"
              right={e.hasHistory ? <EditedBadge /> : null}
            />
          ))}
        </Section>

        <Section
          title="Tarefas urgentes"
          subtitle="Itens que pedem ação agora"
          empty={overdueTasks.length === 0 && dueTodayTasks.length === 0}
          emptyMsg="Sem tarefas urgentes"
          loading={hasLoadingLists}
        >
          {overdueTasks.map((t: any) => (
            <ListItem
              key={t.id}
              title={t.title}
              sub="Atrasada"
              tone="#991B1B"
              right={<span style={S.badgeDanger}>Atrasada</span>}
            />
          ))}
          {dueTodayTasks
            .filter((t: any) => !overdueTasks.find((o: any) => o.id === t.id))
            .map((t: any) => (
              <ListItem
                key={t.id}
                title={t.title}
                sub="Vence hoje"
                tone="#B8924F"
                right={<span style={S.badgeWarning}>Hoje</span>}
              />
            ))}
        </Section>
      </section>

      <section style={S.projectsCard}>
        <div style={S.sectionHead}>
          <div>
            <div style={S.sectionTitle}>Projetos em andamento</div>
            <div style={S.sectionSub}>Acompanhamento de progresso por frente</div>
          </div>
        </div>

        <div style={S.projectsGrid}>
          {hasLoadingProjects
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} style={S.projectCard}>
                  <SkeletonLine width="42%" height={14} />
                  <div style={{ height: 10 }} />
                  <SkeletonLine width="100%" height={8} rounded="999px" />
                  <div style={{ height: 8 }} />
                  <SkeletonLine width="36%" height={12} />
                </div>
              ))
            : (projects ?? []).map((p: any) => {
                const totalTasks = (p.tasks ?? []).length
                const doneTasks = (p.tasks ?? []).filter((t: any) => t.status === 'done').length
                const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0
                const barColor = p.color || '#B8924F'

                return (
                  <div key={p.id} style={S.projectCard}>
                    <div style={S.projectHead}>
                      <span style={S.projectName}>
                        {p.emoji ? `${p.emoji} ` : ''}
                        {p.name}
                      </span>
                      <span style={S.projectPercent}>{Math.round(progress)}%</span>
                    </div>

                    <div style={S.progressTrack}>
                      <div
                        style={{
                          ...S.progressFill,
                          background: barColor,
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <div style={S.projectMeta}>
                      {doneTasks}/{totalTasks} tarefas concluídas
                    </div>
                  </div>
                )
              })}
        </div>
      </section>
    </div>
  )
}

function MetricMini({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'danger' | 'warning' | 'neutral'
}) {
  const toneMap = {
    danger: { border: 'rgba(153,27,27,0.18)', bg: 'rgba(153,27,27,0.08)', color: '#991B1B' },
    warning: { border: 'rgba(184,146,79,0.24)', bg: 'rgba(184,146,79,0.12)', color: '#8A6A2F' },
    neutral: { border: 'rgba(5,11,20,0.12)', bg: 'rgba(255,255,255,0.58)', color: '#475569' },
  }[tone]

  return (
    <div style={{ ...S.metricMini, borderColor: toneMap.border, background: toneMap.bg }}>
      <span style={S.metricMiniLabel}>{label}</span>
      <strong style={{ ...S.metricMiniValue, color: toneMap.color }}>{value}</strong>
    </div>
  )
}

function StatCard({
  accent,
  title,
  value,
  detail,
  loading,
}: {
  accent: string
  title: string
  value: number
  detail: string
  loading?: boolean
}) {
  return (
    <div style={S.statCard}>
      <div style={{ ...S.statAccent, background: accent }} />
      <div style={S.statLabel}>{title}</div>
      {loading ? <SkeletonLine width="56px" height={38} /> : <div style={S.statValue}>{value}</div>}
      {loading ? <SkeletonLine width="92px" height={12} /> : <div style={S.statDetail}>{detail}</div>}
    </div>
  )
}

function Section({ title, subtitle, children, empty, emptyMsg, loading }: any) {
  return (
    <div style={S.sectionCard}>
      <div style={S.sectionHead}>
        <div>
          <div style={S.sectionTitle}>{title}</div>
          <div style={S.sectionSub}>{subtitle}</div>
        </div>
      </div>

      <div style={S.sectionBody}>
        {loading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : empty ? (
          <div style={S.empty}>{emptyMsg}</div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function ListItem({ title, sub, tone, right }: any) {
  return (
    <div style={S.listItem}>
      <div style={{ ...S.listDot, background: tone }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.listTitle}>{title}</div>
        <div style={S.listSub}>{sub}</div>
      </div>
      {right}
    </div>
  )
}

function EditedBadge() {
  return <span style={S.badgeEdited}>Editado</span>
}

function SkeletonItem() {
  return (
    <div style={S.listItem}>
      <SkeletonLine width={8} height={8} rounded="50%" />
      <div style={{ flex: 1 }}>
        <SkeletonLine width="58%" height={13} />
        <div style={{ height: 6 }} />
        <SkeletonLine width="34%" height={11} />
      </div>
      <SkeletonLine width="62px" height={22} rounded="999px" />
    </div>
  )
}

function SkeletonLine({
  width,
  height,
  rounded = '8px',
}: {
  width: string | number
  height: string | number
  rounded?: string
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: rounded,
        background: '#E7EBEF',
        animation: 'orbitSkeletonFade 1.2s ease-in-out infinite',
      }}
    />
  )
}

const S: Record<string, React.CSSProperties> = {
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
    gap: 18,
    marginBottom: 18,
  },
  heroMobile: {
    gridTemplateColumns: '1fr',
  },
  heroPanel: {
    background: 'linear-gradient(135deg, #050B14 0%, #0F1825 100%)',
    color: '#F5F2EC',
    borderRadius: 28,
    padding: '30px',
    minHeight: 240,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 24px 48px rgba(5,11,20,0.14)',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(245,242,236,0.58)',
  },
  heroTitle: {
    fontSize: 'clamp(34px, 5vw, 52px)',
    lineHeight: 1.02,
    letterSpacing: '-0.06em',
    fontWeight: 700,
    marginTop: 14,
  },
  heroText: {
    marginTop: 14,
    maxWidth: 620,
    color: 'rgba(245,242,236,0.72)',
    fontSize: 15,
    lineHeight: 1.7,
  },
  heroMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 12,
    marginTop: 24,
  },
  metricMini: {
    border: '1px solid',
    borderRadius: 18,
    padding: '14px 14px 16px',
  },
  metricMiniLabel: {
    display: 'block',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(245,242,236,0.58)',
  },
  metricMiniValue: {
    display: 'block',
    marginTop: 10,
    fontSize: 22,
    lineHeight: 1,
  },
  heroRail: {
    background: 'linear-gradient(180deg, #F5F2EC 0%, #EEE7DD 100%)',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 28,
    padding: 24,
    display: 'grid',
    gap: 18,
    minHeight: 240,
  },
  heroNote: {
    paddingBottom: 16,
    borderBottom: '1px solid rgba(5,11,20,0.08)',
  },
  heroNoteLabel: {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#64748B',
  },
  heroNoteValue: {
    display: 'block',
    marginTop: 10,
    fontSize: 28,
    lineHeight: 1,
    letterSpacing: '-0.04em',
    color: '#050B14',
  },
  heroTimeline: {
    display: 'grid',
    gap: 10,
  },
  heroTimelineItem: {
    display: 'grid',
    gridTemplateColumns: '62px 1fr',
    gap: 10,
    alignItems: 'center',
  },
  heroTimelineTime: {
    color: '#8A6A2F',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  heroTimelineText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 1.5,
  },
  heroTimelineEmpty: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 1.6,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 14,
    marginBottom: 18,
  },
  statCard: {
    background: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid rgba(5,11,20,0.08)',
    padding: '20px 20px 18px',
    position: 'relative',
    overflow: 'hidden',
  },
  statAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  statValue: {
    fontSize: 38,
    fontWeight: 700,
    letterSpacing: '-0.06em',
    lineHeight: 1,
    color: '#050B14',
    marginTop: 14,
  },
  statDetail: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 10,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
    marginBottom: 18,
  },
  mainGridMobile: {
    gridTemplateColumns: '1fr',
  },
  sectionCard: {
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1px solid rgba(5,11,20,0.08)',
    overflow: 'hidden',
  },
  sectionHead: {
    padding: '18px 20px',
    borderBottom: '1px solid #EDF1F4',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#050B14',
    letterSpacing: '-0.02em',
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
  },
  sectionBody: {
    padding: '10px 12px',
  },
  empty: {
    padding: '28px 18px',
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 10px',
    borderRadius: 16,
  },
  listDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#0F172A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  badgeEdited: {
    fontSize: 10,
    fontWeight: 700,
    color: '#8A6A2F',
    background: '#FBF4E4',
    border: '1px solid rgba(184,146,79,0.24)',
    padding: '4px 8px',
    borderRadius: 999,
  },
  badgeDanger: {
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: '#FEF2F2',
    color: '#991B1B',
  },
  badgeWarning: {
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: '#FBF4E4',
    color: '#8A6A2F',
  },
  projectsCard: {
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1px solid rgba(5,11,20,0.08)',
    overflow: 'hidden',
  },
  projectsGrid: {
    padding: '18px 20px 22px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 18,
  },
  projectCard: {
    borderRadius: 18,
    background: '#F8FAFB',
    border: '1px solid #E6EBF0',
    padding: '18px 16px',
  },
  projectHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  projectName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A',
  },
  projectPercent: {
    fontSize: 12,
    fontWeight: 700,
    color: '#64748B',
  },
  progressTrack: {
    height: 8,
    background: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  projectMeta: {
    marginTop: 10,
    fontSize: 11,
    color: '#94A3B8',
  },
}
