import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().default('#6366f1'),
  emoji: z.string().default('📁'),
  deadline: z.string().datetime().optional(),
})

const projectHistoryFields = [
  'name',
  'description',
  'color',
  'emoji',
  'deadline',
] as const

function userId(req: any): string {
  return (req.user as { sub: string }).sub
}

export async function projectRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.get('/', auth, async (req) => {
    const projects = await prisma.project.findMany({
      where: { userId: userId(req) },
      include: {
        tasks: { select: { id: true, status: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })
    return {
      data: projects.map((p: any) => ({
        ...p,
        taskCount: p.tasks.length,
        taskDone: p.tasks.filter((t: any) => t.status === 'done').length,
        hasHistory: p.history.length > 0,
      })),
    }
  })

  app.get('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const project = await prisma.project.findFirst({
      where: { id, userId: userId(req) },
      include: {
        tasks: true,
        history: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!project) return reply.code(404).send({ error: 'Não encontrado' })
    return { data: { ...project, hasHistory: project.history.length > 0 } }
  })

  app.post('/', auth, async (req, reply) => {
    const body = projectSchema.parse(req.body)
    const project = await prisma.project.create({ data: { ...body, userId: userId(req) } })
    reply.code(201)
    return { data: project }
  })

  const updateProject = async (req: any, reply: any) => {
    const { id } = req.params as { id: string }
    const uid = userId(req)
    const original = await prisma.project.findFirst({ where: { id, userId: uid } })
    if (!original) return reply.code(404).send({ error: 'Não encontrado' })

    const body = projectSchema.partial().parse(req.body)
    const historyData = projectHistoryFields
      .filter(
        (field) => body[field] !== undefined && String(original[field]) !== String(body[field])
      )
      .map((field) => ({
        projectId: id,
        field,
        oldValue: String(original[field] ?? ''),
        newValue: String(body[field] ?? ''),
        userId: uid,
      }))

    let updatedProject

    if (historyData.length > 0) {
      const [, , result] = await prisma.$transaction([
        prisma.project.update({ where: { id }, data: body }),
        prisma.projectHistory.createMany({ data: historyData }),
        prisma.project.findUniqueOrThrow({
          where: { id },
          include: {
            tasks: true,
            history: { orderBy: { createdAt: 'desc' } },
          },
        }),
      ])
      updatedProject = result
    } else {
      const [, result] = await prisma.$transaction([
        prisma.project.update({ where: { id }, data: body }),
        prisma.project.findUniqueOrThrow({
          where: { id },
          include: {
            tasks: true,
            history: { orderBy: { createdAt: 'desc' } },
          },
        }),
      ])
      updatedProject = result
    }

    return { data: updatedProject }
  }

  app.put('/:id', auth, updateProject)
  app.patch('/:id', auth, updateProject)

  app.delete('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const project = await prisma.project.findFirst({ where: { id, userId: userId(req) } })
    if (!project) return reply.code(404).send({ error: 'Não encontrado' })
    await prisma.project.delete({ where: { id } })
    reply.code(204).send()
  })

  app.get('/:id/history', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const project = await prisma.project.findFirst({ where: { id, userId: userId(req) } })
    if (!project) return reply.code(404).send({ error: 'Não encontrado' })
    const history = await prisma.projectHistory.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    })
    return { data: history }
  })
}
