import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
  projectId: z.string().optional(),
  notifPush: z.boolean().default(true),
  notifEmail: z.boolean().default(false),
})

const taskHistoryFields = [
  'title',
  'description',
  'dueAt',
  'priority',
  'status',
  'projectId',
  'notifPush',
  'notifEmail',
] as const

function userId(req: any): string {
  return (req.user as { sub: string }).sub
}

export async function taskRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.get('/', auth, async (req) => {
    const { status, projectId } = req.query as any
    const tasks = await prisma.task.findMany({
      where: {
        userId: userId(req),
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { priority: 'desc' }],
    })
    return { data: tasks.map((t) => ({ ...t, hasHistory: t.history.length > 0 })) }
  })

  app.get('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const task = await prisma.task.findFirst({
      where: { id, userId: userId(req) },
      include: { history: { orderBy: { createdAt: 'desc' } }, project: true },
    })
    if (!task) return reply.code(404).send({ error: 'Não encontrado' })
    return { data: { ...task, hasHistory: task.history.length > 0 } }
  })

  app.post('/', auth, async (req, reply) => {
    const body = taskSchema.parse(req.body)
    const task = await prisma.task.create({ data: { ...body, userId: userId(req) } })
    reply.code(201)
    return { data: task }
  })

  const updateTask = async (req: any, reply: any) => {
    const { id } = req.params as { id: string }
    const uid = userId(req)
    const original = await prisma.task.findFirst({ where: { id, userId: uid } })
    if (!original) return reply.code(404).send({ error: 'Não encontrado' })

    const body = taskSchema.partial().parse(req.body)
    const historyData = taskHistoryFields
      .filter(
        (field) => body[field] !== undefined && String(original[field]) !== String(body[field])
      )
      .map((field) => ({
        taskId: id,
        field,
        oldValue: String(original[field] ?? ''),
        newValue: String(body[field] ?? ''),
        userId: uid,
      }))

    let updatedTask

    if (historyData.length > 0) {
      const [, , result] = await prisma.$transaction([
        prisma.task.update({ where: { id }, data: body }),
        prisma.taskHistory.createMany({ data: historyData }),
        prisma.task.findUniqueOrThrow({
          where: { id },
          include: {
            project: { select: { id: true, name: true, color: true } },
            history: { orderBy: { createdAt: 'desc' } },
          },
        }),
      ])
      updatedTask = result
    } else {
      const [, result] = await prisma.$transaction([
        prisma.task.update({ where: { id }, data: body }),
        prisma.task.findUniqueOrThrow({
          where: { id },
          include: {
            project: { select: { id: true, name: true, color: true } },
            history: { orderBy: { createdAt: 'desc' } },
          },
        }),
      ])
      updatedTask = result
    }

    return { data: updatedTask }
  }

  app.put('/:id', auth, updateTask)
  app.patch('/:id', auth, updateTask)

  app.delete('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const task = await prisma.task.findFirst({ where: { id, userId: userId(req) } })
    if (!task) return reply.code(404).send({ error: 'Não encontrado' })
    await prisma.task.delete({ where: { id } })
    reply.code(204).send()
  })

  app.get('/:id/history', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const task = await prisma.task.findFirst({ where: { id, userId: userId(req) } })
    if (!task) return reply.code(404).send({ error: 'Não encontrado' })
    const history = await prisma.taskHistory.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
    })
    return { data: history }
  })
}
