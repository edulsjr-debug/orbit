import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'

function userId(req: any): string {
  return (req.user as { sub: string }).sub
}

export async function pushRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.get('/vapid-key', async () => ({
    publicKey: process.env.VAPID_PUBLIC_KEY,
  }))

  app.post('/subscribe', auth, async (req) => {
    const subscription = z.record(z.any()).parse(req.body)

    await prisma.user.update({
      where: { id: userId(req) },
      data: { pushSub: JSON.stringify(subscription) },
    })

    return { success: true }
  })

  app.delete('/subscribe', auth, async (req) => {
    await prisma.user.update({
      where: { id: userId(req) },
      data: { pushSub: null },
    })

    return { success: true }
  })
}
