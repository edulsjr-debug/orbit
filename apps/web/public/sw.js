self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || 'Orbit'
  const body = payload.body || ''
  const icon = payload.icon || '/icon-192.png'
  const badge = '/icon-192.png'
  const url = payload.url || '/dashboard'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      sound: '/notification.wav',
      vibrate: [200, 100, 200],
      tag: 'orbit-notif',
      renotify: true,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
