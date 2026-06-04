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
      from: process.env.EMAIL_FROM ?? 'Orbit <noreply@prumosaas.com.br>',
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

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const safeName = name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  await sendEmail(
    to,
    'Bem-vindo ao Orbit',
    `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
body{font-family:Inter,sans-serif;background:#fff;color:#0D0D0D;margin:0;padding:0}
.c{max-width:520px;margin:0 auto;padding:48px 32px}
.logo{font-size:11px;font-weight:600;letter-spacing:.2em;color:#B8924F;margin-bottom:40px}
h1{font-size:22px;font-weight:400;letter-spacing:-.02em;margin-bottom:16px}
p{font-size:14px;line-height:1.7;color:#555;margin-bottom:12px}
.btn{display:inline-block;margin-top:24px;padding:12px 24px;background:#0D0D0D;color:#F5F2EC;text-decoration:none;font-size:12px;letter-spacing:.08em;font-weight:500}
.ft{margin-top:48px;padding-top:24px;border-top:1px solid #eee;font-size:11px;color:#999}
a.gold{color:#B8924F;text-decoration:none}
</style></head>
<body>
  <div class="c">
    <div class="logo">| ORBIT</div>
    <h1>Bem-vindo, ${safeName}.</h1>
    <p>Sua conta no Orbit está pronta.</p>
    <p>Comece criando seus primeiros compromissos e veja como fica mais fácil organizar a semana da sua equipe.</p>
    <a href="https://orbit.prumosaas.com.br" class="btn">→ Acessar o Orbit</a>
    <div class="ft">
      orbit.prumosaas.com.br &nbsp;·&nbsp;
      <a href="https://prumosaas.com.br" class="gold">Prumo Software</a>
    </div>
  </div>
</body>
</html>`
  )
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
