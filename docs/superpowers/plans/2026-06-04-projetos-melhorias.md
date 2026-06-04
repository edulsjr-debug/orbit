# Melhorias de Projetos — Orbit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar status automático nos cards de projeto, página de detalhe por projeto, e filtro de projetos na página de tarefas — tudo no frontend, sem alterações no backend.

**Architecture:** Três modificações de arquivo + uma nova rota. O helper `projectStatus` centraliza a lógica de status para ser reutilizado nos cards e na página de detalhe. A página de detalhe carrega dados via dois SWR em paralelo (`/projects/:id` + `/tasks?projectId=:id`). O filtro de projeto na página de tarefas adiciona um `<select>` que ajusta a chave SWR de `/tasks` para `/tasks?projectId=xxx`.

**Tech Stack:** Next.js 15 App Router, React 19, SWR, TypeScript, inline styles (padrão `S: Record<string, React.CSSProperties>`)

---

## File Structure

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `apps/web/src/lib/project-status.ts` | Helper puro `projectStatus` + constantes de estilo de pill |
| Modificar | `apps/web/src/app/dashboard/projetos/page.tsx` | Adicionar pill de status nos cards + navegar para `[id]` ao clicar |
| Criar | `apps/web/src/app/dashboard/projetos/[id]/page.tsx` | Página de detalhe: hero, métricas, progress, lista de tarefas |
| Modificar | `apps/web/src/app/dashboard/tarefas/page.tsx` | Dropdown de projeto na barra de filtros |

---

## Task 1: Helper `projectStatus`

**Files:**
- Create: `apps/web/src/lib/project-status.ts`

- [ ] **Criar o arquivo**

```ts
// apps/web/src/lib/project-status.ts
import type { CSSProperties } from 'react'

export type ProjectStatusKey = 'concluido' | 'atrasado' | 'no_prazo' | 'sem_prazo'

export interface ProjectForStatus {
  taskCount: number
  taskDone: number
  deadline?: string
}

export function projectStatus(p: ProjectForStatus): ProjectStatusKey {
  if (p.taskCount > 0 && p.taskDone === p.taskCount) return 'concluido'
  if (!p.deadline) return 'sem_prazo'
  if (new Date(p.deadline) < new Date()) return 'atrasado'
  return 'no_prazo'
}

export const STATUS_LABEL: Record<ProjectStatusKey, string> = {
  concluido: '● Concluído',
  atrasado:  '⚠ Atrasado',
  no_prazo:  '✓ No prazo',
  sem_prazo: '',
}

export const STATUS_PILL_STYLE: Record<ProjectStatusKey, CSSProperties> = {
  concluido: {
    background: 'rgba(99,102,241,.10)',
    color: '#6366f1',
    border: '1px solid rgba(99,102,241,.18)',
  },
  atrasado: {
    background: 'rgba(153,27,27,.10)',
    color: '#991B1B',
    border: '1px solid rgba(153,27,27,.18)',
  },
  no_prazo: {
    background: 'rgba(15,118,110,.10)',
    color: '#0F766E',
    border: '1px solid rgba(15,118,110,.18)',
  },
  sem_prazo: { display: 'none' },
}
```

- [ ] **Verificar sem erros de TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem output (zero erros).

- [ ] **Commit**

```bash
git add apps/web/src/lib/project-status.ts
git commit -m "feat(orbit): add projectStatus helper with pill styles"
```

---

## Task 2: Pill de status nos cards de projeto + navegação para detalhe

**Files:**
- Modify: `apps/web/src/app/dashboard/projetos/page.tsx`

O card já tem `cardBar` (faixa colorida no topo), barra de progresso com `p.color`, e porcentagem — esses elementos não mudam. O que muda é: (a) adicionar o pill de status no canto do card, (b) clicar no card navega para `/dashboard/projetos/[id]` em vez de selecionar o side panel.

- [ ] **Adicionar import do helper e de `useRouter` no topo do arquivo**

Localizar as linhas de import no início (linhas 1-6) e substituir por:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'
import { projectStatus, STATUS_LABEL, STATUS_PILL_STYLE } from '@/lib/project-status'
```

- [ ] **Remover o estado `selected` e o hook SWR de `/tasks` da página de projetos**

Remover as linhas:
```tsx
const { data: tasks = [] } = useSWR<Task[]>('/tasks', fetcher)
```
e
```tsx
const [selected, setSelected] = useState<Project | null>(null)
```
e o bloco `projectsWithStats` que usa `tasks`. Substituir por versão simples que não precisa das tasks:

```tsx
const router = useRouter()

const projectsWithStats = projects.map((p) => {
  // taskCount e taskDone já vêm da API em /projects
  const pAny = p as any
  return {
    ...p,
    taskCount: pAny.taskCount ?? 0,
    taskDone: pAny.taskDone ?? 0,
  }
})
```

> **Nota:** O endpoint `GET /projects` já retorna `taskCount` e `taskDone` calculados pelo Prisma. Apenas o type local `Project` não os declara. O cast `as any` evita alterar o type global — pode ser tipado localmente se preferir.

- [ ] **Atualizar o type local `Project` para incluir taskCount e taskDone**

Substituir o type `Project` no início do arquivo:

```tsx
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
```

E remover o type `Task` e o `projectsWithStats` complicado. A versão simples fica:

```tsx
const projectsWithStats = projects.map((p) => ({
  ...p,
  taskCount: p.taskCount ?? 0,
  taskDone: p.taskDone ?? 0,
}))
```

- [ ] **Adicionar pill de status no card e mudar onClick para navegação**

Localizar o bloco do card (em torno da linha 181–233). O `onClick` atual chama `setSelected`. Substituir o card inteiro pelo código abaixo — mantém todos os estilos `S.*` existentes, adiciona o pill e muda a navegação:

```tsx
{projectsWithStats.map((p) => {
  const progress = p.taskCount > 0 ? (p.taskDone / p.taskCount) * 100 : 0
  const st = projectStatus(p)

  return (
    <div
      key={p.id}
      style={{ ...S.card }}
      onClick={() => router.push(`/dashboard/projetos/${p.id}`)}
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
        <div style={S.progressTrack}>
          <div style={{ ...S.progressFill, background: p.color, width: `${progress}%` }} />
        </div>
        <span style={S.progressLabel}>{Math.round(progress)}%</span>
      </div>

      <div style={S.cardMeta}>
        <span>{p.taskDone}/{p.taskCount} tarefas concluídas</span>
        <span>{p.taskCount} no total</span>
      </div>
    </div>
  )
})}
```

- [ ] **Adicionar estilo `pill` no objeto `S`**

No final do objeto `S`, antes do fechamento `}`, adicionar:

```tsx
  pill: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 999,
  },
```

- [ ] **Remover o `<aside style={S.sidePanel}>` inteiro**

O aside (side panel de tarefas) e o `mainGrid` podem ser simplificados. O layout agora não precisa do grid com aside. Substituir o wrapper de grid:

```tsx
// Antes: <div style={{ ...S.mainGrid, ...(isMobile ? S.mainGridMobile : null) }}>
// Depois: apenas a section de projetos, sem aside

<section style={S.projectsPanel}>
  <div style={S.panelHead}>
    <div>
      <div style={S.panelTitle}>Carteira de projetos</div>
      <div style={S.panelSub}>Clique em um projeto para ver o detalhe</div>
    </div>
  </div>
  <div style={S.grid}>
    {/* cards aqui */}
  </div>
</section>
```

- [ ] **Remover funções e states que não são mais usados**

Remover:
- `const [selected, setSelected] = useState<Project | null>(null)` — já removido acima
- Referências a `selected` no `remove()` — remover a linha `if (selected?.id === id) setSelected(null)`
- O type `Task` local (linha 19–26) — não mais necessário aqui

- [ ] **Verificar sem erros de TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Verificar visualmente**

Iniciar o app (`pnpm dev` na raiz) e abrir `/dashboard/projetos`. Verificar:
- Cards mostram pill de status no canto (verde / vermelho / índigo conforme deadline e progresso)
- Projetos sem deadline não mostram pill
- Clicar no card navega para `/dashboard/projetos/[id]` (vai dar 404 até a Task 3)
- Botões Editar/Remover ainda funcionam (stopPropagation)

- [ ] **Commit**

```bash
git add apps/web/src/app/dashboard/projetos/page.tsx
git commit -m "feat(orbit): add status pill to project cards and navigate to detail"
```

---

## Task 3: Página de detalhe do projeto

**Files:**
- Create: `apps/web/src/app/dashboard/projetos/[id]/page.tsx`

- [ ] **Criar o diretório e o arquivo**

```bash
mkdir -p "apps/web/src/app/dashboard/projetos/[id]"
```

- [ ] **Criar a página completa**

```tsx
// apps/web/src/app/dashboard/projetos/[id]/page.tsx
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'
import { projectStatus, STATUS_LABEL, STATUS_PILL_STYLE } from '@/lib/project-status'

type Project = {
  id: string
  name: string
  description?: string
  color: string
  emoji: string
  deadline?: string
  // GET /projects/:id não retorna taskCount/taskDone — calculamos a partir de tasks abaixo
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
  low: '#0F766E', medium: '#B8924F', high: '#991B1B',
}
const STATUS_LABEL_TASK: Record<TaskStatus, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída',
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: project } = useSWR<Project>(`/projects/${id}`, fetcher)
  const { data: tasks = [] } = useSWR<Task[]>(`/tasks?projectId=${id}`, fetcher)

  const [taskFilter, setTaskFilter] = useState<'all' | TaskStatus>('all')

  if (!project) {
    return <div style={S.loading}>Carregando...</div>
  }

  // GET /projects/:id traz tasks embarcadas mas não pré-calcula counts —
  // usamos o array tasks do SWR separado (que fica em sync com toggleStatus)
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
    await api.patch(`/tasks/${t.id}`, { status: next })
    mutate(`/tasks?projectId=${id}`)
    mutate(`/projects/${id}`)
    mutate('/projects')
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <button style={S.breadcrumbLink} onClick={() => router.push('/dashboard/projetos')}>
          Projetos
        </button>
        <span style={S.breadcrumbSep}>/</span>
        <span style={S.breadcrumbCurrent}>{project.emoji} {project.name}</span>
      </div>

      {/* Hero */}
      <section style={{ ...S.hero, borderTop: `4px solid ${project.color}` }}>
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
            <div style={S.progressSub}>{project.taskDone} de {project.taskCount} tarefas concluídas</div>
          </div>
          <div style={{ ...S.pctBig, color: project.color }}>{Math.round(progress)}%</div>
        </div>
        <div style={S.progressTrack}>
          <div style={{ ...S.progressFill, background: project.color, width: `${progress}%` }} />
        </div>
      </section>

      {/* Metrics */}
      <section style={S.metricsRow}>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{project.taskCount}</div>
          <div style={S.metricLbl}>Total</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: '#0F766E' }}>{counts.done}</div>
          <div style={S.metricLbl}>Concluídas</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: project.color }}>{counts.in_progress}</div>
          <div style={S.metricLbl}>Em andamento</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: '#94A3B8' }}>{counts.pending}</div>
          <div style={S.metricLbl}>Pendentes</div>
        </div>
      </section>

      {/* Task list */}
      <section style={S.tasksSection}>
        <div style={S.tasksPanelHead}>
          <div style={S.panelTitle}>Tarefas</div>
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

        <div style={S.taskList}>
          {filtered.length === 0 && (
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
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  loading: { padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 },
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: '#94A3B8', marginBottom: 14,
  },
  breadcrumbLink: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#64748B', fontSize: 12, padding: 0,
  },
  breadcrumbSep: { color: '#CBD5E1' },
  breadcrumbCurrent: { color: '#475569', fontWeight: 600 },
  hero: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
    background: '#FFFFFF', borderRadius: 24, border: '1px solid rgba(5,11,20,0.08)',
    padding: '22px 24px', marginBottom: 14,
  },
  heroLeft: { display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 0 },
  emojiBox: {
    width: 52, height: 52, borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, flexShrink: 0,
  },
  heroName: { fontSize: 20, fontWeight: 700, color: '#050B14', letterSpacing: '-0.02em' },
  heroDesc: { marginTop: 4, fontSize: 13, color: '#64748B', lineHeight: 1.6 },
  heroDue: { marginTop: 4, fontSize: 11, color: '#94A3B8' },
  pill: {
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    padding: '4px 12px', borderRadius: 999, flexShrink: 0,
  },
  progressSection: {
    background: '#FFFFFF', borderRadius: 24, border: '1px solid rgba(5,11,20,0.08)',
    padding: '18px 24px', marginBottom: 14,
  },
  progressHeader: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  progressTitle: { fontSize: 14, fontWeight: 700, color: '#050B14' },
  progressSub: { marginTop: 3, fontSize: 12, color: '#94A3B8' },
  pctBig: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  progressTrack: {
    height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width .3s' },
  metricsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14,
  },
  metricCard: {
    background: '#FFFFFF', borderRadius: 20, border: '1px solid rgba(5,11,20,0.08)',
    padding: '16px 20px',
  },
  metricVal: { fontSize: 28, fontWeight: 800, color: '#050B14', lineHeight: 1 },
  metricLbl: { marginTop: 4, fontSize: 11, color: '#94A3B8', fontWeight: 600 },
  tasksSection: {
    background: '#FFFFFF', borderRadius: 24, border: '1px solid rgba(5,11,20,0.08)',
    overflow: 'hidden',
  },
  tasksPanelHead: {
    padding: '16px 20px', borderBottom: '1px solid #EDF1F4',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
  },
  panelTitle: { fontSize: 15, fontWeight: 700, color: '#050B14' },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999,
    border: '1px solid rgba(5,11,20,0.08)', background: '#F8FAFB',
    fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(5,11,20,0.06)', color: '#050B14',
    border: '1px solid rgba(5,11,20,0.12)',
  },
  tabBadge: {
    background: 'rgba(5,11,20,0.06)', borderRadius: 999,
    padding: '1px 7px', fontSize: 10,
  },
  taskList: { display: 'grid', gap: 8, padding: 14 },
  empty: { padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 },
  taskRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 14px', borderRadius: 16,
    background: '#FBFCFD', border: '1px solid #EDF1F4',
  },
  checkBtn: {
    width: 28, height: 28, borderRadius: '50%',
    border: '2px solid #CBD5E1', background: 'none', cursor: 'pointer',
    fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkDone: { background: '#0F766E', borderColor: '#0F766E', color: '#fff' },
  checkProgress: { background: '#EFF6FF', borderColor: '#1D4ED8', color: '#1D4ED8' },
  taskTitle: { fontSize: 13, fontWeight: 700, color: '#0F172A' },
  taskMeta: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 5, flexWrap: 'wrap', fontSize: 11, color: '#94A3B8',
  },
  priorityPill: { padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 },
}
```

- [ ] **Verificar sem erros de TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Verificar visualmente**

Abrir `/dashboard/projetos`, clicar em um card. Verificar:
- Breadcrumb "Projetos / 🚀 Nome" aparece
- Faixa colorida no topo do hero usa a cor do projeto
- Porcentagem grande tem a cor do projeto
- Barra de progresso tem a cor do projeto
- 4 metric cards com os valores corretos
- Tabs de filtro funcionam
- Clicar no círculo de status de uma tarefa avança o status e o progresso atualiza
- Pill de status some em projetos sem deadline

- [ ] **Commit**

```bash
git add "apps/web/src/app/dashboard/projetos/[id]/page.tsx"
git commit -m "feat(orbit): add project detail page with metrics and task list"
```

---

## Task 4: Filtro de projeto na página de tarefas

**Files:**
- Modify: `apps/web/src/app/dashboard/tarefas/page.tsx`

- [ ] **Adicionar estado `projectFilter` e ajustar a chave SWR de tasks**

Localizar as linhas de `useState` no início de `TarefasPage` (em torno da linha 93) e adicionar o novo estado. Em seguida, ajustar o `useSWR` de tasks para usar a chave dinâmica:

```tsx
// Adicionar após os outros useStates:
const [projectFilter, setProjectFilter] = useState<string>('')

// Substituir a linha:
// const { data: tasks = [] } = useSWR<Task[]>('/tasks', fetcher)
// por:
const tasksKey = projectFilter ? `/tasks?projectId=${projectFilter}` : '/tasks'
const { data: tasks = [] } = useSWR<Task[]>(tasksKey, fetcher)
```

- [ ] **Adicionar o `<select>` de projeto após os botões de filtro existentes**

Localizar o bloco `<div style={S.filters}>` (em torno da linha 201) e adicionar o select logo após os botões de filtro de status, dentro do mesmo container:

```tsx
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

  {/* Novo: filtro por projeto */}
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
```

- [ ] **Ajustar o `mutate` no `save()` e `remove()` para invalidar a chave correta**

No `save()`, substituir `mutate('/tasks')` por:

```tsx
mutate(tasksKey)
```

No `remove()`, substituir `mutate('/tasks')` por:

```tsx
mutate(tasksKey)
```

No `toggleStatus()`, substituir `mutate('/tasks')` por:

```tsx
mutate(tasksKey)
```

> **Importante:** `tasksKey` precisa estar no escopo. Como está definido no corpo do componente antes das funções, já estará disponível.

- [ ] **Verificar sem erros de TypeScript**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Verificar visualmente**

Abrir `/dashboard/tarefas`. Verificar:
- Select de projeto aparece apenas quando há projetos
- Selecionar um projeto filtra a lista de tarefas para mostrar só as daquele projeto
- Métricas (Todas, Pendentes, etc.) se atualizam de acordo com o filtro
- "Todos os projetos" restaura a lista completa
- Criar/editar/remover tarefa com filtro de projeto ativo continua funcionando

- [ ] **Commit**

```bash
git add apps/web/src/app/dashboard/tarefas/page.tsx
git commit -m "feat(orbit): add project filter dropdown to tasks page"
```

---

## Verificação final end-to-end

- [ ] Abrir `/dashboard/projetos` — cards com pill de status, barra na cor do projeto
- [ ] Projeto sem deadline → pill não aparece
- [ ] Projeto 100% concluído → pill "● Concluído" em índigo
- [ ] Projeto com deadline vencida e progresso < 100% → pill "⚠ Atrasado" em vermelho
- [ ] Clicar em card → navega para `/dashboard/projetos/[id]`
- [ ] Na página de detalhe: cor do projeto usada em toda identidade visual
- [ ] Alterar status de tarefa na página de detalhe → barra de progresso e métricas atualizam
- [ ] Abrir `/dashboard/tarefas` → select de projeto visível
- [ ] Filtrar por projeto → só tarefas daquele projeto aparecem
- [ ] Criar tarefa com filtro ativo → tarefa aparece na lista
