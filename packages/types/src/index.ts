// ─── Usuário ────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  name: string
  phone?: string
  createdAt: string
}

// ─── Compromisso ────────────────────────────────────────────────────────────
export type EventCategory = 'trabalho' | 'cliente' | 'pessoal' | 'juridico' | 'gestao'

export interface EventNotifConfig {
  push: boolean
  email: boolean
  whatsapp: boolean
  advanceMinutes: number
}

export interface Event {
  id: string
  title: string
  description?: string
  location?: string
  startAt: string
  durationMinutes: number
  category: EventCategory
  recurring: boolean
  notif: EventNotifConfig
  hasHistory: boolean
  createdAt: string
  updatedAt: string
}

export interface HistoryEntry {
  id: string
  field: string
  oldValue?: string
  newValue?: string
  userId: string
  userName: string
  createdAt: string
}

// ─── Tarefa ─────────────────────────────────────────────────────────────────
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus   = 'pending' | 'in_progress' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  dueAt?: string
  priority: TaskPriority
  status: TaskStatus
  projectId?: string
  notifPush: boolean
  notifEmail: boolean
  hasHistory: boolean
  createdAt: string
  updatedAt: string
}

// ─── Projeto ─────────────────────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  description?: string
  color: string
  emoji: string
  deadline?: string
  taskCount: number
  taskDone: number
  hasHistory: boolean
  createdAt: string
  updatedAt: string
}

// ─── Notificação ─────────────────────────────────────────────────────────────
export type NotifChannel = 'push' | 'email' | 'whatsapp' | 'platform'

export interface AppNotification {
  id: string
  title: string
  body: string
  channel: NotifChannel
  read: boolean
  entityType?: 'event' | 'task' | 'project'
  entityId?: string
  createdAt: string
}

// ─── API ─────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: string
  statusCode: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
