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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const audio = new Audio('/notification.wav')
    audio.preload = 'auto'

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'ORBIT_PUSH_RECEIVED') return

      audio.currentTime = 0
      audio.play().catch(() => {})
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  return null
}
