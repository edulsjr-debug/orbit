import { describe, it, expect } from 'vitest'
import { generateRandomPassword } from '../auth.js'

describe('generateRandomPassword', () => {
  it('gera senha com exatamente 8 caracteres', () => {
    const pw = generateRandomPassword()
    expect(pw).toHaveLength(8)
  })

  it('usa apenas charset A-Z a-z 0-9', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateRandomPassword()
      expect(pw).toMatch(/^[A-Za-z0-9]{8}$/)
    }
  })

  it('gera senhas diferentes a cada chamada', () => {
    const senhas = new Set(Array.from({ length: 20 }, () => generateRandomPassword()))
    expect(senhas.size).toBeGreaterThan(15)
  })
})
