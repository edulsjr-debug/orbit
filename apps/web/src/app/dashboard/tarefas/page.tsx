'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'

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

type TaskForm = {
  title: string
  description: string
  dueAt: string
  priority: Priority
  status: Status
  projectId: string
  notifPush: boolean
  notifEmail: boolean
}

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

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  dueAt: '',
  priority: 'medium',
  status: 'pending',
  projectId: '',
  notifPush: true,
  notifEmail: false,
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

function pad(n: number) { return String(n).padStart(2, '0') }

function toDatetimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function localInputToISO(value: string): string {
  const [datePart, timePart] = value.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, m] = (timePart ?? '00:00').split(':').map(Number)
  return new Date(y, mo - 1, d, h, m).toISOString()
}

export default function TarefasPage() {
  const isMobile = useIsMobile()
  const { data: tasks = [] } = useSWR<Task[]>('/tasks', fetcher)
  const { data: projects = [] } = useSWR<Project[]>('/projects', fetcher)

  const [filter, setFilter] = useState<'all' | Status>('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
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
    setEditing(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  function openEdit(t: Task) {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description ?? '',
      dueAt: t.dueAt ? toDatetimeLocal(new Date(t.dueAt)) : '',
      priority: t.priority,
      status: t.status,
      projectId: t.projectId ?? '',
      notifPush: t.notifPush,
      notifEmail: t.notifEmail,
    })
    setModal(true)
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        ...form,
        dueAt: form.dueAt ? localInputToISO(form.dueAt) : undefined,
        projectId: form.projectId || undefined,
      }

      if (editing) {
        await api.patch(`/tasks/${editing.id}`, body)
      } else {
        await api.post('/tasks', body)
      }

      mutate('/tasks')
      setModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover esta tarefa?')) return
    await api.delete(`/tasks/${id}`)
    mutate('/tasks')
  }

  async function toggleStatus(t: Task) {
    const next: Status =
      t.status === 'done' ? 'pending' : t.status === 'pending' ? 'in_progress' : 'done'
    await api.patch(`/tasks/${t.id}`, { status: next })
    mutate('/tasks')
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
                    opacity: t.status === 'done' ? 0.68 : 1,
                    borderColor: overdue ? 'rgba(153,27,27,0.14)' : 'rgba(5,11,20,0.08)',
                  }}
                >
                  <div style={S.cardLeft}>
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

                      <div style={S.cardMeta}>
                        {t.dueAt && (
                          <span style={{ color: overdue ? '#991B1B' : '#94A3B8' }}>
                            {new Date(t.dueAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                          </span>
                        )}
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
                      </div>
                    </div>
                  </div>

                  <div style={S.cardRight}>
                    <span
                      style={{
                        ...S.pill,
                        background: `${PRIORITY_COLOR[t.priority]}16`,
                        color: PRIORITY_COLOR[t.priority],
                      }}
                    >
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                    <span
                      style={{
                        ...S.pill,
                        background: `${STATUS_COLOR[t.status]}16`,
                        color: STATUS_COLOR[t.status],
                      }}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                    {t.hasHistory && (
                      <button
                        style={S.iconBtn}
                        onClick={() => setHistoryTaskId(historyTaskId === t.id ? null : t.id)}
                        title="Ver histórico"
                      >
                        Histórico
                      </button>
                    )}
                    <button style={S.iconBtn} onClick={() => openEdit(t)}>
                      Editar
                    </button>
                    <button style={S.iconBtnDanger} onClick={() => remove(t.id)}>
                      Remover
                    </button>
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

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={{ ...S.modal, ...(isMobile ? S.modalMobile : null) }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={{ fontWeight: 700 }}>
                {editing ? 'Editar tarefa' : 'Nova tarefa'}
              </span>
              <button style={S.closeBtn} onClick={() => setModal(false)}>
                ×
              </button>
            </div>

            <div style={S.modalBody}>
              <Field label="Título">
                <input
                  style={S.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título da tarefa"
                />
              </Field>

              <Field label="Descrição">
                <textarea
                  style={{ ...S.input, minHeight: 88, resize: 'vertical' }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </Field>

              <div style={{ ...S.cols2, ...(isMobile ? S.colsMobile : null) }}>
                <Field label="Vencimento">
                  <input
                    type="datetime-local"
                    style={S.input}
                    value={form.dueAt}
                    onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                  />
                </Field>
                <Field label="Prioridade">
                  <select
                    style={S.input}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </Field>
              </div>

              <div style={{ ...S.cols2, ...(isMobile ? S.colsMobile : null) }}>
                <Field label="Status">
                  <select
                    style={S.input}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                  >
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="done">Concluída</option>
                  </select>
                </Field>
                <Field label="Projeto">
                  <select
                    style={S.input}
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  >
                    <option value="">Sem projeto</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={S.checkRow}>
                <label style={S.checkLabel}>
                  <input
                    type="checkbox"
                    checked={form.notifPush}
                    onChange={(e) => setForm({ ...form, notifPush: e.target.checked })}
                  />
                  Push
                </label>
                <label style={S.checkLabel}>
                  <input
                    type="checkbox"
                    checked={form.notifEmail}
                    onChange={(e) => setForm({ ...form, notifEmail: e.target.checked })}
                  />
                  E-mail
                </label>
              </div>
            </div>

            <div style={S.modalFoot}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button style={S.btnPrimary} onClick={save} disabled={saving || !form.title}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={S.fieldLabel}>{label}</label>
      {children}
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
    background: '#FBFCFD',
    border: '1px solid rgba(5,11,20,0.08)',
    borderRadius: 18,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0F172A',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    fontSize: 12,
    color: '#94A3B8',
    flexWrap: 'wrap',
  },
  checkBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1.5px solid #CBD5E1',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#64748B',
  },
  checkDone: {
    background: '#0F766E',
    border: '1.5px solid #0F766E',
    color: '#FFFFFF',
  },
  checkProgress: {
    background: '#1D4ED8',
    border: '1.5px solid #1D4ED8',
    color: '#FFFFFF',
  },
  tag: {
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  pill: {
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  editBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#8A6A2F',
    background: '#FBF4E4',
    border: '1px solid rgba(184,146,79,0.22)',
    padding: '3px 8px',
    borderRadius: 999,
  },
  iconBtn: {
    background: 'transparent',
    border: '1px solid rgba(5,11,20,0.08)',
    cursor: 'pointer',
    fontSize: 12,
    padding: '8px 10px',
    borderRadius: 999,
    color: '#475569',
    fontWeight: 700,
  },
  iconBtnDanger: {
    background: 'transparent',
    border: '1px solid rgba(153,27,27,0.12)',
    cursor: 'pointer',
    fontSize: 12,
    padding: '8px 10px',
    borderRadius: 999,
    color: '#991B1B',
    fontWeight: 700,
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
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5,11,20,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 18,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 24,
    width: 560,
    maxWidth: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 30px 70px rgba(5,11,20,0.22)',
  },
  modalMobile: {
    width: '100%',
    borderRadius: 20,
  },
  modalHead: {
    padding: '18px 22px',
    borderBottom: '1px solid #EDF1F4',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 16,
  },
  modalBody: {
    padding: '20px 22px',
  },
  modalFoot: {
    padding: '14px 22px',
    borderTop: '1px solid #EDF1F4',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 20,
    color: '#94A3B8',
    lineHeight: 1,
  },
  cols2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  colsMobile: {
    gridTemplateColumns: '1fr',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid rgba(5,11,20,0.1)',
    borderRadius: 14,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    color: '#050B14',
  },
  checkRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    cursor: 'pointer',
    color: '#334155',
  },
}
