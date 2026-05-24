self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || 'Orbit'
  const body = payload.body || ''
  const icon = payload.icon || '/icon-192.png'
  const url = payload.url || '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url)
      }

      return undefined
    })
  )
})
