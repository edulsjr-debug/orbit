# UX Refactor — URL Structure, Task Cards, Task Creation in Projects

**Data:** 2026-06-04  
**Status:** aprovado

## Contexto

Feedback pós-QA identificou três problemas de usabilidade: (1) a URL `/dashboard/tarefas` é redundante e pouco organizada; (2) os botões de status das tarefas (○ ◔ ✓) não comunicam o que vai acontecer ao clicar; (3) não há forma direta de criar ou vincular tarefas a projetos sem sair da página de projetos. Este spec cobre os três em sequência.

## Escopo

Três mudanças no frontend, todas na branch `dev` sobre os commits anteriores de melhorias de projetos.

1. **URL Restructure** — Route Group `(dashboard)` remove o prefixo `/dashboard/` de todas as rotas
2. **Task Card Redesign** — Opção C: check 32px com label contextual + status legível no rodapé
3. **Task Creation in Projects** — Botão `+ Tarefa` no card da grade + `Nova tarefa` na página de detalhe, reutilizando modal extraído como componente

Nenhuma alteração de backend necessária.

---

## 1. URL Restructure

### Abordagem
Usar **Route Groups** do Next.js App Router: renomear `app/dashboard/` para `app/(dashboard)/`. O Next.js ignora o nome de pastas entre parênteses na URL — `app/(dashboard)/tarefas/page.tsx` serve `/tarefas`.

### Arquivos afetados
| Ação | Arquivo |
|------|---------|
| Renomear pasta | `app/dashboard/` → `app/(dashboard)/` |
| Modificar | `app/page.tsx` — redirect de `/dashboard` para `/` |
| Modificar | `app/login/page.tsx` — redirect pós-login de `/dashboard` para `/` |
| Modificar | `src/components/AppShell.tsx` — 8 hrefs e router.push |

### Redirects após mudança
- `app/page.tsx`: `redirect('/dashboard')` → `redirect('/')`  
- `app/login/page.tsx`: redirect pós-login → `/`  
- `AppShell.tsx` nav items: `/dashboard` → `/`, `/dashboard/compromissos` → `/compromissos`, etc.

### O que NÃO muda
- Layout `(dashboard)/layout.tsx` — idêntico ao atual, só muda de pasta
- Todas as páginas internas — zero alteração de código
- API routes — não existem no web app

---

## 2. Task Card Redesign (Opção C — Modern/Clean)

### Estrutura do novo card

```
┌─────────────────────────────────────────────────────┐
│  [CHECK]  Título da tarefa (15px bold)               │
│  iniciar  ● Alta  💡 Projeto  📅 30/06              │
│  ─────────────────────────────────────────────────  │
│  Pendente                        Editar · Remover   │
└─────────────────────────────────────────────────────┘
```

### Especificação do check button
- Tamanho: 32×32px, `border-radius: 10px`
- Label abaixo: 9px, uppercase, cor do estado (`#CBD5E1` pendente, `#1D4ED8` em andamento, `#0F766E` concluído)
- Estados:
  - Pendente: borda `#E2E8F0`, fundo transparente, símbolo `○`, label `"INICIAR"`
  - Em andamento: borda `#1D4ED8`, fundo `#EFF6FF`, cor `#1D4ED8`, símbolo `◔`, label `"CONCLUIR"`
  - Concluída: fundo `#0F766E`, borda `#0F766E`, cor `#fff`, símbolo `✓`, label `"REABRIR"`

### Rodapé do card
- Separado do conteúdo por linha tracejada `1px dashed #EDF1F4`
- Esquerda: status legível (ex: `"Em andamento"` em `#1D4ED8`)
- Direita: `Editar · Remover` com separador `·`

### Opacidade
- Concluída: `opacity: 0.55`

### Arquivo modificado
`apps/web/src/app/(dashboard)/tarefas/page.tsx` (pós rename)

---

## 3. Task Creation in Projects

### Extração do TaskModal

O modal de criar/editar tarefa existe inline em `tarefas/page.tsx`. Para reutilizá-lo em `projetos/page.tsx` e `projetos/[id]/page.tsx`, deve ser extraído para:

`apps/web/src/components/TaskModal.tsx`

Props:
```ts
interface TaskModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editing?: Task | null
  projects: Project[]
  defaultProjectId?: string  // pré-vincula ao projeto quando criado via projetos
}
```

Quando `defaultProjectId` é passado:
- Campo de projeto no modal é pré-preenchido com o projeto
- Campo de projeto fica **readonly** (label, não select) para deixar claro o vínculo

### Botão no card da grade (`projetos/page.tsx`)

Adicionar dentro de `S.cardActions` (ao lado de Editar/Remover), com `e.stopPropagation()`:

```tsx
<button style={S.iconBtn} onClick={() => openNewTaskForProject(p.id)}>
  + Tarefa
</button>
```

Ao clicar: abre `TaskModal` com `defaultProjectId={p.id}`.

### Botão na página de detalhe (`projetos/[id]/page.tsx`)

No `tasksPanelHead`, ao lado das tabs de filtro:

```tsx
<button style={S.btnPrimary} onClick={() => setTaskModalOpen(true)}>
  Nova tarefa
</button>
```

Ao salvar: invalida `mutate('/tasks?projectId=${id}')` e `mutate('/projects/${id}')`.

### Arquivos afetados
| Ação | Arquivo |
|------|---------|
| Criar | `apps/web/src/components/TaskModal.tsx` |
| Modificar | `apps/web/src/app/(dashboard)/projetos/page.tsx` |
| Modificar | `apps/web/src/app/(dashboard)/projetos/[id]/page.tsx` |
| Modificar | `apps/web/src/app/(dashboard)/tarefas/page.tsx` — remove modal inline, usa `<TaskModal>` |

---

## Ordem de implementação

1. **URL Restructure primeiro** — todas as mudanças seguintes trabalham nos novos caminhos
2. **TaskModal extraction** — base para a feature de criação em projetos
3. **Task Card Redesign** — modifica tarefas/page.tsx (que já importa TaskModal)
4. **Task Creation in Projects** — usa TaskModal, adiciona botões

## Verificação

1. `/tarefas`, `/projetos`, `/compromissos`, `/config`, `/notificacoes` acessíveis sem `/dashboard/`
2. `/` redireciona para `/compromissos` (ou página home) se logado, `/login` se não
3. Card de tarefa: label abaixo do check muda conforme estado; rodapé mostra status em cor + ações
4. Clicar `+ Tarefa` no card de projeto abre modal com projeto pré-vinculado e campo readonly
5. Clicar `Nova tarefa` na página de detalhe abre mesmo modal, tarefa aparece na lista ao salvar
6. Tarefas criadas via modal de projeto aparecem na lista de tarefas filtrada por projeto
