'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'
import { Progress } from '@/components/ui/Progress'

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
    timeZone: 'America/Sao_Paulo',
  })

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default function DashboardPage() {
  const router = useRouter()
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
            <MetricMini label="Urgência" value={overdueTasks.length} tone="danger" onClick={() => router.push('/tarefas')} />
            <MetricMini label="Hoje" value={dueTodayTasks.length} tone="warning" onClick={() => router.push('/tarefas')} />
            <MetricMini label="Alertas" value={unreadNotifications} tone="neutral" onClick={() => router.push('/notificacoes')} />
          </div>
        </div>

        <div style={{ ...S.heroRail, cursor: 'pointer' }} onClick={() => router.push('/compromissos')}>
          <div style={S.heroNote}>
            <span style={S.heroNoteLabel}>Próxima janela</span>
            <strong style={S.heroNoteValue}>
              {todayEvents[0]
                ? new Date(todayEvents[0].startAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo',
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
                    timeZone: 'America/Sao_Paulo',
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
        <StatCard accent="var(--brand-500, #2F6FE0)" title="Compromissos hoje" value={todayEvents.length} detail="Agenda do dia" loading={hasLoadingStats} onClick={() => router.push('/compromissos')} />
        <StatCard accent="#22C55E" title="Tarefas pendentes" value={pendingTasks} detail="Fila operacional" loading={hasLoadingStats} onClick={() => router.push('/tarefas')} />
        <StatCard accent="var(--brand-400, #5B8FEA)" title="Projetos ativos" value={activeProjects} detail="Frentes abertas" loading={hasLoadingStats} onClick={() => router.push('/projetos')} />
        <StatCard accent="#EF4444" title="Não lidas" value={unreadNotifications} detail="Central de alertas" loading={hasLoadingStats} onClick={() => router.push('/notificacoes')} />
      </section>

      <section style={{ ...S.mainGrid, ...(isMobile ? S.mainGridMobile : null) }}>
        <Section
          title="Compromissos do dia"
          subtitle="Os próximos pontos da sua rotina"
          empty={todayEvents.length === 0}
          emptyMsg="Nenhum compromisso hoje"
          loading={hasLoadingLists}
          onHeaderClick={() => router.push('/compromissos')}
        >
          {todayEvents.map((e: any) => (
            <ListItem
              key={e.id}
              title={e.title}
              sub={new Date(e.startAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo',
              })}
              tone="var(--brand-500, #2F6FE0)"
              right={e.hasHistory ? <EditedBadge /> : null}
              onClick={() => router.push('/compromissos')}
            />
          ))}
        </Section>

        <Section
          title="Tarefas urgentes"
          subtitle="Itens que pedem ação agora"
          empty={overdueTasks.length === 0 && dueTodayTasks.length === 0}
          emptyMsg="Sem tarefas urgentes"
          loading={hasLoadingLists}
          onHeaderClick={() => router.push('/tarefas')}
        >
          {overdueTasks.map((t: any) => (
            <ListItem
              key={t.id}
              title={t.title}
              sub="Atrasada"
              tone="#EF4444"
              right={<span style={S.badgeDanger}>Atrasada</span>}
              onClick={() => router.push('/tarefas')}
            />
          ))}
          {dueTodayTasks
            .filter((t: any) => !overdueTasks.find((o: any) => o.id === t.id))
            .map((t: any) => (
              <ListItem
                key={t.id}
                title={t.title}
                sub="Vence hoje"
                tone="#F59E0B"
                right={<span style={S.badgeWarning}>Hoje</span>}
                onClick={() => router.push('/tarefas')}
              />
            ))}
        </Section>
      </section>

      <section style={S.projectsCard}>
        <div style={{ ...S.sectionHead, cursor: 'pointer' }} onClick={() => router.push('/projetos')}>
          <div>
            <div style={S.sectionTitle}>Projetos em andamento →</div>
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

                return (
                  <div key={p.id} style={{ ...S.projectCard, cursor: 'pointer' }} onClick={() => router.push(`/projetos/${p.id}`)}>
                    <div style={S.projectHead}>
                      <span style={S.projectName}>
                        {p.emoji ? `${p.emoji} ` : ''}
                        {p.name}
                      </span>
                      <span style={S.projectPercent}>{Math.round(progress)}%</span>
                    </div>

                    <Progress value={progress} tone="brand" />

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
  onClick,
}: {
  label: string
  value: number
  tone: 'danger' | 'warning' | 'neutral'
  onClick?: () => void
}) {
  const toneMap = {
    danger: { border: 'rgba(220,38,38,0.18)', bg: 'rgba(220,38,38,0.06)', color: '#DC2626' },
    warning: { border: 'rgba(217,119,6,0.2)', bg: 'rgba(217,119,6,0.06)', color: '#D97706' },
    neutral: { border: 'var(--ink-200, #E5E7EB)', bg: 'var(--bg-subtle, #FAFBFC)', color: 'var(--fg-2, #374151)' },
  }[tone]

  return (
    <div style={{ ...S.metricMini, borderColor: toneMap.border, background: toneMap.bg, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <span style={S.metricMiniLabel}>{label}</span>
      <strong style={{ ...S.metricMiniValue, color: toneMap.color }}>{value}</strong>
    </div>
  )
}

function StatCard({
  accent, title, value, detail, loading, onClick,
}: {
  accent: string; title: string; value: number; detail: string; loading?: boolean; onClick?: () => void
}) {
  return (
    <div style={{ ...S.statCard, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ ...S.statAccent, background: accent }} />
      <div style={S.statLabel}>{title}</div>
      {loading ? <SkeletonLine width="56px" height={38} /> : <div style={S.statValue}>{value}</div>}
      {loading ? <SkeletonLine width="92px" height={12} /> : <div style={S.statDetail}>{detail}</div>}
    </div>
  )
}

function Section({ title, subtitle, children, empty, emptyMsg, loading, onHeaderClick }: any) {
  return (
    <div style={S.sectionCard}>
      <div style={{ ...S.sectionHead, cursor: onHeaderClick ? 'pointer' : 'default' }} onClick={onHeaderClick}>
        <div>
          <div style={S.sectionTitle}>{title}{onHeaderClick ? ' →' : ''}</div>
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

function ListItem({ title, sub, tone, right, onClick }: any) {
  return (
    <div style={{ ...S.listItem, cursor: 'pointer' }} onClick={onClick}>
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
    gridTemplateColumns: 'minmax(0, 1.9fr) minmax(280px, 1fr)',
    gap: 18,
    marginBottom: 18,
  },
  heroMobile: {
    gridTemplateColumns: '1fr',
  },
  heroPanel: {
    background: 'radial-gradient(120% 90% at 0% 0%, var(--brand-50, #F4F8FE) 0%, #fff 60%)',
    color: 'var(--fg-1, #111827)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 20,
    padding: '30px',
    minHeight: 240,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 1px 4px rgba(11,15,20,0.06)',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--brand-500, #2F6FE0)',
    fontWeight: 600,
  },
  heroTitle: {
    fontSize: 'clamp(28px, 4vw, 44px)',
    lineHeight: 1.06,
    letterSpacing: '-0.04em',
    fontWeight: 700,
    marginTop: 10,
    color: 'var(--fg-1, #111827)',
  },
  heroText: {
    marginTop: 12,
    maxWidth: 560,
    color: 'var(--fg-2, #374151)',
    fontSize: 14,
    lineHeight: 1.65,
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
    color: 'var(--fg-3, #6B7280)',
  },
  metricMiniValue: {
    display: 'block',
    marginTop: 8,
    fontSize: 22,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'var(--font-mono)',
  },
  heroRail: {
    background: 'var(--bg-subtle, #FAFBFC)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 20,
    padding: 24,
    display: 'grid',
    gap: 18,
    minHeight: 240,
  },
  heroNote: {
    paddingBottom: 16,
    borderBottom: '1px solid var(--ink-100, #F3F4F6)',
  },
  heroNoteLabel: {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--fg-3, #6B7280)',
  },
  heroNoteValue: {
    display: 'block',
    marginTop: 8,
    fontSize: 28,
    lineHeight: 1,
    letterSpacing: '-0.04em',
    color: 'var(--fg-1, #111827)',
    fontFamily: 'var(--font-mono)',
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
    color: 'var(--brand-500, #2F6FE0)',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-mono)',
  },
  heroTimelineText: {
    color: 'var(--fg-2, #374151)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  heroTimelineEmpty: {
    color: 'var(--fg-3, #6B7280)',
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
    background: 'var(--bg, #FFFFFF)',
    borderRadius: 14,
    border: '1px solid var(--ink-200, #E5E7EB)',
    padding: '20px 20px 18px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  statAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--fg-3, #6B7280)',
    marginTop: 4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
    color: 'var(--fg-1, #111827)',
    marginTop: 12,
  },
  statDetail: {
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
    marginTop: 8,
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
    background: 'var(--bg, #FFFFFF)',
    borderRadius: 14,
    border: '1px solid var(--ink-200, #E5E7EB)',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  sectionHead: {
    padding: '18px 20px',
    borderBottom: '1px solid var(--ink-100, #F3F4F6)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
    letterSpacing: '-0.01em',
  },
  sectionSub: {
    marginTop: 2,
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
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
    color: 'var(--fg-1, #111827)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listSub: {
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    marginTop: 3,
  },
  badgeEdited: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--brand-700, #0E335A)',
    background: 'var(--brand-50, #F4F8FE)',
    border: '1px solid var(--brand-200, #BFDBFE)',
    padding: '3px 8px',
    borderRadius: 999,
  },
  badgeDanger: {
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    background: '#FEF2F2',
    color: '#DC2626',
    border: '1px solid rgba(220,38,38,0.2)',
  },
  badgeWarning: {
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    background: '#FFFBEB',
    color: '#D97706',
    border: '1px solid rgba(217,119,6,0.2)',
  },
  projectsCard: {
    background: 'var(--bg, #FFFFFF)',
    borderRadius: 14,
    border: '1px solid var(--ink-200, #E5E7EB)',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  projectsGrid: {
    padding: '18px 20px 22px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 18,
  },
  projectCard: {
    borderRadius: 12,
    background: 'var(--bg-subtle, #FAFBFC)',
    border: '1px solid var(--ink-100, #F3F4F6)',
    padding: '16px 16px 14px',
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
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
  },
  projectPercent: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--fg-3, #6B7280)',
    fontFamily: 'var(--font-mono)',
  },
  projectMeta: {
    marginTop: 8,
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
  },
}
