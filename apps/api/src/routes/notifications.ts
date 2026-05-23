import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'

function userId(req: any): string {
  return (req.user as { sub: string }).sub
}

export async function notificationRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // Listar notificações do usuário
  app.get('/', auth, async (req) => {
    const { channel, read } = req.query as any
    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId(req),
        ...(channel ? { channel } : {}),
        ...(read !== undefined ? { read: read === 'true' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { data: notifications }
  })

  // Contagem de não lidas
  app.get('/unread-count', auth, async (req) => {
    const count = await prisma.notification.count({
      where: { userId: userId(req), read: false },
    })
    return { data: { count } }
  })

  // Marcar como lida
  app.patch('/:id/read', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const notif = await prisma.notification.findFirst({
      where: { id, userId: userId(req) },
    })
    if (!notif) return reply.code(404).send({ error: 'Não encontrado' })
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    })
    return { data: updated }
  })

  // Marcar todas como lidas
  app.post('/read-all', auth, async (req) => {
    await prisma.notification.updateMany({
      where: { userId: userId(req), read: false },
      data: { read: true },
    })
    return { message: 'Todas marcadas como lidas' }
  })

  // Registrar subscription de push (Web Push API)
  app.post('/push-subscribe', auth, async (req) => {
    const body = z.object({ subscription: z.string() }).parse(req.body)
    await prisma.user.update({
      where: { id: userId(req) },
      data: { pushSub: body.subscription },
    })
    return { message: 'Push subscription registrado' }
  })
}
