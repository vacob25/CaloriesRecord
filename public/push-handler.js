// Gestori di push e click sulla notifica (ADR-086). Caricato dal service worker generato da vite-plugin-pwa
// (workbox.importScripts). Niente codice dell'app qui: solo ciò che serve a mostrare e aprire una notifica.
//
// Il testo arriva dai server di Apple/Google, quindi il payload è sempre generico (mai peso, calorie, cibi).

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = typeof data.title === 'string' && data.title !== '' ? data.title : 'Calorie'
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    // Solo percorsi interni all'app: il click non deve mai aprire un indirizzo esterno.
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url : '/' },
  }
  // iOS richiede che ogni push mostri una notifica (userVisibleOnly): la mostriamo sempre.
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
