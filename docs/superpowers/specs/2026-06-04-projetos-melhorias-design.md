# Melhorias do Módulo de Projetos

**Data:** 2026-06-04  
**Status:** aprovado

## Contexto

O módulo de projetos do Orbit funciona como agrupador de tarefas, mas não comunica saúde ou progresso do projeto de forma clara. Os cards mostram uma barra de progresso básica, mas não há status automático (no prazo / atrasado / concluído), não existe uma página de detalhe dedicada ao projeto, e na página de tarefas não é possível filtrar por projeto. O objetivo dessas melhorias é tornar os projetos informativos à primeira vista e navegáveis.

## Escopo

Quatro mudanças, todas no frontend. Zero alterações no backend — a API já suporta tudo.

1. **Cards com estilo de cor do projeto** — faixa colorida, progresso na cor do projeto, pill de status semântico
2. **Status automático** — calculado no frontend a partir de `taskDone`, `taskCount` e `deadline`
3. **Página de detalhe** — nova rota `/dashboard/projetos/[id]`
4. **Filtro de tarefas por projeto** — dropdown na barra de filtros existente da página de tarefas

## Decisões de design

### Estilo visual
Direção **C — Cor do Projeto**: cada card e página de detalhe herda a cor escolhida pelo usuário (`project.color`). A cor do projeto é usada na faixa superior do card, na barra de progresso e na porcentagem em destaque. O status pill usa cor **semântica** independente (verde / vermelho / índigo), evitando colisão com a cor do projeto.

### Lógica de status (frontend, pura)
```ts
function projectStatus(project: Project): 'concluido' | 'atrasado' | 'no_prazo' {
  if (project.taskCount > 0 && project.taskDone === project.taskCount) return 'concluido'
  if (project.deadline && new Date(project.deadline) < new Date()) return 'atrasado'
  return 'no_prazo'
}
```
Sem campo novo no banco. Sem endpoint novo.

### Ausência de deadline
Projetos sem `deadline` nunca ficam "atrasados" — mostram apenas a barra de progresso sem pill de status temporal (ou pill neutro "Em andamento").

## Componentes a criar/modificar

### 1. `apps/web/src/app/dashboard/projetos/page.tsx` — modificar
- Adicionar faixa colorida no topo de cada card (`border-top: 3px solid project.color`)
- Barra de progresso usa `project.color`
- Porcentagem numérica visível ao lado da barra
- Pill de status no canto superior direito do card
- Ao clicar no card: navegar para `/dashboard/projetos/[id]` (substituir comportamento atual do side panel)

### 2. `apps/web/src/app/dashboard/projetos/[id]/page.tsx` — criar
Estrutura da página:
- **Hero** com `border-top` na cor do projeto, emoji, nome, descrição, pill de status
- **Porcentagem grande** + barra de progresso na cor do projeto + contagem (X de Y tarefas)
- **4 metric cards**: Total · Concluídas · Em andamento · Pendentes
- **Lista de tarefas** com tabs de filtro (Todas / Pendentes / Em andamento / Concluídas)
- Cada task row: dot de status, título, badge de prioridade, data

Dados: `GET /api/projects/:id` (já retorna projeto + histórico) + `GET /api/tasks?projectId=:id`

### 3. `apps/web/src/app/dashboard/tarefas/page.tsx` — modificar
- Adicionar `<select>` de projeto à barra de filtros existente
- Opção "Todos os projetos" (padrão, sem filtro)
- Ao selecionar projeto: recarregar SWR com `?projectId=xxx` (endpoint já suportado)
- Buscar lista de projetos via `GET /api/projects` para popular o dropdown

## Reutilização de código existente

- `GET /api/tasks?projectId=...` — já implementado em `apps/api/src/routes/tasks.ts`
- `GET /api/projects/:id` — já implementado em `apps/api/src/routes/projects.ts`
- `GET /api/projects` — já retorna `taskCount` e `taskDone` calculados
- Pattern de SWR com `useSWR` — seguir padrão já usado nas outras páginas
- Paleta de cores e estilos inline — seguir exatamente o padrão de `projetos/page.tsx` existente

## O que NÃO está no escopo

- Side panel de tarefas na página de projetos pode ser simplificado ou removido após a página de detalhe existir
- Milestones, kanban, burndown — fora deste ciclo
- Alterações no schema Prisma — nenhuma

## Verificação

1. Abrir `/dashboard/projetos` — cards devem mostrar faixa colorida, barra na cor do projeto, pill de status
2. Clicar em um projeto — deve navegar para `/dashboard/projetos/[id]`
3. Na página de detalhe: métricas devem bater com os dados do projeto; filtros de task devem funcionar
4. Alterar status de uma tarefa na página de detalhe → progresso e métricas devem atualizar (via SWR revalidation)
5. Abrir `/dashboard/tarefas` → dropdown de projeto deve aparecer; filtrar por projeto deve mostrar só as tarefas daquele projeto
6. Projeto sem deadline → sem pill "Atrasado", barra de progresso apenas
7. Projeto 100% concluído → pill "Concluído" em índigo
