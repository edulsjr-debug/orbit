import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'
import { createHash, randomBytes } from 'crypto'
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/notifications.js'
import { OAuth2Client } from 'google-auth-library'

const hashPassword = (pw: string) =>
  createHash('sha256').update(pw + (process.env.SALT ?? 'orbit-salt')).digest('hex')

export function generateRandomPassword(length = 8): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const limit = 256 - (256 % charset.length) // 248 — elimina modulo bias
  const result: string[] = []
  while (result.length < length) {
    const byte = randomBytes(1)[0]
    if (byte < limit) result.push(charset[byte % charset.length])
  }
  return result.join('')
}

export async function authRoutes(app: FastifyInstance) {
  // Registro
  app.post('/register', async (req, reply) => {
    const body = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string().optional(),
    }).parse(req.body)

    const exists = await prisma.user.findUnique({ where: { email: body.email } })
    if (exists) return reply.code(409).send({ error: 'E-mail já cadastrado' })

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashPassword(body.password),
        phone: body.phone,
      },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    })

    const token = app.jwt.sign({ sub: user.id, email: user.email })
    reply.setCookie('orbit_token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 })

    // fire-and-forget — não bloqueia o cadastro
    sendWelcomeEmail(user.email, user.name).catch((err: unknown) =>
      app.log.error({ err }, 'Falha ao enviar email de boas-vindas')
    )

    return { data: user }
  })

  // Login
  app.post('/login', async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse(req.body)

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, name: true, email: true, phone: true, password: true, createdAt: true },
    })

    if (!user || user.password !== hashPassword(body.password)) {
      return reply.code(401).send({ error: 'E-mail ou senha incorretos' })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email })
    reply.setCookie('orbit_token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 })

    const { password: _, ...safe } = user
    return { data: safe }
  })

  // Recuperar senha
  app.post('/forgot-password', async (req, reply) => {
    const body = z.object({ email: z.string().email() }).parse(req.body)

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true },
    })

    if (!user) return { ok: true }

    const newPassword = generateRandomPassword()
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(newPassword) },
    })

    sendPasswordResetEmail(body.email, newPassword).catch((err: unknown) =>
      app.log.error({ err }, 'Falha ao enviar email de recuperação de senha')
    )

    return { ok: true }
  })

  // Perfil
  app.get('/me', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    })

    if (!user) {
      return reply.code(404).send({ error: 'Usuário não encontrado' })
    }

    return { data: user }
  })

  // Logout
  app.post('/logout', async (_req, reply) => {
    reply.clearCookie('orbit_token', { path: '/' })
    return { message: 'Logout realizado' }
  })

  // Atualizar perfil (aceita PUT e PATCH)
  const updateMe = { onRequest: [(app as any).authenticate] }
  const updateMeHandler = async (request: any, reply: any) => {
    const userId = (request.user as { sub: string }).sub
    const body = z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
    }).parse(request.body)

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado' })

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: body,
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    })

    return { data: updatedUser }
  }

  app.put('/me', updateMe, updateMeHandler)
  app.patch('/me', updateMe, updateMeHandler)

  // Login com Google
  app.post('/google', async (req, reply) => {
    const { credential } = z.object({ credential: z.string().max(4096) }).parse(req.body)

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) return reply.code(500).send({ error: 'Google login não configurado' })
    const client = new OAuth2Client(clientId)

    let payload
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
      payload = ticket.getPayload()
    } catch {
      return reply.code(401).send({ error: 'Token Google inválido' })
    }

    if (!payload?.sub || !payload?.email) {
      return reply.code(401).send({ error: 'Token Google inválido' })
    }

    const { sub: googleId, email, name = email } = payload

    // 1. Busca por googleId (já vinculado)
    let user = await prisma.user.findUnique({
      where: { googleId },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    })

    // 2. Busca por email — vincula se encontrar
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { googleId },
          select: { id: true, name: true, email: true, phone: true, createdAt: true },
        })
      }
    }

    // 3. Cria novo usuário
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, googleId, password: null },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email })
    reply.setCookie('orbit_token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 })

    return { data: user }
  })
}
