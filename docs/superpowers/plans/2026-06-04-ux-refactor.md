# UX Refactor — URL, Task Cards, Task Creation in Projects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o prefixo `/dashboard/` das URLs, redesenhar os cards de tarefa com check contextual (Opção C), e adicionar criação de tarefa vinculada diretamente nas páginas de projetos.

**Architecture:** Quatro tasks sequenciais. Task 1 renomeia a pasta `dashboard/` para `(dashboard)/` usando Route Groups do Next.js — nenhuma página muda internamente, só os links. Task 2 extrai o modal de tarefa para `components/TaskModal.tsx` com suporte a `defaultProjectId`. Tasks 3 e 4 dependem das tasks anteriores. Todo trabalho na branch `dev`.

**Tech Stack:** Next.js 15 App Router (Route Groups), React 19, SWR, TypeScript, inline styles `S: Record<string, React.CSSProperties>`

---

## File Structure

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Renomear pasta | `app/dashboard/` → `app/(dashboard)/` | Remove `/dashboard/` da URL via Route Group |
| Modificar | `app/page.tsx` | Redirect `/dashboard` → `/` |
| Modificar | `app/login/page.tsx` | Redirect pós-login `/dashboard` → `/` |
| Modificar | `src/components/AppShell.tsx` | 8 links `/dashboard/*` → `/*` |
| Criar | `src/components/TaskModal.tsx` | Modal extraído com `defaultProjectId` |
| Modificar | `app/(dashboard)/tarefas/page.tsx` | Remove modal inline, usa TaskModal; redesign cards |
| Modificar | `app/(dashboard)/projetos/page.tsx` | Botão `+ Tarefa` por card |
| Modificar | `app/(dashboard)/projetos/[id]/page.tsx` | Botão `Nova tarefa` + TaskModal |

---

## Task 1: URL Restructure via Route Group

**Files:**
- Rename: `apps/web/src/app/dashboard/` → `apps/web/src/app/(dashboard)/`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/components/AppShell.tsx`

- [ ] **Renomear a pasta com git mv**

```bash
cd "apps/web/src/app"
git mv dashboard "(dashboard)"
```

Esperado: sem erros. A pasta agora é `app/(dashboard)/` com todos os arquivos intactos.

- [ ] **Atualizar `app/page.tsx`**

Substituir o arquivo inteiro:

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Home() {
  const store = await cookies()
  const token = store.get('orbit_token')
  if (token) redirect('/')
  redirect('/login')
}
```

Aguarda — o redirect para `/` causaria loop (a root page redireciona para ela mesma se logado). A home deve redirecionar para `/compromissos`:

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Home() {
  const store = await cookies()
  const token = store.get('orbit_token')
  if (token) redirect('/compromissos')
  redirect('/login')
}
```

- [ ] **Atualizar `app/login/page.tsx`**

Localizar linha 47: `router.push('/dashboard')` e substituir por:

```tsx
router.push('/compromissos')
```

- [ ] **Atualizar `src/components/AppShell.tsx` — array NAV**

Substituir as linhas 22-29 (array `NAV`):

```tsx
const NAV = [
  { href: '/', short: 'IN', label: 'Inicio' },
  { href: '/compromissos', short: 'CO', label: 'Compromissos' },
  { href: '/tarefas', short: 'TA', label: 'Tarefas' },
  { href: '/projetos', short: 'PR', label: 'Projetos' },
  { href: '/notificacoes', short: 'NO', label: 'Notificações' },
  { href: '/config', short: 'CF', label: 'Configurações' },
]
```

- [ ] **Atualizar `AppShell.tsx` — função `routeForNotification`**

Substituir as linhas 51-62:

```tsx
function routeForNotification(notification: Pick<Notification, 'entityType'>) {
  switch (notification.entityType) {
    case 'event':  return '/compromissos'
    case 'task':   return '/tarefas'
    case 'project':return '/projetos'
    default:       return '/notificacoes'
  }
}
```

- [ ] **Atualizar `AppShell.tsx` — router.push na sidebar bottom (linha 250)**

Substituir `router.push('/dashboard/config')` por `router.push('/config')` nas **duas** ocorrências (linha 250 e linha 387).

- [ ] **Atualizar `AppShell.tsx` — router.push no bell footer (linha 377)**

Substituir `router.push('/dashboard/notificacoes')` por `router.push('/notificacoes')`.

- [ ] **Verificar TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Verificar active state do nav**

O `AppShell` usa `pathname === item.href` para o item ativo. Com Route Groups, `usePathname()` retorna `/tarefas` (sem o `(dashboard)`), então o match continua correto.

- [ ] **Commit**

```bash
git add -A
git commit -m "refactor(orbit): remove /dashboard/ prefix via Next.js Route Group"
```

---

## Task 2: Extrair TaskModal como componente reutilizável

**Files:**
- Create: `apps/web/src/components/TaskModal.tsx`
- Modify: `apps/web/src/app/(dashboard)/tarefas/page.tsx`

- [ ] **Criar `src/components/TaskModal.tsx`**

```tsx
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
```

- [ ] **Atualizar `tarefas/page.tsx` — remover modal inline e usar TaskModal**

No topo do arquivo, adicionar import:

```tsx
import { TaskModal } from '@/components/TaskModal'
import type { TaskForModal, ProjectForModal } from '@/components/TaskModal'
```

Remover o type local `TaskForm` e as funções `pad`, `toDatetimeLocal`, `localInputToISO` (agora vivem em `TaskModal.tsx`).

Remover os states `modal`, `form`, `saving` e as funções `openNew`, `openEdit`, `save` do componente.

Adicionar em seu lugar:

```tsx
const [taskModal, setTaskModal] = useState<{ open: boolean; editing: TaskForModal | null }>({
  open: false,
  editing: null,
})

function openNew() {
  setTaskModal({ open: true, editing: null })
}

function openEdit(t: Task) {
  setTaskModal({ open: true, editing: t })
}
```

Substituir o bloco `{modal && ( ... )}` no JSX pelo componente:

```tsx
<TaskModal
  open={taskModal.open}
  onClose={() => setTaskModal({ open: false, editing: null })}
  onSaved={() => mutate(tasksKey)}
  editing={taskModal.editing}
  projects={projects as ProjectForModal[]}
/>
```

Remover o componente `Field` e a função `MetricCard` do `tarefas/page.tsx` — `Field` vive agora em `TaskModal.tsx`. `MetricCard` pode ficar (só é usado nessa página).

Remover do objeto `S` os estilos de modal: `overlay`, `modal`, `modalMobile`, `modalHead`, `modalBody`, `modalFoot`, `closeBtn`, `fieldLabel`, `input`, `cols2`, `colsMobile`, `checkRow`, `checkLabel`.

- [ ] **Verificar TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Commit**

```bash
git add apps/web/src/components/TaskModal.tsx apps/web/src/app/\(dashboard\)/tarefas/page.tsx
git commit -m "refactor(orbit): extract TaskModal as reusable component with defaultProjectId"
```

---

## Task 3: Redesign dos cards de tarefa (Opção C)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/tarefas/page.tsx`

- [ ] **Adicionar constantes de check label após as constantes existentes**

Após `STATUS_COLOR`, adicionar:

```tsx
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
```

- [ ] **Substituir o bloco de renderização de cada task**

Localizar o `{filtered.map((t) => {` dentro de `<div style={S.list}>` e substituir todo o bloco de renderização do card (que atualmente usa `S.card`, `S.cardLeft`, `S.cardRight`) pelo novo design:

```tsx
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
```

- [ ] **Atualizar o objeto `S` — substituir estilos do card**

Remover: `cardLeft`, `cardRight`, `checkBtn`, `checkDone`, `checkProgress`, `cardTitleRow` (dentro do card — não confundir com outros possíveis usos), `pill`, `cardMeta`, `cardDate` (se existir com outro nome).

Adicionar/substituir:

```tsx
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(5,11,20,0.08)',
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
    fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  cardTitleRow: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.3,
  },
  cardTags: {
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const,
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
  actionSep: { color: '#E2E8F0', fontSize: 14, userSelect: 'none' as const },
  editBadge: {
    fontSize: 10, fontWeight: 700, color: '#8A6A2F',
    background: '#FBF4E4', border: '1px solid rgba(184,146,79,0.24)',
    padding: '3px 7px', borderRadius: 999,
  },
```

- [ ] **Verificar TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Commit**

```bash
git add apps/web/src/app/\(dashboard\)/tarefas/page.tsx
git commit -m "feat(orbit): redesign task cards with contextual check button (Option C)"
```

---

## Task 4: Criação de tarefa vinculada nas páginas de projetos

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projetos/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/projetos/[id]/page.tsx`

### 4a — Botão `+ Tarefa` nos cards da grade

- [ ] **Adicionar import de TaskModal em `projetos/page.tsx`**

Após os imports existentes:

```tsx
import { TaskModal } from '@/components/TaskModal'
import type { ProjectForModal } from '@/components/TaskModal'
```

- [ ] **Adicionar state para o modal de tarefa**

Após `const [saving, setSaving] = useState(false)`:

```tsx
const [taskModal, setTaskModal] = useState<{ open: boolean; projectId: string }>({
  open: false,
  projectId: '',
})
```

- [ ] **Adicionar botão `+ Tarefa` no `cardActions` de cada card**

Dentro de `<div style={S.cardActions} onClick={(e) => e.stopPropagation()}>`, adicionar antes do botão "Editar":

```tsx
<button
  style={S.iconBtn}
  onClick={() => setTaskModal({ open: true, projectId: p.id })}
>
  + Tarefa
</button>
```

- [ ] **Adicionar `<TaskModal>` no JSX antes do fechamento do return**

Antes do `{modal && (` existente (modal de projeto), adicionar:

```tsx
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
```

- [ ] **Verificar TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

### 4b — Botão `Nova tarefa` na página de detalhe

- [ ] **Adicionar imports em `projetos/[id]/page.tsx`**

```tsx
import { TaskModal } from '@/components/TaskModal'
import type { ProjectForModal } from '@/components/TaskModal'
```

- [ ] **Adicionar SWR de projetos e state do modal**

Após `const { data: tasks = [], isLoading: tasksLoading }`:

```tsx
const { data: allProjects = [] } = useSWR<ProjectForModal[]>('/projects', fetcher)
const [taskModalOpen, setTaskModalOpen] = useState(false)
```

- [ ] **Adicionar botão `Nova tarefa` no `tasksPanelHead`**

Localizar `<div style={S.tasksPanelHead}>` e adicionar botão ao lado do título:

```tsx
<div style={S.tasksPanelHead}>
  <div style={S.panelTitle}>Tarefas</div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
    <button
      style={{
        padding: '6px 14px', background: 'linear-gradient(135deg, #050B14 0%, #101C2B 100%)',
        color: '#F5F2EC', border: 'none', borderRadius: 10,
        fontWeight: 700, fontSize: 12, cursor: 'pointer',
      }}
      onClick={() => setTaskModalOpen(true)}
    >
      + Nova tarefa
    </button>
    <div style={S.tabs}>
      {/* tabs existentes sem mudança */}
    </div>
  </div>
</div>
```

- [ ] **Adicionar `<TaskModal>` no final do return, antes do fechamento `</div>`**

```tsx
<TaskModal
  open={taskModalOpen}
  onClose={() => setTaskModalOpen(false)}
  onSaved={() => {
    mutate(`/tasks?projectId=${id}`)
    mutate(`/projects/${id}`)
    mutate('/projects')
  }}
  projects={allProjects}
  defaultProjectId={id}
/>
```

- [ ] **Verificar TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add apps/web/src/app/\(dashboard\)/projetos/page.tsx apps/web/src/app/\(dashboard\)/projetos/\[id\]/page.tsx
git commit -m "feat(orbit): add quick task creation from project cards and detail page"
```

---

## Verificação final end-to-end

- [ ] `/tarefas`, `/projetos`, `/compromissos`, `/config`, `/notificacoes` carregam sem `/dashboard/`
- [ ] `/` com login ativo → redireciona para `/compromissos`
- [ ] `/login` após submit → redireciona para `/compromissos`
- [ ] Nav sidebar marca item ativo corretamente
- [ ] Notificação clicada → navega para `/tarefas`, `/projetos` ou `/compromissos` (sem `/dashboard/`)
- [ ] Card de tarefa: botão check 32px com label abaixo (`INICIAR` / `CONCLUIR` / `REABRIR`)
- [ ] Card concluído: opacity 55%, label `REABRIR` em verde
- [ ] Rodapé do card: status em cor à esquerda, `Editar · Remover` à direita
- [ ] Clicar `+ Tarefa` no card de projeto: modal abre com projeto pré-vinculado e campo readonly
- [ ] Criar tarefa via card de projeto: aparece na lista de tarefas
- [ ] Clicar `+ Nova tarefa` na página de detalhe: mesmo comportamento
- [ ] Modal de edição de tarefa (em `/tarefas`) continua funcionando normalmente
