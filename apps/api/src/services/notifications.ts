import { prisma } from '@orbit/database'
import type { Event } from '@orbit/database'

// Agenda jobs de notificação para um compromisso
export async function scheduleEventNotifications(event: Event) {
  const channels: string[] = []
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

// Cancela jobs pendentes de um compromisso
export async function cancelEventNotifications(eventId: string) {
  await prisma.notificationJob.updateMany({
    where: { eventId, status: 'pending' },
    data: { status: 'cancelled' },
  })
}

// Envia push notification via Web Push API
export async function sendPushNotification(userId: string, title: string, body: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushSub: true },
  })
  if (!user?.pushSub) return

  try {
    const webpush = await import('web-push')
    webpush.setVapidDetails(
      'mailto:' + (process.env.VAPID_EMAIL ?? 'admin@orbit.app'),
      process.env.VAPID_PUBLIC_KEY ?? '',
      process.env.VAPID_PRIVATE_KEY ?? ''
    )
    await webpush.sendNotification(
      JSON.parse(user.pushSub),
      JSON.stringify({ title, body })
    )
  } catch (err) {
    console.error('Falha ao enviar push:', err)
  }
}

// Envia email via Resend
export async function sendEmailNotification(email: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'Orbit <noreply@orbit.app>',
      to: email,
      subject,
      html,
    })
  } catch (err) {
    console.error('Falha ao enviar email:', err)
  }
}

// Salva notificação no banco (sininho interno)
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
