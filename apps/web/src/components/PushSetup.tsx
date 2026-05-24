'use client'

import { useEffect } from 'react'
import { registerSW } from '@/lib/push'

// Registra o service worker silenciosamente no boot.
// A subscrição de push é feita via botão na página de Configurações.
export function PushSetup() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    registerSW().catch(() => {})
  }, [])

  return null
}
