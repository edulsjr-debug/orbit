'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'

type Project = {
  id: string
  name: string
  description?: string
  color: string
  emoji: string
  deadline?: string
  userId: string
  createdAt: string
}

type Task = { id: string; title: string; status: string; priority: string; dueAt?: string; projectId?: string }

type ProjectForm = {
  name: string
  description: string
  color: string
  emoji: string
  deadline: string
}

const EMOJIS = ['📁', '🚀', '💡', '🎯', '🛠', '📊', '🌟', '📝', '🔧', '🎨', '💼', '🏗']
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16']
const EMPTY_FORM: ProjectForm = { name: '', description: '', color: '#6366f1', emoji: '📁', deadline: '' }
const PRIORITY_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

export default function ProjetosPage() {
  const { data: projects = [] } = useSWR<Project[]>('/projects', fetcher)
  const { data: tasks = [] } = useSWR<Task[]>('/tasks', fetcher)

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Project | null>(null)

  const projectsWithStats = projects.map((p) => {
    const ptasks = tasks.filter((t) => t.projectId === p.id)
    const done = ptasks.filter((t) => t.status === 'done').length
    return { ...p, taskCount: ptasks.length, taskDone: done, ptasks }
  })

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  function openEdit(p: Project) {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description ?? '',
      color: p.color,
      emoji: p.emoji,
      deadline: p.deadline ? p.deadline.slice(0, 10) : '',
    })
    setModal(true)
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        ...form,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      }
      if (editing) {
        await api.patch(`/projects/${editing.id}`, body)
      } else {
        await api.post('/projects', body)
      }
      mutate('/projects')
      setModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover este projeto? As tarefas vinculadas ficarão sem projeto.')) return
    await api.delete(`/projects/${id}`)
    mutate('/projects')
    mutate('/tasks')
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Projetos</h2>
          <p style={S.sub}>{projects.length} projeto{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={S.btn} onClick={openNew}>+ Novo projeto</button>
      </div>

      {projects.length === 0 ? (
        <div style={S.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Nenhum projeto ainda</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Crie projetos para organizar suas tarefas</div>
          <button style={S.btn} onClick={openNew}>Criar primeiro projeto</button>
        </div>
      ) : (
        <div style={S.grid}>
          {projectsWithStats.map((p) => (
            <div
              key={p.id}
              style={{
                ...S.card,
                borderTop: `4px solid ${p.color}`,
                ...(selected?.id === p.id ? { boxShadow: `0 0 0 2px ${p.color}` } : {}),
              }}
              onClick={() => setSelected(selected?.id === p.id ? null : p)}
            >
              <div style={S.cardHead}>
                <div style={{ ...S.emojiBox, background: p.color + '22' }}>{p.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.cardName}>{p.name}</div>
                  {p.deadline && (
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      prazo: {new Date(p.deadline).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button style={S.iconBtn} onClick={() => openEdit(p)}>✏️</button>
                  <button style={S.iconBtn} onClick={() => remove(p.id)}>🗑</button>
                </div>
              </div>
              {p.description && <p style={S.cardDesc}>{p.description}</p>}
              <div style={S.progressRow}>
                <div style={S.progressTrack}>
                  <div style={{
                    height: '100%',
                    background: p.color,
                    borderRadius: 4,
                    width: `${p.taskCount > 0 ? (p.taskDone / p.taskCount) * 100 : 0}%`,
                    transition: 'width .3s',
                  }} />
                </div>
                <span style={S.progressLabel}>{p.taskDone}/{p.taskCount} tarefas</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (() => {
        const pw = projectsWithStats.find((p) => p.id === selected.id)
        if (!pw) return null
        return (
          <div style={S.taskPanel}>
            <div style={S.taskPanelHead}>
              <span style={{ fontWeight: 700 }}>{pw.emoji} {pw.name} — Tarefas</span>
              <button style={S.iconBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            {pw.ptasks.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Nenhuma tarefa neste projeto</div>
            ) : pw.ptasks.map((t) => (
              <div key={t.id} style={S.taskRow}>
                <span style={{ fontSize: 16 }}>{t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜'}</span>
                <span style={{ flex: 1, fontSize: 13, ...(t.status === 'done' ? { textDecoration: 'line-through', color: '#94a3b8' } : {}) }}>{t.title}</span>
                <span style={{ fontSize: 11, color: PRIORITY_COLOR[t.priority] ?? '#64748b', fontWeight: 700 }}>{t.priority.toUpperCase()}</span>
                {t.dueAt && <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(t.dueAt).toLocaleDateString('pt-BR')}</span>}
              </div>
            ))}
          </div>
        )
      })()}

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={{ fontWeight: 700 }}>{editing ? 'Editar projeto' : 'Novo projeto'}</span>
              <button style={S.closeBtn} onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <Field label="Nome">
                <input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do projeto" />
              </Field>
              <Field label="Descrição">
                <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição (opcional)" />
              </Field>
              <Field label="Prazo">
                <input type="date" style={S.input} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </Field>
              <Field label="Emoji">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EMOJIS.map((e) => (
                    <button key={e} style={{ ...S.emojiBtn, ...(form.emoji === e ? { background: '#eef2ff', border: '2px solid #6366f1' } : {}) }} onClick={() => setForm({ ...form, emoji: e })}>{e}</button>
                  ))}
                </div>
              </Field>
              <Field label="Cor">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {COLORS.map((c) => (
                    <button key={c} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #0f172a' : '3px solid transparent', cursor: 'pointer' }} onClick={() => setForm({ ...form, color: c })} />
                  ))}
                </div>
              </Field>
            </div>
            <div style={S.modalFoot}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancelar</button>
              <button style={S.btn} onClick={save} disabled={saving || !form.name}>{saving ? 'Salvando...' : 'Salvar'}</button>
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
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 },
  card: { background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 18, cursor: 'pointer', transition: 'box-shadow .2s' },
  cardHead: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  emojiBox: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  cardName: { fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
  cardDesc: { fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 },
  progressRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  progressTrack: { flex: 1, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressLabel: { fontSize: 11, color: '#94a3b8', flexShrink: 0 },
  taskPanel: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, marginTop: 20 },
  taskPanelHead: { padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 14 },
  taskRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid #f8fafc' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 4 },
  emojiBtn: { width: 36, height: 36, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 20 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 18, width: 500, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,.2)' },
  modalHead: { padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16 },
  modalBody: { padding: '20px 22px' },
  modalFoot: { padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8' },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
}
