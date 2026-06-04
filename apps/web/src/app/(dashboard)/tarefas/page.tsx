'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'
import { TaskModal } from '@/components/TaskModal'
import type { TaskForModal, ProjectForModal } from '@/components/TaskModal'

type Priority = 'low' | 'medium' | 'high'
type Status = 'pending' | 'in_progress' | 'done'

type Task = {
  id: string
  title: string
  description?: string
  dueAt?: string
  priority: Priority
  status: Status
  projectId?: string
  notifPush: boolean
  notifEmail: boolean
  hasHistory?: boolean
  project?: { id: string; name: string; color: string; emoji?: string }
}

type Project = { id: string; name: string; emoji: string; color: string }

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

const PRIORITY_COLOR: Record<Priority, string> = {
  low: '#0F766E',
  medium: '#B8924F',
  high: '#991B1B',
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
}

const STATUS_COLOR: Record<Status, string> = {
  pending: '#64748B',
  in_progress: '#1D4ED8',
  done: '#0F766E',
}

const CHECK_LABEL: Record<Status, string> = {
  pending: 'INICIAR',
  in_progress: 'CONCLUIR',
  done: 'REABRIR',
}

const CHECK_LABEL_COLOR: Record<Status, string> = {
  pending: '#CBD5E1',
  in_progress: '#1D4ED8',
  done: '#0F766E',
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

export default function TarefasPage() {
  const isMobile = useIsMobile()
  const { data: projects = [] } = useSWR<Project[]>('/projects', fetcher)

  const [filter, setFilter] = useState<'all' | Status>('all')
  const [projectFilter, setProjectFilter] = useState<string>('')

  const tasksKey = projectFilter ? `/tasks?projectId=${projectFilter}` : '/tasks'
  const { data: tasks = [] } = useSWR<Task[]>(tasksKey, fetcher)
  const [taskModal, setTaskModal] = useState<{ open: boolean; editing: TaskForModal | null }>({
    open: false,
    editing: null,
  })
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null)

  const { data: history = [] } = useSWR(
    historyTaskId ? `/tasks/${historyTaskId}/history` : null,
    fetcher
  )

  const filtered = tasks.filter((t) => filter === 'all' || t.status === filter)
  const overdueCount = tasks.filter(
    (t) => t.dueAt && new Date(t.dueAt) < new Date() && t.status !== 'done'
  ).length

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }

  function openNew() {
    setTaskModal({ open: true, editing: null })
  }

  function openEdit(t: Task) {
    setTaskModal({ open: true, editing: t })
  }

  async function remove(id: string) {
    if (!confirm('Remover esta tarefa?')) return
    await api.delete(`/tasks/${id}`)
    mutate(tasksKey)
  }

  async function toggleStatus(t: Task) {
    const next: Status =
      t.status === 'done' ? 'pending' : t.status === 'pending' ? 'in_progress' : 'done'
    await api.patch(`/tasks/${t.id}`, { status: next })
    mutate(tasksKey)
  }

  return (
    <div>
      <section style={S.hero}>
        <div>
          <div style={S.eyebrow}>Gestão de tarefas</div>
          <h1 style={S.title}>Foco na próxima ação.</h1>
          <p style={S.sub}>
            {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} no total, {counts.pending}{' '}
            pendente{counts.pending !== 1 ? 's' : ''} e {overdueCount} em atraso.
          </p>
        </div>
        <button style={S.btnPrimary} onClick={openNew}>
          Nova tarefa
        </button>
      </section>

      <section
        style={{
          ...S.metrics,
          ...(isMobile ? S.metricsMobile : null),
        }}
      >
        <MetricCard label="Todas" value={counts.all} accent="#050B14" />
        <MetricCard label="Pendentes" value={counts.pending} accent="#64748B" />
        <MetricCard label="Em andamento" value={counts.in_progress} accent="#1D4ED8" />
        <MetricCard label="Concluídas" value={counts.done} accent="#0F766E" />
      </section>

      <div style={S.filters}>
        {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
          <button
            key={f}
            style={{ ...S.filter, ...(filter === f ? S.filterActive : {}) }}
            onClick={() => setFilter(f)}
          >
            <span>{f === 'all' ? 'Todas' : STATUS_LABEL[f as Status]}</span>
            <span style={S.filterBadge}>{counts[f]}</span>
          </button>
        ))}

        {/* Project filter */}
        {projects.length > 0 && (
          <select
            style={{
              ...S.filter,
              ...(projectFilter ? S.filterActive : {}),
              cursor: 'pointer',
              paddingRight: 28,
            }}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">📁 Todos os projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <section style={{ ...S.mainGrid, ...(isMobile ? S.mainGridMobile : null) }}>
        <div style={S.panel}>
          <div style={S.panelHead}>
            <div>
              <div style={S.panelTitle}>Fila principal</div>
              <div style={S.panelSub}>Visualização por status e prioridade</div>
            </div>
          </div>

          <div style={S.list}>
            {filtered.length === 0 && <div style={S.empty}>Nenhuma tarefa aqui</div>}

            {filtered.map((t) => {
              const overdue = t.dueAt && new Date(t.dueAt) < new Date() && t.status !== 'done'

              return (
                <div
                  key={t.id}
                  style={{
                    ...S.card,
                    opacity: t.status === 'done' ? 0.55 : 1,
                    borderColor: overdue ? 'rgba(153,27,27,0.14)' : 'rgba(5,11,20,0.08)',
                  }}
                >
                  <div style={S.cardMain}>
                    <div style={S.checkWrap}>
                      <button
                        style={{
                          ...S.checkBtn,
                          ...(t.status === 'done'
                            ? S.checkDone
                            : t.status === 'in_progress'
                              ? S.checkProgress
                              : {}),
                        }}
                        onClick={() => toggleStatus(t)}
                      >
                        {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '◔' : '○'}
                      </button>
                      <span style={{ ...S.checkLabelText, color: CHECK_LABEL_COLOR[t.status] }}>
                        {CHECK_LABEL[t.status]}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.cardTitleRow}>
                        <span
                          style={{
                            ...S.cardTitle,
                            ...(t.status === 'done'
                              ? { textDecoration: 'line-through', color: '#94A3B8' }
                              : {}),
                          }}
                        >
                          {t.title}
                        </span>
                        {t.hasHistory && <span style={S.editBadge}>Editada</span>}
                      </div>

                      <div style={S.cardTags}>
                        <span
                          style={{
                            ...S.tag,
                            background: `${PRIORITY_COLOR[t.priority]}16`,
                            color: PRIORITY_COLOR[t.priority],
                          }}
                        >
                          ● {PRIORITY_LABEL[t.priority]}
                        </span>
                        {t.project && (
                          <span
                            style={{
                              ...S.tag,
                              background: `${t.project.color}18`,
                              color: t.project.color,
                            }}
                          >
                            {t.project.emoji ? `${t.project.emoji} ` : ''}
                            {t.project.name}
                          </span>
                        )}
                        {t.dueAt && (
                          <span
                            style={{
                              ...S.cardDate,
                              color: overdue ? '#991B1B' : '#94A3B8',
                              fontWeight: overdue ? 700 : 400,
                            }}
                          >
                            {overdue ? '⚠ ' : ''}
                            {new Date(t.dueAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={S.cardFooter}>
                    <span style={{ ...S.statusLabel, color: STATUS_COLOR[t.status] }}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <div style={S.cardActions}>
                      {t.hasHistory && (
                        <button
                          style={S.actionBtn}
                          onClick={() => setHistoryTaskId(historyTaskId === t.id ? null : t.id)}
                        >
                          Histórico
                        </button>
                      )}
                      <button style={S.actionBtn} onClick={() => openEdit(t)}>
                        Editar
                      </button>
                      <span style={S.actionSep}>·</span>
                      <button
                        style={{ ...S.actionBtn, color: '#991B1B' }}
                        onClick={() => remove(t.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={S.sidePanel}>
          <div style={S.panelHead}>
            <div>
              <div style={S.panelTitle}>Histórico</div>
              <div style={S.panelSub}>
                {historyTaskId
                  ? tasks.find((t) => t.id === historyTaskId)?.title ?? 'Tarefa selecionada'
                  : 'Selecione uma tarefa editada'}
              </div>
            </div>
          </div>

          <div style={S.historyBody}>
            {!historyTaskId && (
              <div style={S.historyEmpty}>
                O histórico aparece aqui quando você abrir uma tarefa com alterações registradas.
              </div>
            )}

            {historyTaskId && history.length === 0 && (
              <div style={S.historyEmpty}>Sem alterações registradas.</div>
            )}

            {historyTaskId &&
              history.map((h: any) => (
                <div key={h.id} style={S.historyItem}>
                  <div style={S.historyDot} />
                  <div style={{ flex: 1 }}>
                    <div style={S.historyTop}>
                      <span style={S.historyField}>{h.field}</span>
                      <span style={S.historyDate}>
                        {new Date(h.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </span>
                    </div>
                    <div style={S.historyValues}>
                      <span style={S.historyOld}>{h.oldValue || '(vazio)'}</span>
                      <span style={S.historyArrow}>→</span>
                      <span style={S.historyNew}>{h.newValue || '(vazio)'}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <TaskModal
        open={taskModal.open}
        onClose={() => setTaskModal({ open: false, editing: null })}
        onSaved={() => mutate(tasksKey)}
        editing={taskModal.editing}
        projects={projects as ProjectForModal[]}
      />
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div style={S.metricCard}>
      <div style={{ ...S.metricAccent, background: accent }} />
      <div style={S.metricLabel}>{label}</div>
      <div style={S.metricValue}>{value}</div>
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
  btnPrimary: {
    padding: '12px 18px',
    background: 'linear-gradient(135deg, #050B14 0%, #101C2B 100%)',
    color: '#F5F2EC',
    border: 'none',
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
    marginBottom: 18,
  },
  metricsMobile: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  metricCard: {
    position: 'relative',
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 20,
    padding: '18px 18px 16px',
    overflow: 'hidden',
  },
  metricAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  metricValue: {
    marginTop: 10,
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-0.05em',
    color: '#050B14',
  },
  filters: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filter: {
    padding: '10px 14px',
    borderRadius: 999,
    border: '1px solid rgba(5,11,20,0.08)',
    background: '#FFFFFF',
    fontSize: 13,
    cursor: 'pointer',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
  },
  filterActive: {
    background: '#FBF4E4',
    borderColor: 'rgba(184,146,79,0.26)',
    color: '#8A6A2F',
  },
  filterBadge: {
    background: 'rgba(5,11,20,0.07)',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 0.8fr)',
    gap: 16,
  },
  mainGridMobile: {
    gridTemplateColumns: '1fr',
  },
  panel: {
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 24,
    overflow: 'hidden',
  },
  sidePanel: {
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 320,
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
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
  },
  empty: {
    padding: 42,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
  },
  card: {
    background: '#FFFFFF',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(5,11,20,0.08)',
    borderRadius: 20,
    padding: '14px 16px',
    transition: 'opacity .15s',
  },
  cardMain: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
  },
  checkWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, flexShrink: 0,
  },
  checkBtn: {
    width: 32, height: 32, borderRadius: 10,
    border: '2px solid #E2E8F0', background: 'none', cursor: 'pointer',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .15s',
  },
  checkDone: { background: '#0F766E', borderColor: '#0F766E', color: '#fff' },
  checkProgress: { background: '#EFF6FF', borderColor: '#1D4ED8', color: '#1D4ED8' },
  checkLabelText: {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
  },
  cardTitleRow: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.3,
  },
  cardTags: {
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
  },
  tag: {
    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
  },
  cardDate: { fontSize: 11 },
  cardFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTop: '1px dashed #EDF1F4',
  },
  statusLabel: { fontSize: 11, fontWeight: 600 },
  cardActions: { display: 'flex', gap: 4, alignItems: 'center' },
  actionBtn: {
    fontSize: 11, padding: '5px 10px', borderRadius: 8,
    border: '1px solid #EDF1F4', background: 'transparent',
    color: '#64748B', cursor: 'pointer', fontWeight: 600,
  },
  actionSep: { color: '#E2E8F0', fontSize: 14, userSelect: 'none' },
  editBadge: {
    fontSize: 10, fontWeight: 700, color: '#8A6A2F',
    background: '#FBF4E4', border: '1px solid rgba(184,146,79,0.24)',
    padding: '3px 7px', borderRadius: 999,
  },
  historyBody: {
    padding: 16,
    display: 'grid',
    gap: 12,
  },
  historyEmpty: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 1.7,
  },
  historyItem: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottom: '1px solid #F3F5F7',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#B8924F',
    marginTop: 7,
    flexShrink: 0,
  },
  historyTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  historyField: {
    fontSize: 12,
    fontWeight: 700,
    color: '#050B14',
    textTransform: 'capitalize',
  },
  historyDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  historyValues: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    fontSize: 12,
  },
  historyOld: {
    color: '#991B1B',
  },
  historyArrow: {
    color: '#94A3B8',
  },
  historyNew: {
    color: '#0F766E',
  },
}
