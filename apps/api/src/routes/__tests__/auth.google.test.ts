import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { authRoutes } from '../auth.js'

const mockVerifyIdToken = vi.hoisted(() => vi.fn())

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: function OAuth2Client() {
      return { verifyIdToken: mockVerifyIdToken }
    },
  }
})

const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
vi.mock('@orbit/database', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}))

async function buildApp() {
  const app = Fastify()
  await app.register(cookie)
  await app.register(jwt, { secret: 'test-secret' })
  app.decorate('authenticate', async (req: any) => { await req.jwtVerify() })
  await app.register(authRoutes)
  await app.ready()
  return app
}

describe('POST /google', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  })

  it('cria novo usuário quando email não existe', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'gid-123', email: 'novo@teste.com', name: 'Novo User' }),
    })
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: 'user-1',
      name: 'Novo User',
      email: 'novo@teste.com',
      phone: null,
      createdAt: new Date('2026-01-01'),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/google',
      payload: { credential: 'fake-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.email).toBe('novo@teste.com')
    expect(res.cookies.find((c: any) => c.name === 'orbit_token')).toBeDefined()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ googleId: 'gid-123', email: 'novo@teste.com' }),
      })
    )
  })

  it('vincula googleId a usuário existente pelo email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'gid-456', email: 'existente@teste.com', name: 'Existente' }),
    })
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-2',
        name: 'Existente',
        email: 'existente@teste.com',
        phone: null,
        createdAt: new Date('2026-01-01'),
      })
    mockUpdate.mockResolvedValue({
      id: 'user-2',
      name: 'Existente',
      email: 'existente@teste.com',
      phone: null,
      createdAt: new Date('2026-01-01'),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/google',
      payload: { credential: 'fake-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { googleId: 'gid-456' },
      select: expect.any(Object),
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 401 para token inválido', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token inválido'))

    const res = await app.inject({
      method: 'POST',
      url: '/google',
      payload: { credential: 'token-ruim' },
    })

    expect(res.statusCode).toBe(401)
  })
})
