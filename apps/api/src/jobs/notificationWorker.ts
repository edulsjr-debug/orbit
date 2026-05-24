import { prisma } from '@orbit/database'
import {
  sendPushNotification,
  sendEmailNotification,
  createInAppNotification,
} from '../services/notifications'

const INTERVAL_MS = 60_000 // roda a cada 1 minuto

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

  console.log(`[worker] Processando ${jobs.length} job(s) de notificação`)

  for (const job of jobs) {
    const { event } = job
    const user = event.user
    const title = `Lembrete: ${event.title}`
    const body = `Começa em ${event.notifAdvance} minuto(s)${event.location ? ` — ${event.location}` : ''}`

    try {
      if (job.channel === 'push') {
        await sendPushNotification(user.id, title, body)
      } else if (job.channel === 'email') {
        await sendEmailNotification(
          user.email,
          title,
          `<p>Olá, <strong>${user.name}</strong>!</p><p>${body}</p>`
        )
      }

      await createInAppNotification(user.id, title, body, job.channel, 'event', event.id)

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
  processJobs() // roda imediatamente no boot
  setInterval(processJobs, INTERVAL_MS)
  console.log('[worker] Notification worker iniciado (intervalo: 1 min)')
}
