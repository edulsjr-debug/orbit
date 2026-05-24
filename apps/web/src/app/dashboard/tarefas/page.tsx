'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'

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
  project?: { id: string; name: string; color: string }
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

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }
const PRIORITY_COLOR: Record<Priority, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const STATUS_LABEL: Record<Status, string> = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída' }
const STATUS_COLOR: Record<Status, string> = { pending: '#64748b', in_progress: '#6366f1', done: '#10b981' }

const EMPTY_FORM: TaskForm = {
  title: '', description: '', dueAt: '', priority: 'medium',
  status: 'pending', projectId: '', notifPush: true, notifEmail: false,
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

export default function TarefasPage() {
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
      dueAt: t.dueAt ? t.dueAt.slice(0, 16) : '',
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
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
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
    const next: Status = t.status === 'done' ? 'pending' : t.status === 'pending' ? 'in_progress' : 'done'
    await api.patch(`/tasks/${t.id}`, { status: next })
    mutate('/tasks')
  }

  return (
    <div>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Tarefas</h2>
          <p style={S.sub}>{tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} no total</p>
        </div>
        <button style={S.btn} onClick={openNew}>+ Nova tarefa</button>
      </div>

      <div style={S.filters}>
        {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
          <button
            key={f}
            style={{ ...S.filter, ...(filter === f ? S.filterActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todas' : STATUS_LABEL[f as Status]}
            <span style={S.badge}>{counts[f]}</span>
          </button>
        ))}
      </div>

      <div style={S.list}>
        {filtered.length === 0 && <div style={S.empty}>Nenhuma tarefa aqui</div>}
        {filtered.map((t) => (
          <div key={t.id} style={{ ...S.card, opacity: t.status === 'done' ? 0.65 : 1 }}>
            <div style={S.cardLeft}>
              <button
                style={{ ...S.checkBtn, ...(t.status === 'done' ? S.checkDone : t.status === 'in_progress' ? S.checkProgress : {}) }}
                onClick={() => toggleStatus(t)}
              >
                {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '◑' : '○'}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...S.cardTitle, ...(t.status === 'done' ? { textDecoration: 'line-through', color: '#94a3b8' } : {}) }}>
                    {t.title}
                  </span>
                  {t.hasHistory && <span style={S.editBadge}>✏ editada</span>}
                </div>
                <div style={S.cardMeta}>
                  {t.dueAt && (
                    <span style={{ color: new Date(t.dueAt) < new Date() && t.status !== 'done' ? '#ef4444' : '#94a3b8' }}>
                      📅 {new Date(t.dueAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {t.project && (
                    <span style={{ ...S.tag, background: t.project.color + '22', color: t.project.color }}>
                      📁 {t.project.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={S.cardRight}>
              <span style={{ ...S.pill, background: PRIORITY_COLOR[t.priority] + '22', color: PRIORITY_COLOR[t.priority] }}>
                {PRIORITY_LABEL[t.priority]}
              </span>
              <span style={{ ...S.pill, background: STATUS_COLOR[t.status] + '22', color: STATUS_COLOR[t.status] }}>
                {STATUS_LABEL[t.status]}
              </span>
              {t.hasHistory && (
                <button
                  style={S.iconBtn}
                  onClick={() => setHistoryTaskId(historyTaskId === t.id ? null : t.id)}
                  title="Ver histórico"
                >📋</button>
              )}
              <button style={S.iconBtn} onClick={() => openEdit(t)}>✏️</button>
              <button style={S.iconBtn} onClick={() => remove(t.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {historyTaskId && (
        <div style={S.historyBox}>
          <div style={S.historyTitle}>
            Histórico — {tasks.find((t) => t.id === historyTaskId)?.title}
            <button style={{ ...S.iconBtn, marginLeft: 8 }} onClick={() => setHistoryTaskId(null)}>✕</button>
          </div>
          {history.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>Sem alterações registradas</div>}
          {history.map((h: any) => (
            <div key={h.id} style={S.historyItem}>
              <div style={S.historyDot} />
              <span style={{ color: '#64748b', fontSize: 12 }}>{new Date(h.createdAt).toLocaleString('pt-BR')}</span>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{h.field}</span>
              <span style={{ fontSize: 12, color: '#ef4444' }}>{h.oldValue || '(vazio)'}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>→</span>
              <span style={{ fontSize: 12, color: '#10b981' }}>{h.newValue || '(vazio)'}</span>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={{ fontWeight: 700 }}>{editing ? 'Editar tarefa' : 'Nova tarefa'}</span>
              <button style={S.closeBtn} onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <Field label="Título">
                <input style={S.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título da tarefa" />
              </Field>
              <Field label="Descrição">
                <textarea style={{ ...S.input, minHeight: 72, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição (opcional)" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Vencimento">
                  <input type="datetime-local" style={S.input} value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
                </Field>
                <Field label="Prioridade">
                  <select style={S.input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Status">
                  <select style={S.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="done">Concluída</option>
                  </select>
                </Field>
                <Field label="Projeto">
                  <select style={S.input} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    <option value="">Sem projeto</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                  </select>
                </Field>
              </div>
              <div style={S.checkRow}>
                <label style={S.checkLabel}><input type="checkbox" checked={form.notifPush} onChange={(e) => setForm({ ...form, notifPush: e.target.checked })} /> Push</label>
                <label style={S.checkLabel}><input type="checkbox" checked={form.notifEmail} onChange={(e) => setForm({ ...form, notifEmail: e.target.checked })} /> E-mail</label>
              </div>
            </div>
            <div style={S.modalFoot}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancelar</button>
              <button style={S.btn} onClick={save} disabled={saving || !form.title}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</label>
      {children}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 800 },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  btn: { padding: '9px 18px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnGhost: { padding: '9px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  filters: { display: 'flex', gap: 8, marginBottom: 16 },
  filter: { padding: '7px 14px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 },
  filterActive: { background: '#eef2ff', borderColor: '#6366f1', color: '#4338ca', fontWeight: 700 },
  badge: { background: '#e2e8f0', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  card: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: 600 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 12, color: '#94a3b8' },
  checkBtn: { width: 26, height: 26, borderRadius: '50%', border: '2px solid #cbd5e1', background: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkDone: { background: '#10b981', border: '2px solid #10b981', color: '#fff' },
  checkProgress: { background: '#6366f1', border: '2px solid #6366f1', color: '#fff' },
  tag: { padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  pill: { padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  editBadge: { fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: 10 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 },
  historyBox: { background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 },
  historyTitle: { fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center' },
  historyItem: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  historyDot: { width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 18, width: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,.2)' },
  modalHead: { padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16 },
  modalBody: { padding: '20px 22px' },
  modalFoot: { padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8' },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  checkRow: { display: 'flex', gap: 16 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' },
}
