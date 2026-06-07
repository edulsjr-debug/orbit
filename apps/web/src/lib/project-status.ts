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
  concluido: 'Concluído',
  atrasado:  'Atrasado',
  no_prazo:  'No prazo',
  sem_prazo: '',
}

export const STATUS_PILL_STYLE: Record<ProjectStatusKey, CSSProperties> = {
  concluido: {
    background: 'var(--brand-50, #F4F8FE)',
    color: 'var(--brand-700, #0E335A)',
    border: '1px solid var(--brand-200, #BFDBFE)',
  },
  atrasado: {
    background: 'rgba(220,38,38,.08)',
    color: '#DC2626',
    border: '1px solid rgba(220,38,38,.2)',
  },
  no_prazo: {
    background: 'rgba(34,197,94,.08)',
    color: '#16A34A',
    border: '1px solid rgba(34,197,94,.2)',
  },
  sem_prazo: { display: 'none' },
}
