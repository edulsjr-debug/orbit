# Design: Histórico Amigável

**Data:** 2026-05-31  
**Status:** Aprovado

## Resumo

Reescrever a aba Histórico do modal de eventos para exibir alterações de forma legível. Agrupamento por salvamento (tolerância de 5s entre `createdAt`), campos traduzidos para português, valores formatados.

## Localização

`apps/web/src/app/dashboard/compromissos/page.tsx` — apenas o bloco JSX do histórico (aba `history`) e os estilos relacionados no objeto `S`. Nenhuma mudança no backend.

## Comportamento de Agrupamento

Os itens de `EventHistoryItem[]` retornados pela API são agrupados no frontend:
- Dois itens pertencem ao mesmo grupo se `|createdAt_A - createdAt_B| <= 5000ms`
- O algoritmo percorre a lista (já ordenada por `createdAt desc`) e abre novo grupo quando a diferença ultrapassa 5s
- Cada grupo exibe o `createdAt` do primeiro item como timestamp da edição

## Labels dos Campos (português + emoji)

| Campo (`field`) | Label exibido |
|---|---|
| `title` | 📝 Título |
| `location` | 📍 Local |
| `startAt` | 📅 Data e hora |
| `durationMinutes` | ⏱ Duração |
| `category` | 🏷 Categoria |
| `notifPush` | 🔔 Notif. push |
| `notifEmail` | 📧 Notif. email |
| `notifWhatsapp` | 💬 Notif. WhatsApp |
| `notifAdvance` | ⏰ Antecedência |
| desconhecido | o próprio valor de `field` |

## Formatação dos Valores

| Campo | Formatação |
|---|---|
| `startAt` | `dd/MM às HH:mm` (ex: `28/05 às 16:00`) — usar `toLocaleDateString` + `toLocaleTimeString` pt-BR |
| `durationMinutes` | `1h`, `1h 30min`, `45min` — dividir por 60, tratar resto |
| `category` | Usar `CATEGORY_LABELS` já existente (Trabalho, Cliente, etc.) |
| `notifPush` / `notifEmail` / `notifWhatsapp` | `'true'` → `Ativada`, `'false'` → `Desativada` |
| `notifAdvance` | `'15'` → `15 min antes`, `'60'` → `1h antes`, `'1440'` → `1 dia antes` |
| vazio / null | `(vazio)` em itálico |
| outros | valor bruto |

## Visual de Cada Grupo

```
┌─────────────────────────────────────────────────┐
│ ✏️ Editado                        hoje às 14:23  │  ← cabeçalho fundo #f8fafc
├─────────────────────────────────────────────────┤
│ 📅 Data e hora   ~~Ter 27/05 às 13:00~~ → Qua 28/05 às 16:00  │
│ ⏱ Duração        ~~1h~~ → 1h 30min                             │
│ 🏷 Categoria     ~~Trabalho~~ → Cliente                        │
└─────────────────────────────────────────────────┘
```

- Border: `1px solid #e2e8f0`, border-radius 10px
- Cabeçalho: fundo `#f8fafc`, ícone ✏️ em círculo `#eef2ff`
- Timestamp relativo: "hoje às HH:mm", "ontem às HH:mm", ou "dd/MM às HH:mm"
- Valor antigo: riscado (`text-decoration: line-through`), cor `#94a3b8`
- Valor novo: `font-weight: 600`, cor `#1e293b`
- Label: `min-width: 90px`, cor `#64748b`

## Implementação

Tudo em `page.tsx`, sem novos arquivos:

1. **Helper `formatFieldLabel(field)`** — retorna string com emoji + nome pt-BR
2. **Helper `formatFieldValue(field, value)`** — retorna string legível
3. **Helper `formatRelativeTime(date)`** — retorna "hoje às HH:mm", "ontem às HH:mm" ou "dd/MM às HH:mm"
4. **Helper `groupHistoryItems(items)`** — agrupa por tolerância de 5s, retorna `Array<{ timestamp: Date, items: EventHistoryItem[] }>`
5. **JSX da aba histórico** — substituir o bloco `S.timeline` atual pelo novo layout de grupos

## O que NÃO muda

- API e backend: zero alterações
- `EventHistoryItem` type: sem mudança
- SWR fetch do histórico: sem mudança
- Demais abas do modal (Detalhes, Transferir): intocadas
