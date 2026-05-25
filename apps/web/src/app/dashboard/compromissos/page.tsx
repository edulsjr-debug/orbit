'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'

type ViewMode = 'mes' | 'lista' | 'kanban'
type DensityMode = 'detailed' | 'compact'
type HistoryTab = 'details' | 'history'

type EventItem = {
  id: string
  title: string
  description?: string
  location?: string
  startAt: string
  durationMinutes: number
  category: 'trabalho' | 'cliente' | 'pessoal' | 'juridico' | 'gestao'
  recurring?: boolean
  notifPush: boolean
  notifEmail: boolean
  notifWhatsapp?: boolean
  notifAdvance: number
  hasHistory?: boolean
}

type EventHistoryItem = {
  id: string
  field: string
  oldValue?: string | null
  newValue?: string | null
  createdAt: string
  userId: string
}

type EventFormState = {
  title: string
  startAt: string
  durationMinutes: number
  category: EventItem['category']
  location: string
  description: string
  notifPush: boolean
  notifEmail: boolean
  notifAdvance: number
}

const fetcher = (url: string) => api.get<any>(url).then((r: any) => r.data)

const CATEGORY_COLORS: Record<EventItem['category'], string> = {
  trabalho: '#B8924F',
  cliente: '#1D4ED8',
  pessoal: '#0F766E',
  juridico: '#991B1B',
  gestao: '#7C3AED',
}

const CATEGORY_LABELS: Record<EventItem['category'], string> = {
  trabalho: 'Trabalho',
  cliente: 'Cliente',
  pessoal: 'Pessoal',
  juridico: 'Jurídico',
  gestao: 'Gestão',
}

const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toDatetimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultFormState(date: Date): EventFormState {
  const base = new Date(date)
  base.setSeconds(0, 0)
  if (base.getHours() === 0 && base.getMinutes() === 0) {
    base.setHours(9, 0, 0, 0)
  }

  return {
    title: '',
    startAt: toDatetimeLocal(base),
    durationMinutes: 60,
    category: 'trabalho',
    location: '',
    description: '',
    notifPush: true,
    notifEmail: false,
    notifAdvance: 30,
  }
}

function eventToFormState(event: EventItem): EventFormState {
  return {
    title: event.title,
    startAt: toDatetimeLocal(new Date(event.startAt)),
    durationMinutes: event.durationMinutes,
    category: event.category,
    location: event.location ?? '',
    description: event.description ?? '',
    notifPush: event.notifPush,
    notifEmail: event.notifEmail,
    notifAdvance: event.notifAdvance,
  }
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error ?? 'Erro desconhecido')
  }

  return response.json()
}

export default function CompromissosPage() {
  const isMobile = useIsMobile()
  const today = useMemo(() => startOfDay(new Date()), [])
  const [view, setView] = useState<ViewMode>('mes')
  const [density, setDensity] = useState<DensityMode>('detailed')
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(today))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const [historyTab, setHistoryTab] = useState<HistoryTab>('details')
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EventFormState>(defaultFormState(today))

  const monthStart = startOfMonth(monthCursor)
  const monthEnd = endOfMonth(monthCursor)
  const eventsKey = `/events?from=${encodeURIComponent(monthStart.toISOString())}&to=${encodeURIComponent(monthEnd.toISOString())}`

  const { data: events, isLoading, mutate } = useSWR(eventsKey, fetcher)
  const { data: history, isLoading: loadingHistory } = useSWR(
    modalOpen && editingEvent && historyTab === 'history' ? `/events/${editingEvent.id}/history` : null,
    fetcher
  )

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const eventList = (events ?? []) as EventItem[]

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const event of eventList) {
      const key = formatDateKey(new Date(event.startAt))
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    for (const value of map.values()) {
      value.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    }
    return map
  }, [eventList])

  const selectedEvents = eventsByDay.get(formatDateKey(selectedDate)) ?? []

  const monthCells = useMemo(() => {
    const first = startOfMonth(monthCursor)
    const firstWeekday = (first.getDay() + 6) % 7
    const gridStart = addDays(first, -firstWeekday)

    return Array.from({ length: 42 }).map((_, index) => {
      const date = addDays(gridStart, index)
      return {
        date,
        key: formatDateKey(date),
        inMonth: date.getMonth() === monthCursor.getMonth(),
      }
    })
  }, [monthCursor])

  const nextSevenDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => startOfDay(addDays(today, index)))
  }, [today])

  const currentWeek = useMemo(() => {
    const weekday = (today.getDay() + 6) % 7
    const monday = addDays(today, -weekday)
    return Array.from({ length: 7 }).map((_, index) => startOfDay(addDays(monday, index)))
  }, [today])

  const listGroups = nextSevenDays.map((date) => ({
    date,
    events: eventsByDay.get(formatDateKey(date)) ?? [],
  }))

  function openCreateModal(date?: Date) {
    const baseDate = date ?? selectedDate
    setEditingEvent(null)
    setHistoryTab('details')
    setForm(defaultFormState(baseDate))
    setModalOpen(true)
  }

  function openEditModal(event: EventItem) {
    setEditingEvent(event)
    setHistoryTab('details')
    setForm(eventToFormState(event))
    setModalOpen(true)
  }

  async function saveEvent() {
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        startAt: new Date(form.startAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        category: form.category,
        location: form.location || undefined,
        description: form.description || undefined,
        notifPush: form.notifPush,
        notifEmail: form.notifEmail,
        notifWhatsapp: false,
        notifAdvance: Number(form.notifAdvance),
        recurring: false,
      }

      if (editingEvent) {
        await putJson(`/events/${editingEvent.id}`, payload)
        setToast('Compromisso atualizado')
      } else {
        await api.post('/events', payload)
        setToast('Compromisso criado')
      }

      await mutate()
      setModalOpen(false)
    } catch (error: any) {
      setToast(error.message ?? 'Falha ao salvar compromisso')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent() {
    if (!editingEvent) return
    if (!window.confirm('Excluir este compromisso?')) return

    try {
      await api.delete(`/events/${editingEvent.id}`)
      await mutate()
      setModalOpen(false)
      setToast('Compromisso excluído')
    } catch (error: any) {
      setToast(error.message ?? 'Falha ao excluir compromisso')
    }
  }

  async function moveEventToDay(event: EventItem, targetDate: Date) {
    const original = new Date(event.startAt)
    const nextStart = new Date(targetDate)
    nextStart.setHours(original.getHours(), original.getMinutes(), 0, 0)

    try {
      await api.patch(`/events/${event.id}`, { startAt: nextStart.toISOString() })
      await mutate()
      setToast(`Compromisso movido para ${targetDate.toLocaleDateString('pt-BR')}`)
    } catch (error: any) {
      setToast(error.message ?? 'Falha ao mover compromisso')
    }
  }

  return (
    <div>
      <style>{`
        @keyframes orbitFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={S.pageHeader}>
        <div>
          <h2 style={S.pageTitle}>Compromissos</h2>
          <p style={S.pageSub}>Calendário mensal, lista dos próximos dias e semana em kanban.</p>
        </div>
        <div style={S.headerControls}>
          <div style={S.switcherWrap}>
            {(['mes', 'lista', 'kanban'] as ViewMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => setView(mode)} style={{ ...S.switcherBtn, ...(view === mode ? S.switcherBtnActive : {}) }}>
                {mode === 'mes' ? 'Mês' : mode === 'lista' ? 'Lista' : 'Kanban'}
              </button>
            ))}
          </div>
          <div style={S.switcherWrap}>
            {(['detailed', 'compact'] as DensityMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => setDensity(mode)} style={{ ...S.switcherBtn, ...(density === mode ? S.switcherBtnActive : {}) }}>
                {mode === 'detailed' ? 'Detalhado' : 'Compacto'}
              </button>
            ))}
          </div>
          <button type="button" style={S.primaryButton} onClick={() => openCreateModal(selectedDate)}>
            + Novo compromisso
          </button>
        </div>
      </div>

      {view === 'mes' && (
        <div style={S.fadeIn}>
          <div style={{ ...S.calendarCard, ...(isMobile ? S.calendarCardMobile : null) }}>
            <div style={S.calendarNav}>
              <button type="button" style={S.iconButton} onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>‹</button>
              <h3 style={S.calendarTitle}>{monthCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
              <button type="button" style={S.iconButton} onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>›</button>
            </div>

            <div style={{ ...S.weekHeader, ...(isMobile ? S.weekHeaderMobile : null) }}>
              {WEEK_LABELS.map((label) => (
                <div key={label} style={S.weekHeaderCell}>{label}</div>
              ))}
            </div>

            <div style={{ ...S.calendarGrid, ...(isMobile ? S.calendarGridMobile : null) }}>
              {monthCells.map((cell) => {
                const dayEvents = eventsByDay.get(cell.key) ?? []
                const isToday = sameDay(cell.date, today)
                const isSelected = sameDay(cell.date, selectedDate)

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDate(cell.date)}
                    style={{
                      ...S.dayCell,
                      ...(cell.inMonth ? null : S.dayCellMuted),
                      ...(isSelected ? S.dayCellSelected : null),
                    }}
                  >
                    <div style={{ ...S.dayNumber, ...(isToday ? S.dayNumberToday : null) }}>{cell.date.getDate()}</div>
                    <div style={S.dayDots}>
                      {dayEvents.slice(0, 3).map((event) => (
                        <span key={event.id} style={{ ...S.dot, background: CATEGORY_COLORS[event.category] }} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={S.panelCard}>
            <div style={S.panelHeader}>
              <h4 style={S.panelTitle}>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
              <button type="button" style={S.secondaryButton} onClick={() => openCreateModal(selectedDate)}>Adicionar</button>
            </div>

            {isLoading ? (
              <div style={S.emptyState}>Carregando compromissos...</div>
            ) : selectedEvents.length === 0 ? (
              <div style={S.emptyState}>Nenhum compromisso neste dia.</div>
            ) : density === 'detailed' ? (
              <div style={S.verticalList}>
                {selectedEvents.map((event) => (
                  <EventCard key={event.id} event={event} onClick={() => openEditModal(event)} />
                ))}
              </div>
            ) : (
              <div style={S.verticalList}>
                {selectedEvents.map((event) => (
                  <CompactEventRow key={event.id} event={event} onClick={() => openEditModal(event)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'lista' && (
        <div style={S.fadeIn}>
          {listGroups.map((group) => (
            <div key={formatDateKey(group.date)} style={{ marginBottom: 18 }}>
              <div style={S.groupHeader}>
                <strong style={S.groupTitle}>{group.date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                <span style={S.groupBadge}>{group.events.length}</span>
              </div>
              {group.events.length === 0 ? (
                <div style={S.emptyListCard}>Nenhum compromisso.</div>
              ) : density === 'detailed' ? (
                group.events.map((event) => <EventCard key={event.id} event={event} onClick={() => openEditModal(event)} />)
              ) : (
                group.events.map((event) => <CompactEventRow key={event.id} event={event} onClick={() => openEditModal(event)} />)
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'kanban' && (
        <div style={{ ...S.fadeIn, ...S.kanbanWrap }}>
          {currentWeek.map((date) => {
            const key = formatDateKey(date)
            const dayEvents = eventsByDay.get(key) ?? []
            const isToday = sameDay(date, today)

            return (
              <div key={key} style={S.kanbanColumn}>
                <div style={{ ...S.kanbanHeader, ...(isToday ? S.kanbanHeaderToday : null) }}>
                  <div style={{ ...S.kanbanHeaderWeekday, ...(isToday ? S.kanbanHeaderWeekdayToday : null) }}>{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                  <div style={{ ...S.kanbanHeaderDay, ...(isToday ? S.kanbanHeaderDayToday : null) }}>{date.getDate()}</div>
                </div>
                <div
                  style={S.kanbanDropzone}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const eventId = event.dataTransfer.getData('text/plain')
                    const dragged = eventList.find((item) => item.id === eventId)
                    if (dragged) {
                      moveEventToDay(dragged, date)
                    }
                    setDraggingEventId(null)
                  }}
                >
                  {dayEvents.length === 0 && <div style={S.emptyKanban}>Arraste para cá</div>}
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      draggable
                      onDragStart={(dragEvent) => {
                        dragEvent.dataTransfer.setData('text/plain', event.id)
                        setDraggingEventId(event.id)
                      }}
                      onDragEnd={() => setDraggingEventId(null)}
                      onClick={() => openEditModal(event)}
                      style={{
                        ...S.kanbanCard,
                        borderColor: CATEGORY_COLORS[event.category],
                        opacity: draggingEventId === event.id ? 0.45 : 1,
                      }}
                    >
                      <div style={S.kanbanTime}>{new Date(event.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={S.kanbanTitle}>{event.title}</div>
                      <div style={S.kanbanMeta}>{event.location || CATEGORY_LABELS[event.category]}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div style={S.overlay} onClick={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
          <div style={{ ...S.modal, ...(isMobile ? S.modalMobile : null) }}>
            <div style={S.modalHeader}>
              <h3 style={S.modalTitle}>{editingEvent ? 'Editar compromisso' : 'Novo compromisso'}</h3>
              <button type="button" style={S.closeButton} onClick={() => setModalOpen(false)}>×</button>
            </div>

            <div style={S.tabRow}>
              <button type="button" style={{ ...S.modalTab, ...(historyTab === 'details' ? S.modalTabActive : {}) }} onClick={() => setHistoryTab('details')}>Detalhes</button>
              <button type="button" style={{ ...S.modalTab, ...(historyTab === 'history' ? S.modalTabActive : {}) }} onClick={() => setHistoryTab('history')}>
                Histórico
              </button>
            </div>

            {historyTab === 'details' ? (
              <div style={S.modalBody}>
                <Field label="Título">
                  <input style={S.input} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field label="Data e hora">
                  <input type="datetime-local" style={S.input} value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))} />
                </Field>
                <div style={{ ...S.formGrid, ...(isMobile ? S.formGridMobile : null) }}>
                  <Field label="Duração">
                    <input type="number" min={15} step={15} style={S.input} value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} />
                  </Field>
                  <Field label="Categoria">
                    <select style={S.input} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as EventItem['category'] }))}>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Local">
                  <input style={S.input} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
                </Field>
                <Field label="Descrição">
                  <textarea style={{ ...S.input, minHeight: 96, resize: 'vertical' }} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                </Field>

                <div style={S.notificationBlock}>
                  <div style={S.notificationTitle}>Notificações</div>
                  <div style={S.toggleRow}>
                    <span>Push no navegador</span>
                    <Toggle checked={form.notifPush} onChange={() => setForm((current) => ({ ...current, notifPush: !current.notifPush }))} />
                  </div>
                  <div style={S.toggleRow}>
                    <span>Email</span>
                    <Toggle checked={form.notifEmail} onChange={() => setForm((current) => ({ ...current, notifEmail: !current.notifEmail }))} />
                  </div>
                  <Field label="Antecedência">
                    <select style={S.input} value={form.notifAdvance} onChange={(event) => setForm((current) => ({ ...current, notifAdvance: Number(event.target.value) }))}>
                      <option value={15}>15 min antes</option>
                      <option value={30}>30 min antes</option>
                      <option value={60}>1 hora antes</option>
                      <option value={1440}>1 dia antes</option>
                    </select>
                  </Field>
                </div>
              </div>
            ) : (
              <div style={S.modalBody}>
                {!editingEvent ? (
                  <div style={S.emptyState}>Salve o compromisso primeiro para ver o histórico.</div>
                ) : loadingHistory ? (
                  <div style={S.emptyState}>Carregando histórico...</div>
                ) : (history ?? []).length === 0 ? (
                  <div style={S.emptyState}>Nenhuma alteração registrada.</div>
                ) : (
                  <div style={S.timeline}>
                    {(history as EventHistoryItem[]).map((item) => (
                      <div key={item.id} style={S.timelineItem}>
                        <div style={S.timelineDot}>✏</div>
                        <div>
                          <div style={S.timelineTitle}>{item.field}</div>
                          <div style={S.timelineBody}>
                            <span style={S.oldValue}>{item.oldValue || 'vazio'}</span>
                            {' → '}
                            <span style={S.newValue}>{item.newValue || 'vazio'}</span>
                          </div>
                          <div style={S.timelineTime}>{new Date(item.createdAt).toLocaleString('pt-BR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={S.modalFooter}>
              {editingEvent ? <button type="button" style={S.deleteButton} onClick={deleteEvent}>Excluir</button> : <span />}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" style={S.secondaryButton} onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="button" style={S.primaryButton} onClick={saveEvent} disabled={saving || !form.title.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={S.label}>{label}</div>
      {children}
    </label>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} style={{ ...S.toggle, ...(checked ? S.toggleOn : null) }}>
      <span style={{ ...S.toggleKnob, ...(checked ? S.toggleKnobOn : null) }} />
    </button>
  )
}

function EventCard({ event, onClick }: { event: EventItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...S.eventCard, ...(event.hasHistory ? S.eventCardHistory : null) }}>
      <div style={{ ...S.eventBar, background: CATEGORY_COLORS[event.category] }} />
      <div style={S.eventTimeCol}>
        <div style={S.eventTime}>{new Date(event.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        <div style={S.eventDuration}>{event.durationMinutes} min</div>
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={S.eventTitle}>{event.title}</div>
        <div style={S.eventSub}>{event.location || 'Sem local definido'}</div>
        <div style={S.eventMetaRow}>
          <span style={S.metaPill}>{CATEGORY_LABELS[event.category]}</span>
          {event.hasHistory ? <span style={S.editedPill}>✏</span> : null}
        </div>
        <div style={S.notificationRow}>
          {event.notifPush ? <span>🔔</span> : null}
          {event.notifEmail ? <span>✉️</span> : null}
          {event.notifWhatsapp ? <span>💬</span> : null}
        </div>
      </div>
    </button>
  )
}

function CompactEventRow({ event, onClick }: { event: EventItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...S.compactRow, ...(event.hasHistory ? S.eventCardHistory : null) }}>
      <div style={S.compactTime}>{new Date(event.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div style={{ ...S.eventBar, background: CATEGORY_COLORS[event.category], height: 20 }} />
      <div style={{ flex: 1, textAlign: 'left', fontWeight: 600, color: '#0f172a' }}>{event.title}</div>
      {event.hasHistory ? <span style={S.editedPill}>✏</span> : null}
    </button>
  )
}

const S: Record<string, React.CSSProperties> = {
  fadeIn: { animation: 'orbitFadeIn .2s ease-out' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' },
  pageTitle: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#050b14' },
  pageSub: { marginTop: 2, fontSize: 13, color: '#64748b' },
  headerControls: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  switcherWrap: { display: 'flex', gap: 4, background: '#f4f6f8', padding: 4, borderRadius: 14, border: '1px solid rgba(5,11,20,0.08)' },
  switcherBtn: { border: 'none', background: 'transparent', padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: '#64748b', cursor: 'pointer' },
  switcherBtnActive: { background: '#fff', color: '#0f172a', boxShadow: '0 6px 16px rgba(5,11,20,.08)' },
  primaryButton: { border: 'none', background: 'linear-gradient(135deg, #050B14 0%, #101C2B 100%)', color: '#fff', borderRadius: 14, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { border: '1px solid rgba(5,11,20,0.08)', background: '#fff', color: '#374151', borderRadius: 14, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  deleteButton: { border: '1px solid rgba(153,27,27,0.14)', background: '#fff1f2', color: '#991b1b', borderRadius: 14, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  iconButton: { width: 38, height: 38, border: '1px solid rgba(5,11,20,0.08)', background: '#fff', borderRadius: 12, fontSize: 18, cursor: 'pointer' },
  calendarCard: { background: '#fff', borderRadius: 24, border: '1px solid rgba(5,11,20,0.08)', overflow: 'hidden', marginBottom: 16 },
  calendarCardMobile: { overflowX: 'auto' },
  calendarNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px', borderBottom: '1px solid #edf1f4' },
  calendarTitle: { fontSize: 15, fontWeight: 800, textTransform: 'capitalize' },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
  weekHeaderMobile: { minWidth: 560 },
  weekHeaderCell: { textAlign: 'center', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f8fafc' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
  calendarGridMobile: { minWidth: 560 },
  dayCell: { minHeight: 78, border: 'none', borderTop: '1px solid #f8fafc', borderRight: '1px solid #f8fafc', background: '#fff', padding: 8, cursor: 'pointer' },
  dayCellMuted: { background: '#fcfcfd', color: '#cbd5e1' },
  dayCellSelected: { background: '#fbf4e4' },
  dayNumber: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: 13, fontWeight: 700, color: '#0f172a' },
  dayNumberToday: { background: '#050b14', color: '#fff' },
  dayDots: { display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: '50%' },
  panelCard: { background: '#fff', borderRadius: 24, border: '1px solid rgba(5,11,20,0.08)', padding: '18px 20px' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  panelTitle: { fontSize: 14, fontWeight: 800, textTransform: 'capitalize' },
  verticalList: { display: 'flex', flexDirection: 'column', gap: 10 },
  eventCard: { width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid rgba(5,11,20,0.08)', borderRadius: 18, background: '#fbfcfd', padding: '14px 16px', cursor: 'pointer' },
  eventCardHistory: { borderLeft: '3px solid #f59e0b' },
  eventBar: { width: 3, minHeight: 44, borderRadius: 3, flexShrink: 0 },
  eventTimeCol: { width: 56, textAlign: 'center', flexShrink: 0 },
  eventTime: { fontSize: 13, fontWeight: 800, color: '#0f172a' },
  eventDuration: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  eventTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  eventSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  eventMetaRow: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  metaPill: { fontSize: 10, fontWeight: 700, color: '#8a6a2f', background: '#fbf4e4', borderRadius: 999, padding: '3px 8px' },
  editedPill: { fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 999, padding: '2px 7px' },
  notificationRow: { display: 'flex', gap: 6, marginTop: 8, fontSize: 12 },
  compactRow: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(5,11,20,0.08)', borderRadius: 14, background: '#fbfcfd', padding: '10px 14px', cursor: 'pointer' },
  compactTime: { width: 42, fontSize: 12, fontWeight: 800, color: '#0f172a', textAlign: 'center' },
  groupHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  groupTitle: { fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' },
  groupBadge: { background: '#fbf4e4', color: '#8a6a2f', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  emptyListCard: { background: '#fff', border: '1px dashed #dbe3ea', borderRadius: 18, padding: 18, color: '#94a3b8', fontSize: 13 },
  kanbanWrap: { display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10 },
  kanbanColumn: { width: 220, flexShrink: 0 },
  kanbanHeader: { background: '#fff', border: '1px solid rgba(5,11,20,0.08)', borderRadius: 16, textAlign: 'center', padding: '10px 8px', marginBottom: 8 },
  kanbanHeaderToday: { background: '#050b14', borderColor: '#050b14' },
  kanbanHeaderWeekday: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' },
  kanbanHeaderWeekdayToday: { color: 'rgba(255,255,255,.75)' },
  kanbanHeaderDay: { fontSize: 24, fontWeight: 800, color: '#0f172a' },
  kanbanHeaderDayToday: { color: '#fff' },
  kanbanDropzone: { minHeight: 220, borderRadius: 16, background: '#f8fafb', padding: 8, border: '1px dashed #dbe4f0' },
  emptyKanban: { color: '#94a3b8', fontSize: 12, textAlign: 'center', paddingTop: 20 },
  kanbanCard: { background: '#fff', border: '1px solid', borderRadius: 14, padding: '10px 12px', marginBottom: 8, cursor: 'grab' },
  kanbanTime: { fontSize: 11, fontWeight: 800, color: '#8a6a2f' },
  kanbanTitle: { fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 3 },
  kanbanMeta: { fontSize: 11, color: '#64748b', marginTop: 4 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 200 },
  modal: { width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 24, boxShadow: '0 30px 60px rgba(0,0,0,.24)' },
  modalMobile: { maxWidth: '100%', borderRadius: 20 },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #edf1f4' },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#0f172a' },
  closeButton: { border: 'none', background: 'transparent', fontSize: 28, lineHeight: 1, cursor: 'pointer', color: '#94a3b8' },
  tabRow: { display: 'flex', gap: 4, padding: 12, background: '#f8fafb' },
  modalTab: { border: 'none', background: 'transparent', padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#64748b', cursor: 'pointer' },
  modalTabActive: { background: '#fff', color: '#0f172a', boxShadow: '0 1px 3px rgba(0,0,0,.08)' },
  modalBody: { padding: 22, display: 'flex', flexDirection: 'column', gap: 14 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formGridMobile: { gridTemplateColumns: '1fr' },
  label: { fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 },
  input: { width: '100%', border: '1px solid rgba(5,11,20,0.1)', borderRadius: 14, padding: '11px 13px', fontSize: 14, outline: 'none' },
  notificationBlock: { border: '1px solid rgba(5,11,20,0.08)', borderRadius: 18, padding: 16, background: '#fafbfd' },
  notificationTitle: { fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10 },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: '#374151' },
  toggle: { width: 42, height: 24, border: 'none', borderRadius: 999, background: '#e2e8f0', position: 'relative', cursor: 'pointer' },
  toggleOn: { background: '#050b14' },
  toggleKnob: { position: 'absolute', top: 4, left: 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'all .15s ease' },
  toggleKnobOn: { left: 22 },
  timeline: { display: 'flex', flexDirection: 'column', gap: 14 },
  timelineItem: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  timelineDot: { width: 28, height: 28, borderRadius: '50%', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  timelineTitle: { fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' },
  timelineBody: { fontSize: 12, color: '#64748b', marginTop: 3 },
  timelineTime: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  oldValue: { color: '#94a3b8' },
  newValue: { color: '#0f172a', fontWeight: 700 },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 22px 22px' },
  toast: { position: 'fixed', right: 24, bottom: 24, background: '#0f172a', color: '#fff', borderRadius: 16, padding: '12px 16px', fontSize: 13, boxShadow: '0 18px 40px rgba(0,0,0,.25)', zIndex: 220 },
  emptyState: { border: '1px dashed #dbe3ea', borderRadius: 18, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 },
}
