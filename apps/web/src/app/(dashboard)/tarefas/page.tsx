'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'
import { TaskModal } from '@/components/TaskModal'
import type { TaskForModal, ProjectForModal } from '@/components/TaskModal'
import { AlertTriangle } from 'lucide-react'

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
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
}

const STATUS_COLOR: Record<Status, string> = {
  pending: 'var(--fg-3, #6B7280)',
  in_progress: 'var(--brand-500, #2F6FE0)',
  done: '#22C55E',
}

const CHECK_LABEL: Record<Status, string> = {
  pending: 'INICIAR',
  in_progress: 'CONCLUIR',
  done: 'REABRIR',
}

const CHECK_LABEL_COLOR: Record<Status, string> = {
  pending: 'var(--ink-200, #E5E7EB)',
  in_progress: 'var(--brand-500, #2F6FE0)',
  done: '#22C55E',
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
        <MetricCard label="Todas" value={counts.all} accent="var(--fg-1, #111827)" />
        <MetricCard label="Pendentes" value={counts.pending} accent="var(--fg-3, #6B7280)" />
        <MetricCard label="Em andamento" value={counts.in_progress} accent="var(--brand-500, #2F6FE0)" />
        <MetricCard label="Concluídas" value={counts.done} accent="#22C55E" />
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
            <option value="">Todos os projetos</option>
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
                    borderColor: overdue ? 'rgba(220,38,38,0.2)' : 'var(--ink-200, #E5E7EB)',
                  }}
                >
                  <div style={{ ...S.cardMain, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                    <div style={S.checkWrap} onClick={(e) => e.stopPropagation()}>
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
                            background: `${PRIORITY_COLOR[t.priority]}18`,
                            color: PRIORITY_COLOR[t.priority],
                          }}
                        >
                          {PRIORITY_LABEL[t.priority]}
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
                              color: overdue ? '#EF4444' : 'var(--fg-3, #6B7280)',
                              fontWeight: overdue ? 600 : 400,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            {overdue ? <AlertTriangle size={11} strokeWidth={1.75} /> : null}
                            {new Date(t.dueAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedId === t.id && (
                    <div style={S.cardDesc}>
                      {t.description
                        ? t.description
                        : <span style={{ color: '#CBD5E1' }}>Sem descrição.</span>
                      }
                    </div>
                  )}

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
                        style={{ ...S.actionBtn, color: '#EF4444' }}
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
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--brand-500, #2F6FE0)',
    marginBottom: 10,
  },
  title: {
    fontSize: 'clamp(26px, 4vw, 36px)',
    fontWeight: 700,
    letterSpacing: '-0.04em',
    color: 'var(--fg-1, #111827)',
  },
  sub: {
    marginTop: 10,
    fontSize: 14,
    color: 'var(--fg-3, #6B7280)',
    lineHeight: 1.7,
  },
  btnPrimary: {
    padding: '12px 18px',
    background: 'var(--brand-500, #2F6FE0)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
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
    background: 'var(--bg, #FFFFFF)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 14,
    padding: '18px 18px 16px',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  metricAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--fg-3, #6B7280)',
  },
  metricValue: {
    marginTop: 10,
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--fg-1, #111827)',
  },
  filters: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filter: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--ink-200, #E5E7EB)',
    background: 'var(--bg, #FFFFFF)',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--fg-3, #6B7280)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 500,
  },
  filterActive: {
    background: 'var(--brand-50, #F4F8FE)',
    borderColor: 'var(--brand-200, #BFDBFE)',
    color: 'var(--brand-700, #0E335A)',
  },
  filterBadge: {
    background: 'rgba(11,15,20,0.07)',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
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
    background: 'var(--bg, #FFFFFF)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  sidePanel: {
    background: 'var(--bg, #FFFFFF)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 320,
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  panelHead: {
    padding: '18px 20px',
    borderBottom: '1px solid var(--ink-100, #F3F4F6)',
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
  },
  panelSub: {
    marginTop: 2,
    fontSize: 12,
    color: 'var(--fg-3, #6B7280)',
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
    color: 'var(--fg-3, #6B7280)',
    fontSize: 14,
  },
  card: {
    background: 'var(--bg, #FFFFFF)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--ink-200, #E5E7EB)',
    borderRadius: 12,
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
    border: '2px solid var(--ink-200, #E5E7EB)', background: 'none', cursor: 'pointer',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .15s',
  },
  checkDone: { background: '#22C55E', borderColor: '#22C55E', color: '#fff' },
  checkProgress: { background: 'var(--brand-50, #F4F8FE)', borderColor: 'var(--brand-500, #2F6FE0)', color: 'var(--brand-500, #2F6FE0)' },
  checkLabelText: {
    fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
  },
  cardTitleRow: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  cardTitle: {
    fontSize: 14, fontWeight: 600, color: 'var(--fg-1, #111827)', lineHeight: 1.3,
  },
  cardTags: {
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
  },
  tag: {
    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
  },
  cardDate: { fontSize: 11 },
  cardDesc: {
    fontSize: 13, color: 'var(--fg-2, #374151)', lineHeight: 1.6,
    marginTop: 10, paddingTop: 10,
    borderTop: '1px solid var(--ink-100, #F3F4F6)',
    whiteSpace: 'pre-wrap' as const,
  },
  cardFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--ink-100, #F3F4F6)',
  },
  statusLabel: { fontSize: 11, fontWeight: 600 },
  cardActions: { display: 'flex', gap: 4, alignItems: 'center' },
  actionBtn: {
    fontSize: 11, padding: '5px 10px', borderRadius: 8,
    border: '1px solid var(--ink-100, #F3F4F6)', background: 'transparent',
    color: 'var(--fg-3, #6B7280)', cursor: 'pointer', fontWeight: 500,
  },
  actionSep: { color: 'var(--ink-200, #E5E7EB)', fontSize: 14, userSelect: 'none' },
  editBadge: {
    fontSize: 10, fontWeight: 600, color: 'var(--brand-700, #0E335A)',
    background: 'var(--brand-50, #F4F8FE)', border: '1px solid var(--brand-200, #BFDBFE)',
    padding: '3px 7px', borderRadius: 6,
  },
  historyBody: {
    padding: 16,
    display: 'grid',
    gap: 12,
  },
  historyEmpty: {
    color: 'var(--fg-3, #6B7280)',
    fontSize: 13,
    lineHeight: 1.7,
  },
  historyItem: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottom: '1px solid var(--ink-100, #F3F4F6)',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--brand-400, #5B8FEA)',
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
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
    textTransform: 'capitalize',
  },
  historyDate: {
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    fontFamily: 'var(--font-mono)',
  },
  historyValues: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    fontSize: 12,
  },
  historyOld: {
    color: '#EF4444',
  },
  historyArrow: {
    color: 'var(--fg-3, #6B7280)',
  },
  historyNew: {
    color: '#22C55E',
  },
}
