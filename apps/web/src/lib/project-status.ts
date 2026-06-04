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
