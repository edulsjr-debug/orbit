import { prisma } from '@orbit/database'
import { Resend } from 'resend'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
  badge?: string
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY nao configurada.')
  }

  return new Resend(process.env.RESEND_API_KEY)
}

export async function scheduleEventNotifications(event: any) {
  const channels: string[] = []
  if (event.notifInApp) channels.push('in_app')
  if (event.notifPush) channels.push('push')
  if (event.notifEmail) channels.push('email')
  if (event.notifWhatsapp) channels.push('whatsapp')

  if (channels.length === 0) return

  const scheduledAt = new Date(event.startAt)
  scheduledAt.setMinutes(scheduledAt.getMinutes() - event.notifAdvance)

  await prisma.notificationJob.createMany({
    data: channels.map((channel) => ({
      eventId: event.id,
      channel,
      scheduledAt,
      status: 'pending',
    })),
  })
}

export async function cancelEventNotifications(eventId: any) {
  await prisma.notificationJob.updateMany({
    where: { eventId, status: 'pending' },
    data: { status: 'cancelled' },
  })
}

export async function sendPushNotification(userId: string, payload: PushPayload) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushSub: true },
  })
  if (!user?.pushSub) return

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY nao configuradas.')
  }

  const subscription = JSON.parse(user.pushSub)
  const webpushModule = await import('web-push')
  const webpush = ('default' in webpushModule ? webpushModule.default : webpushModule) as {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void
    sendNotification: (subscription: unknown, body?: string) => Promise<unknown>
  }

  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL ?? 'admin@orbit.app'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await prisma.user.update({
        where: { id: userId },
        data: { pushSub: null },
      })
    }

    console.error('Falha ao enviar push:', err)
    throw err
  }
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const resend = getResendClient()
    await resend.emails.send({
      from: 'Orbit <notificacoes@orbit.app>',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('Falha ao enviar email:', err)
  }
}

export async function sendEmailNotification(email: string, subject: string, html: string) {
  await sendEmail(email, subject, html)
}

export async function createInAppNotification(
  userId: string,
  title: string,
  body: string,
  channel: string,
  entityType?: string,
  entityId?: string
) {
  return prisma.notification.create({
    data: { userId, title, body, channel, entityType, entityId },
  })
}
