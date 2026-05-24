import { prisma } from '@orbit/database'
import type { Event } from '@orbit/database'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

export async function sendEmail(to: string, subject: string, html: string) {
  try {
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

// Envia email via Resend
export async function sendEmailNotification(email: string, subject: string, html: string) {
  await sendEmail(email, subject, html)
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
