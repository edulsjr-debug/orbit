'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'

type Priority = 'low' | 'medium' | 'high'
type Status = 'pending' | 'in_progress' | 'done'

export type TaskForModal = {
  id: string
  title: string
  description?: string
  dueAt?: string
  priority: Priority
  status: Status
  projectId?: string
  notifPush: boolean
  notifEmail: boolean
}

export type ProjectForModal = { id: string; name: string; emoji: string; color: string }

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

export interface TaskModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editing?: TaskForModal | null
  projects: ProjectForModal[]
  defaultProjectId?: string
}

const EMPTY_FORM: TaskForm = {
  title: '', description: '', dueAt: '',
  priority: 'medium', status: 'pending',
  projectId: '', notifPush: true, notifEmail: false,
}

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

export function TaskModal({ open, onClose, onSaved, editing, projects, defaultProjectId }: TaskModalProps) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? '',
        dueAt: editing.dueAt ? toDatetimeLocal(new Date(editing.dueAt)) : '',
        priority: editing.priority,
        status: editing.status,
        projectId: editing.projectId ?? '',
        notifPush: editing.notifPush,
        notifEmail: editing.notifEmail,
      })
    } else {
      setForm({ ...EMPTY_FORM, projectId: defaultProjectId ?? '' })
    }
  }, [open, editing, defaultProjectId])

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
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const lockedProject = defaultProjectId && !editing
    ? projects.find((p) => p.id === defaultProjectId)
    : null

  return (
    <div style={S.overlay} onClick={onClose}>
      <div
        style={{ ...S.modal, ...(isMobile ? S.modalMobile : null) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={S.modalHead}>
          <span style={{ fontWeight: 700 }}>{editing ? 'Editar tarefa' : 'Nova tarefa'}</span>
          <button style={S.closeBtn} onClick={onClose}>×</button>
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
              {lockedProject ? (
                <div style={{ ...S.input, display: 'flex', alignItems: 'center', gap: 6, color: '#475569', cursor: 'default' }}>
                  <span>{lockedProject.emoji}</span>
                  <span>{lockedProject.name}</span>
                </div>
              ) : (
                <select
                  style={S.input}
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                >
                  <option value="">Sem projeto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                  ))}
                </select>
              )}
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
          <button style={S.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} onClick={save} disabled={saving || !form.title}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
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
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(5,11,20,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 18,
  },
  modal: {
    background: '#FFFFFF', borderRadius: 24, width: 520,
    maxWidth: '100%', maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 30px 70px rgba(5,11,20,0.22)',
  },
  modalMobile: { width: '100%', borderRadius: 20 },
  modalHead: {
    padding: '18px 22px', borderBottom: '1px solid #EDF1F4',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16,
  },
  modalBody: { padding: '20px 22px' },
  modalFoot: {
    padding: '14px 22px', borderTop: '1px solid #EDF1F4',
    display: 'flex', justifyContent: 'flex-end', gap: 10,
  },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', lineHeight: 1 },
  fieldLabel: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#475569',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  input: {
    width: '100%', padding: '12px 14px', border: '1px solid rgba(5,11,20,0.1)',
    borderRadius: 14, fontSize: 13, outline: 'none', boxSizing: 'border-box',
    background: '#FFFFFF', color: '#050B14',
  },
  cols2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  colsMobile: { gridTemplateColumns: '1fr' },
  checkRow: { display: 'flex', gap: 18, alignItems: 'center' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' },
  btnPrimary: {
    padding: '12px 18px', background: 'linear-gradient(135deg, #050B14 0%, #101C2B 100%)',
    color: '#F5F2EC', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  btnGhost: {
    padding: '12px 18px', background: '#F4F6F8', color: '#475569',
    border: '1px solid rgba(5,11,20,0.08)', borderRadius: 14, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
}
