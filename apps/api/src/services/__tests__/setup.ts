import { vi } from 'vitest'

vi.mock('@orbit/database', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
    notificationJob: { createMany: vi.fn(), updateMany: vi.fn() },
  },
}))
