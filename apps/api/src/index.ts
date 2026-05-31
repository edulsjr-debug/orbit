import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { authRoutes } from './routes/auth'
import { eventRoutes } from './routes/events'
import { taskRoutes } from './routes/tasks'
import { projectRoutes } from './routes/projects'
import { notificationRoutes } from './routes/notifications'
import { pushRoutes } from './routes/push'
import { startNotificationWorker } from './jobs/notificationWorker'

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
  ]
  const envPath = candidates.find((candidate) => existsSync(candidate))
  if (!envPath) return

  const content = readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadEnvFile()

const app = Fastify({ logger: { level: 'info' } })

async function bootstrap() {
  await app.register(cors, {
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  })

  await app.register(cookie)

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'orbit-dev-secret-change-in-prod',
    cookie: { cookieName: 'orbit_token', signed: false },
  })

  // Decorator: autenticar request
  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.code(401).send({ error: 'Não autenticado' })
    }
  })

  // Rotas
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(eventRoutes, { prefix: '/events' })
  await app.register(taskRoutes, { prefix: '/tasks' })
  await app.register(projectRoutes, { prefix: '/projects' })
  await app.register(notificationRoutes, { prefix: '/notifications' })
  await app.register(pushRoutes, { prefix: '/push' })

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`API rodando em http://localhost:${port}`)

  startNotificationWorker()
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
