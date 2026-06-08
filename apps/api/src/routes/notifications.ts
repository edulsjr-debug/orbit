import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'
import { sendPushNotification } from '../services/notifications'

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

  // Diagnóstico e teste de push
  app.get('/push-debug', auth, async (req) => {
    const uid = userId(req)
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { pushSub: true },
    })
    const pendingJobs = await prisma.notificationJob.count({
      where: { status: 'pending' },
    })
    const failedJobs = await prisma.notificationJob.count({
      where: { status: 'failed' },
    })
    return {
      hasPushSub: !!user?.pushSub,
      vapidPublicKey: !!process.env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
      pendingJobs,
      failedJobs,
    }
  })

  app.post('/push-test', auth, async (req, reply) => {
    const uid = userId(req)
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { pushSub: true },
    })
    if (!user?.pushSub) {
      return reply.code(400).send({ error: 'Nenhuma subscription salva para este usuário' })
    }
    try {
      await sendPushNotification(uid, {
        title: 'Teste Orbit',
        body: 'Push funcionando corretamente!',
        url: '/notificacoes',
        tag: 'orbit-push-test',
      })
      return { ok: true, message: 'Push enviado' }
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message ?? 'Erro ao enviar push' })
    }
  })
}
