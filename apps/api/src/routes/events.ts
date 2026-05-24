import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'
import { scheduleEventNotifications, cancelEventNotifications } from '../services/notifications'

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  category: z.enum(['trabalho', 'cliente', 'pessoal', 'juridico', 'gestao']).default('trabalho'),
  recurring: z.boolean().default(false),
  notifPush: z.boolean().default(true),
  notifEmail: z.boolean().default(false),
  notifWhatsapp: z.boolean().default(false),
  notifAdvance: z.number().int().default(30),
})

const eventHistoryFields = [
  'title',
  'location',
  'startAt',
  'durationMinutes',
  'category',
  'notifPush',
  'notifEmail',
  'notifWhatsapp',
  'notifAdvance',
] as const

function userId(req: any): string {
  return (req.user as { sub: string }).sub
}

export async function eventRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // Listar
  app.get('/', auth, async (req) => {
    const { from, to } = req.query as any
    const events = await prisma.event.findMany({
      where: {
        userId: userId(req),
        ...(from && to
          ? { startAt: { gte: new Date(from), lte: new Date(to) } }
          : {}),
      },
      include: { history: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { startAt: 'asc' },
    })
    return {
      data: events.map((e: any) => ({ ...e, hasHistory: e.history.length > 0 })),
    }
  })

  // Buscar um
  app.get('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await prisma.event.findFirst({
      where: { id, userId: userId(req) },
      include: { history: { orderBy: { createdAt: 'desc' } } },
    })
    if (!event) return reply.code(404).send({ error: 'Não encontrado' })
    return { data: { ...event, hasHistory: event.history.length > 0 } }
  })

  // Criar
  app.post('/', auth, async (req, reply) => {
    const body = eventSchema.parse(req.body)
    const event = await prisma.event.create({
      data: { ...body, userId: userId(req) },
    })
    await scheduleEventNotifications(event)
    reply.code(201)
    return { data: event }
  })

  const updateEvent = async (req: any, reply: any) => {
    const { id } = req.params as { id: string }
    const uid = userId(req)
    const original = await prisma.event.findFirst({ where: { id, userId: uid } })
    if (!original) return reply.code(404).send({ error: 'Não encontrado' })

    const body = eventSchema.partial().parse(req.body)
    const historyData = eventHistoryFields
      .filter(
        (field) => body[field] !== undefined && String(original[field]) !== String(body[field])
      )
      .map((field) => ({
        eventId: id,
        field,
        oldValue: String(original[field] ?? ''),
        newValue: String(body[field] ?? ''),
        userId: uid,
      }))

    let updatedEvent

    if (historyData.length > 0) {
      const [, , result] = await prisma.$transaction([
        prisma.event.update({ where: { id }, data: body }),
        prisma.eventHistory.createMany({ data: historyData }),
        prisma.event.findUniqueOrThrow({
          where: { id },
          include: { history: { orderBy: { createdAt: 'desc' } } },
        }),
      ])
      updatedEvent = result
    } else {
      const [, result] = await prisma.$transaction([
        prisma.event.update({ where: { id }, data: body }),
        prisma.event.findUniqueOrThrow({
          where: { id },
          include: { history: { orderBy: { createdAt: 'desc' } } },
        }),
      ])
      updatedEvent = result
    }

    await cancelEventNotifications(id)
    await scheduleEventNotifications(updatedEvent)

    return { data: updatedEvent }
  }

  // Editar
  app.put('/:id', auth, updateEvent)
  app.patch('/:id', auth, updateEvent)

  // Remover
  app.delete('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await prisma.event.findFirst({ where: { id, userId: userId(req) } })
    if (!event) return reply.code(404).send({ error: 'Não encontrado' })
    await cancelEventNotifications(id)
    await prisma.event.delete({ where: { id } })
    reply.code(204).send()
  })

  // Histórico
  app.get('/:id/history', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await prisma.event.findFirst({ where: { id, userId: userId(req) } })
    if (!event) return reply.code(404).send({ error: 'Não encontrado' })
    const history = await prisma.eventHistory.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'desc' },
    })
    return { data: history }
  })
}
