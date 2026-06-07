'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'
import { projectStatus, STATUS_LABEL, STATUS_PILL_STYLE } from '@/lib/project-status'
import { TaskModal } from '@/components/TaskModal'
import type { ProjectForModal } from '@/components/TaskModal'
import { FolderKanban } from 'lucide-react'
import { Progress } from '@/components/ui/Progress'

type Project = {
  id: string
  name: string
  description?: string
  color: string
  emoji: string
  deadline?: string
  taskCount: number
  taskDone: number
  userId: string
  createdAt: string
}

type ProjectForm = {
  name: string
  description: string
  color: string
  emoji: string
  deadline: string
}

const EMOJIS = ['📁', '🚀', '💡', '🎯', '🛠', '📊', '🌟', '📝', '🔧', '🎨', '💼', '🏗']
const COLORS = [
  '#2F6FE0',
  '#7C3AED',
  '#22C55E',
  '#EF4444',
  '#F59E0B',
  '#0891B2',
  '#EC4899',
  '#64748B',
]
const EMPTY_FORM: ProjectForm = {
  name: '',
  description: '',
  color: '#2F6FE0',
  emoji: '📁',
  deadline: '',
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

function pad(n: number) { return String(n).padStart(2, '0') }

function toLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localDateToISO(value: string): string {
  const [y, mo, d] = value.split('-').map(Number)
  return new Date(y, mo - 1, d, 12, 0).toISOString()
}

export default function ProjetosPage() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const { data: projects = [] } = useSWR<Project[]>('/projects', fetcher)

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [taskModal, setTaskModal] = useState<{ open: boolean; projectId: string }>({
    open: false,
    projectId: '',
  })

  const projectsWithStats = projects.map((p) => ({
    ...p,
    taskCount: p.taskCount ?? 0,
    taskDone: p.taskDone ?? 0,
  }))

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
      deadline: p.deadline ? toLocalDate(new Date(p.deadline)) : '',
    })
    setModal(true)
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        ...form,
        deadline: form.deadline ? localDateToISO(form.deadline) : undefined,
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
  }

  return (
    <div>
      <section style={S.hero}>
        <div>
          <div style={S.eyebrow}>Projetos</div>
          <h1 style={S.title}>Frentes com progresso visível.</h1>
          <p style={S.sub}>
            {projects.length} projeto{projects.length !== 1 ? 's' : ''} ativo
            {projects.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <button style={S.btnPrimary} onClick={openNew}>
          Novo projeto
        </button>
      </section>

      {projects.length === 0 ? (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}><FolderKanban size={40} strokeWidth={1.5} color="var(--brand-400, #5B8FEA)" /></div>
          <div style={S.emptyTitle}>Nenhum projeto ainda</div>
          <div style={S.emptyText}>
            Crie projetos para organizar frentes, consolidar tarefas e acompanhar entregas.
          </div>
          <button style={S.btnPrimary} onClick={openNew}>
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <section style={S.projectsPanel}>
          <div style={S.panelHead}>
            <div>
              <div style={S.panelTitle}>Carteira de projetos</div>
              <div style={S.panelSub}>Clique em um projeto para ver o detalhe</div>
            </div>
          </div>
          <div style={S.grid}>
            {projectsWithStats.map((p) => {
              const progress = p.taskCount > 0 ? (p.taskDone / p.taskCount) * 100 : 0
              const st = projectStatus(p)

              return (
                <div
                  key={p.id}
                  style={{ ...S.card }}
                  onClick={() => router.push(`/projetos/${p.id}`)}
                >
                  <div style={{ ...S.cardBar, background: p.color }} />

                  <div style={S.cardHead}>
                    <div style={{ ...S.emojiBox, background: `${p.color}18`, color: p.color }}>
                      {p.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.cardName}>{p.name}</div>
                      {p.deadline && (
                        <div style={S.cardDeadline}>
                          Prazo: {new Date(p.deadline).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </div>
                      )}
                    </div>
                    <div style={S.cardActions} onClick={(e) => e.stopPropagation()}>
                      <button
                        style={S.iconBtn}
                        onClick={() => setTaskModal({ open: true, projectId: p.id })}
                      >
                        + Tarefa
                      </button>
                      <button style={S.iconBtn} onClick={() => openEdit(p)}>Editar</button>
                      <button style={S.iconBtnDanger} onClick={() => remove(p.id)}>Remover</button>
                    </div>
                  </div>

                  {p.description && <p style={S.cardDesc}>{p.description}</p>}

                  {/* Pill de status */}
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ ...S.pill, ...STATUS_PILL_STYLE[st] }}>
                      {STATUS_LABEL[st]}
                    </span>
                  </div>

                  <div style={S.progressRow}>
                    <Progress value={progress} tone="brand" style={{ flex: 1 }} />
                    <span style={S.progressLabel}>{Math.round(progress)}%</span>
                  </div>

                  <div style={S.cardMeta}>
                    <span>{p.taskDone}/{p.taskCount} tarefas concluídas</span>
                    <span>{p.taskCount} no total</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <TaskModal
        open={taskModal.open}
        onClose={() => setTaskModal({ open: false, projectId: '' })}
        onSaved={() => {
          mutate('/tasks')
          mutate('/projects')
        }}
        projects={projects as ProjectForModal[]}
        defaultProjectId={taskModal.projectId || undefined}
      />

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={{ ...S.modal, ...(isMobile ? S.modalMobile : null) }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span style={{ fontWeight: 700 }}>
                {editing ? 'Editar projeto' : 'Novo projeto'}
              </span>
              <button style={S.closeBtn} onClick={() => setModal(false)}>
                ×
              </button>
            </div>

            <div style={S.modalBody}>
              <Field label="Nome">
                <input
                  style={S.input}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome do projeto"
                />
              </Field>

              <Field label="Descrição">
                <textarea
                  style={{ ...S.input, minHeight: 80, resize: 'vertical' }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </Field>

              <Field label="Prazo">
                <input
                  type="date"
                  style={S.input}
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </Field>

              <Field label="Emoji">
                <div style={S.emojiGrid}>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      style={{
                        ...S.emojiBtn,
                        ...(form.emoji === emoji ? S.emojiBtnActive : {}),
                      }}
                      onClick={() => setForm({ ...form, emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Cor">
                <div style={S.colorRow}>
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      style={{
                        ...S.colorBtn,
                        background: color,
                        border: form.color === color ? '3px solid var(--brand-600, #1E4FA0)' : '3px solid transparent',
                      }}
                      onClick={() => setForm({ ...form, color })}
                    />
                  ))}
                </div>
              </Field>
            </div>

            <div style={S.modalFoot}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button style={S.btnPrimary} onClick={save} disabled={saving || !form.name}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
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
  btnGhost: {
    padding: '12px 18px',
    background: 'var(--bg-subtle, #FAFBFC)',
    color: 'var(--fg-2, #374151)',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '70px 24px',
    background: 'var(--bg, #FFFFFF)',
    borderRadius: 14,
    border: '1px solid var(--ink-200, #E5E7EB)',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'var(--brand-50, #F4F8FE)',
    margin: '0 auto 16px',
  },
  emptyTitle: {
    fontWeight: 600,
    fontSize: 17,
    color: 'var(--fg-1, #111827)',
    marginBottom: 8,
  },
  emptyText: {
    color: 'var(--fg-3, #6B7280)',
    fontSize: 14,
    marginBottom: 22,
    lineHeight: 1.7,
  },
  projectsPanel: {
    background: 'var(--bg, #FFFFFF)',
    borderRadius: 14,
    border: '1px solid var(--ink-200, #E5E7EB)',
    overflow: 'hidden',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 14,
    padding: 14,
  },
  card: {
    position: 'relative',
    background: 'var(--bg-subtle, #FAFBFC)',
    borderRadius: 12,
    border: '1px solid var(--ink-200, #E5E7EB)',
    padding: 18,
    cursor: 'pointer',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
  },
  cardBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 4,
  },
  cardHead: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  emojiBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  cardName: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.35,
    color: 'var(--fg-1, #111827)',
  },
  cardDeadline: {
    marginTop: 4,
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    fontFamily: 'var(--font-mono)',
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  cardDesc: {
    fontSize: 13,
    color: 'var(--fg-3, #6B7280)',
    marginBottom: 14,
    lineHeight: 1.6,
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    fontWeight: 600,
    flexShrink: 0,
    fontFamily: 'var(--font-mono)',
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    fontSize: 11,
    color: 'var(--fg-3, #6B7280)',
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 6,
  },
  iconBtn: {
    background: 'transparent',
    border: '1px solid var(--ink-200, #E5E7EB)',
    cursor: 'pointer',
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 8,
    color: 'var(--fg-2, #374151)',
    fontWeight: 500,
  },
  iconBtnDanger: {
    background: 'transparent',
    border: '1px solid rgba(220,38,38,0.2)',
    cursor: 'pointer',
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 8,
    color: '#DC2626',
    fontWeight: 500,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 18,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 20,
    width: 520,
    maxWidth: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 24px 48px rgba(11,15,20,.2)',
  },
  modalMobile: {
    width: '100%',
    borderRadius: 16,
  },
  modalHead: {
    padding: '18px 22px',
    borderBottom: '1px solid var(--ink-100, #F3F4F6)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--fg-1, #111827)',
  },
  modalBody: {
    padding: '20px 22px',
  },
  modalFoot: {
    padding: '14px 22px',
    borderTop: '1px solid var(--ink-100, #F3F4F6)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 20,
    color: 'var(--fg-3, #6B7280)',
    lineHeight: 1,
  },
  fieldLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--fg-3, #6B7280)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid var(--ink-200, #E5E7EB)',
    borderRadius: 10,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    color: 'var(--fg-1, #111827)',
  },
  emojiGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: '1px solid var(--ink-200, #E5E7EB)',
    background: 'var(--bg-subtle, #FAFBFC)',
    cursor: 'pointer',
    fontSize: 20,
  },
  emojiBtnActive: {
    background: 'var(--brand-50, #F4F8FE)',
    border: '2px solid var(--brand-500, #2F6FE0)',
  },
  colorRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorBtn: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    cursor: 'pointer',
  },
}
