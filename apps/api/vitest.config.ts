import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@orbit/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/services/__tests__/setup.ts'],
    pool: 'vmThreads',
  },
})
