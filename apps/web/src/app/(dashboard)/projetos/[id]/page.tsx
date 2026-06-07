// apps/web/src/app/(dashboard)/projetos/[id]/page.tsx
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { projectStatus, STATUS_LABEL, STATUS_PILL_STYLE } from '@/lib/project-status'
import { useIsMobile } from '@/lib/use-mobile'
import { TaskModal } from '@/components/TaskModal'
import type { ProjectForModal } from '@/components/TaskModal'
import { Progress } from '@/components/ui/Progress'

type Project = {
  id: string
  name: string
  description?: string
  color: string
  emoji: string
  deadline?: string
  // GET /projects/:id does not return taskCount/taskDone — we compute from tasks below
}

type Priority = 'low' | 'medium' | 'high'
type TaskStatus = 'pending' | 'in_progress' | 'done'

type Task = {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  dueAt?: string
}

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }
const PRIORITY_COLOR: Record<Priority, string> = {
  low: '#22C55E', medium: '#F59E0B', high: '#EF4444',
}
const STATUS_LABEL_TASK: Record<TaskStatus, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída',
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: project } = useSWR<Project>(`/projects/${id}`, fetcher)
  const { data: tasks = [], isLoading: tasksLoading } = useSWR<Task[]>(`/tasks?projectId=${id}`, fetcher)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  const isMobile = useIsMobile()
  const [taskFilter, setTaskFilter] = useState<'all' | TaskStatus>('all')

  if (!project) {
    return <div style={S.loading}>Carregando...</div>
  }

  const projectForModal: ProjectForModal[] = [{ id: project.id, name: project.name, emoji: project.emoji, color: project.color }]

  // GET /projects/:id includes tasks array but does not pre-compute counts —
  // use the tasks array from the separate SWR (stays in sync with toggleStatus)
  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }

  const taskCount = tasks.length
  const taskDone = counts.done
  const st = projectStatus({ taskCount, taskDone, deadline: project.deadline })
  const progress = taskCount > 0 ? (taskDone / taskCount) * 100 : 0

  const filtered = tasks.filter((t) => taskFilter === 'all' || t.status === taskFilter)

  async function toggleStatus(t: Task) {
    const next: TaskStatus =
      t.status === 'done' ? 'pending' : t.status === 'pending' ? 'in_progress' : 'done'
    try {
      await api.patch(`/tasks/${t.id}`, { status: next })
      mutate(`/tasks?projectId=${id}`)
      mutate(`/projects/${id}`)
      mutate('/projects')
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa', err)
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <button style={S.breadcrumbLink} onClick={() => router.push('/projetos')}>
          Projetos
        </button>
        <span style={S.breadcrumbSep}>/</span>
        <span style={S.breadcrumbCurrent}>{project.emoji} {project.name}</span>
      </div>

      {/* Hero */}
      <section style={{ ...S.hero, borderTop: `4px solid ${project.color}`, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={S.heroLeft}>
          <div style={{ ...S.emojiBox, background: `${project.color}18`, color: project.color }}>
            {project.emoji}
          </div>
          <div>
            <h1 style={S.heroName}>{project.name}</h1>
            {project.description && <p style={S.heroDesc}>{project.description}</p>}
            {project.deadline && (
              <p style={S.heroDue}>
                Prazo: {new Date(project.deadline).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </p>
            )}
          </div>
        </div>
        <span style={{ ...S.pill, ...STATUS_PILL_STYLE[st] }}>
          {STATUS_LABEL[st]}
        </span>
      </section>

      {/* Progress */}
      <section style={S.progressSection}>
        <div style={S.progressHeader}>
          <div>
            <div style={S.progressTitle}>Progresso geral</div>
            <div style={S.progressSub}>{taskDone} de {taskCount} tarefas concluídas</div>
          </div>
          <div style={{ ...S.pctBig, color: project.color }}>{Math.round(progress)}%</div>
        </div>
        <Progress value={progress} tone="brand" />
      </section>

      {/* Metrics */}
      <section style={{ ...S.metricsRow, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{taskCount}</div>
          <div style={S.metricLbl}>Total</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: '#22C55E' }}>{counts.done}</div>
          <div style={S.metricLbl}>Concluídas</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: project.color }}>{counts.in_progress}</div>
          <div style={S.metricLbl}>Em andamento</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--fg-3, #6B7280)' }}>{counts.pending}</div>
          <div style={S.metricLbl}>Pendentes</div>
        </div>
      </section>

      {/* Task list */}
      <section style={S.tasksSection}>
        <div style={S.tasksPanelHead}>
          <div style={S.panelTitle}>Tarefas</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button style={S.btnNewTask} onClick={() => setTaskModalOpen(true)}>
              + Nova tarefa
            </button>
            <div style={S.tabs}>
              {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
                <button
                  key={f}
                  style={{ ...S.tab, ...(taskFilter === f ? S.tabActive : {}) }}
                  onClick={() => setTaskFilter(f)}
                >
                  {f === 'all' ? 'Todas' : STATUS_LABEL_TASK[f as TaskStatus]}
                  <span style={S.tabBadge}>{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={S.taskList}>
          {tasksLoading && tasks.length === 0 && (
            <div style={S.empty}>Carregando tarefas...</div>
          )}
          {!tasksLoading && filtered.length === 0 && (
            <div style={S.empty}>Nenhuma tarefa nesta categoria.</div>
          )}
          {filtered.map((t) => (
            <div key={t.id} style={{ ...S.taskRow, opacity: t.status === 'done' ? 0.65 : 1 }}>
              <button
                style={{
                  ...S.checkBtn,
                  ...(t.status === 'done' ? S.checkDone : t.status === 'in_progress' ? S.checkProgress : {}),
                }}
                onClick={() => toggleStatus(t)}
              >
                {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '◔' : '○'}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  ...S.taskTitle,
                  ...(t.status === 'done' ? { textDecoration: 'line-through', color: '#94A3B8' } : {}),
                }}>
                  {t.title}
                </div>
                <div style={S.taskMeta}>
                  <span style={{
                    ...S.priorityPill,
                    background: `${PRIORITY_COLOR[t.priority]}16`,
                    color: PRIORITY_COLOR[t.priority],
                  }}>
                    {PRIORITY_LABEL[t.priority]}
                  </span>
                  {t.dueAt && (
                    <span>{new Date(t.dueAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSaved={() => {
          mutate(`/tasks?projectId=${id}`)
          mutate(`/projects/${id}`)
          mutate('/projects')
        }}
        projects={projectForModal}
        defaultProjectId={id}
      />
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  loading: { padding: 40, textAlign: 'center', color: 'var(--fg-3, #6B7280)', fontSize: 14 },
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--fg-3, #6B7280)', marginBottom: 14,
  },
  breadcrumbLink: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--fg-3, #6B7280)', fontSize: 12, padding: 0,
  },
  breadcrumbSep: { color: 'var(--ink-200, #E5E7EB)' },
  breadcrumbCurrent: { color: 'var(--fg-2, #374151)', fontWeight: 600 },
  hero: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
    background: 'var(--bg, #FFFFFF)', borderRadius: 14, border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)', padding: '22px 24px', marginBottom: 14,
  },
  heroLeft: { display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 0 },
  emojiBox: {
    width: 52, height: 52, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, flexShrink: 0,
  },
  heroName: { fontSize: 20, fontWeight: 700, color: 'var(--fg-1, #111827)', letterSpacing: '-0.02em' },
  heroDesc: { marginTop: 4, fontSize: 13, color: 'var(--fg-3, #6B7280)', lineHeight: 1.6 },
  heroDue: { marginTop: 4, fontSize: 11, color: 'var(--fg-3, #6B7280)', fontFamily: 'var(--font-mono)' },
  pill: {
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    padding: '4px 12px', borderRadius: 6, flexShrink: 0,
  },
  progressSection: {
    background: 'var(--bg, #FFFFFF)', borderRadius: 14, border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)', padding: '18px 24px', marginBottom: 14,
  },
  progressHeader: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  progressTitle: { fontSize: 14, fontWeight: 700, color: 'var(--fg-1, #111827)' },
  progressSub: { marginTop: 3, fontSize: 12, color: 'var(--fg-3, #6B7280)' },
  pctBig: { fontSize: 32, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)', color: 'var(--brand-500, #2F6FE0)' },
  metricsRow: {
    display: 'grid', gap: 12, marginBottom: 14,
  },
  metricCard: {
    background: 'var(--bg, #FFFFFF)', borderRadius: 12, border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)', padding: '16px 20px',
  },
  metricVal: { fontSize: 28, fontWeight: 800, color: 'var(--fg-1, #111827)', lineHeight: 1, fontFamily: 'var(--font-mono)' },
  metricLbl: { marginTop: 4, fontSize: 11, color: 'var(--fg-3, #6B7280)', fontWeight: 600 },
  tasksSection: {
    background: 'var(--bg, #FFFFFF)', borderRadius: 14, border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)', overflow: 'hidden',
  },
  tasksPanelHead: {
    padding: '16px 20px', borderBottom: '1px solid var(--ink-200, #E5E7EB)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
  },
  panelTitle: { fontSize: 15, fontWeight: 700, color: 'var(--fg-1, #111827)' },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    border: '1px solid var(--ink-200, #E5E7EB)', background: 'var(--bg-subtle, #FAFBFC)',
    fontSize: 12, fontWeight: 600, color: 'var(--fg-3, #6B7280)', cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--brand-50, #F4F8FE)', color: 'var(--brand-700, #0E335A)',
    border: '1px solid var(--brand-200, #BFDBFE)',
  },
  tabBadge: {
    background: 'var(--ink-100, #F3F4F6)', borderRadius: 6,
    padding: '1px 7px', fontSize: 10,
  },
  taskList: { display: 'grid', gap: 8, padding: 14 },
  empty: { padding: '20px', textAlign: 'center', color: 'var(--fg-3, #6B7280)', fontSize: 13 },
  taskRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 14px', borderRadius: 10,
    background: 'var(--bg-subtle, #FAFBFC)', border: '1px solid var(--ink-200, #E5E7EB)',
  },
  checkBtn: {
    width: 28, height: 28, borderRadius: '50%',
    border: '2px solid var(--ink-200, #E5E7EB)', background: 'none', cursor: 'pointer',
    fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkDone: { background: '#22C55E', borderColor: '#22C55E', color: '#fff' },
  checkProgress: { background: 'var(--brand-50, #F4F8FE)', borderColor: 'var(--brand-500, #2F6FE0)', color: 'var(--brand-500, #2F6FE0)' },
  taskTitle: { fontSize: 13, fontWeight: 600, color: 'var(--fg-1, #111827)' },
  taskMeta: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 5, flexWrap: 'wrap', fontSize: 11, color: 'var(--fg-3, #6B7280)',
    fontFamily: 'var(--font-mono)',
  },
  priorityPill: { padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600 },
  btnNewTask: {
    padding: '6px 14px',
    background: 'var(--brand-500, #2F6FE0)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
}
