import { prisma } from '@orbit/database'
import {
  createInAppNotification,
  sendEmailNotification,
  sendPushNotification,
} from '../services/notifications'

const INTERVAL_MS = 60_000

function buildEventNotificationContent(event: {
  id: string
  title: string
  description: string | null
  location: string | null
  notifAdvance: number
}) {
  const fallback = `Comeca em ${event.notifAdvance} min${event.location ? ` • ${event.location}` : ''}`
  const body = event.description?.trim() || fallback

  return {
    title: event.title,
    body,
    url: '/compromissos',
    tag: `event-${event.id}`,
    emailSubject: `Lembrete: ${event.title}`,
  }
}

async function processJobs() {
  const now = new Date()

  const jobs = await prisma.notificationJob.findMany({
    where: { status: 'pending', scheduledAt: { lte: now } },
    include: {
      event: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  })

  if (jobs.length === 0) return

  console.log(`[worker] Processando ${jobs.length} job(s) de notificacao`)

  for (const job of jobs) {
    const { event } = job
    const user = event.user
    const content = buildEventNotificationContent(event)

    try {
      if (job.channel === 'push') {
        await sendPushNotification(user.id, {
          title: content.title,
          body: content.body,
          url: content.url,
          tag: content.tag,
        })
      } else if (job.channel === 'email') {
        await sendEmailNotification(
          user.email,
          content.emailSubject,
          `<p>Ola, <strong>${user.name}</strong>!</p><p>${content.body}</p>`
        )
      } else if (job.channel === 'in_app') {
        await createInAppNotification(
          user.id,
          content.title,
          content.body,
          'in_app',
          'event',
          event.id
        )
      }

      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: 'sent', sentAt: new Date() },
      })
    } catch (err) {
      console.error(`[worker] Falha no job ${job.id}:`, err)
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: 'failed' },
      })
    }
  }
}

export function startNotificationWorker() {
  processJobs()
  setInterval(processJobs, INTERVAL_MS)
  console.log('[worker] Notification worker iniciado (intervalo: 1 min)')
}
