import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@orbit/database'
import { createHash } from 'crypto'

const hashPassword = (pw: string) =>
  createHash('sha256').update(pw + (process.env.SALT ?? 'orbit-salt')).digest('hex')

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

    return user
  })

  // Logout
  app.post('/logout', async (_req, reply) => {
    reply.clearCookie('orbit_token', { path: '/' })
    return { message: 'Logout realizado' }
  })

  // Atualizar perfil
  app.put('/me', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const body = z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
    }).parse(request.body)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return reply.code(404).send({ error: 'Usuário não encontrado' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: body,
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    })

    return updatedUser
  })
}
