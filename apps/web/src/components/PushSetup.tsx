'use client'

import { useEffect } from 'react'
import { registerSW, subscribePush } from '@/lib/push'

export function PushSetup() {
  useEffect(() => {
    async function setupPush() {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      await registerSW()

      const registration = await navigator.serviceWorker.ready
      const existingSubscription = await registration.pushManager.getSubscription()
      if (existingSubscription) return

      const vapidResponse = await fetch('/api/push/vapid-key', {
        credentials: 'include',
      })
      const vapidData = await vapidResponse.json().catch(() => ({}))
      const vapidPublicKey =
        vapidData.publicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) return

      const subscription = await subscribePush(vapidPublicKey)
      if (!subscription) return

      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
    }

    setupPush().catch((err) => {
      console.error('Falha ao configurar push:', err)
    })
  }, [])

  return null
}
