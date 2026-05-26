function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

function pushErrorMessage(error: unknown) {
  const fallback = 'Nao foi possivel ativar as notificacoes push.'
  if (!(error instanceof Error)) return fallback

  const message = error.message.toLowerCase()
  const name = error.name.toLowerCase()

  if (
    name.includes('notallowed') ||
    message.includes('permission denied') ||
    message.includes('registration failed') ||
    message.includes('denied')
  ) {
    return 'As notificacoes estao bloqueadas no navegador ou no sistema. Libere a permissao do site e tente novamente.'
  }

  if (name.includes('invalidstate')) {
    return 'O navegador recusou a inscricao push atual. Recarregue a pagina e tente novamente.'
  }

  if (name.includes('abort')) {
    return 'A ativacao do push foi interrompida pelo navegador. Tente novamente em alguns segundos.'
  }

  return error.message || fallback
}

export async function registerSW() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function subscribePush(vapidPublicKey: string) {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  if (Notification.permission === 'denied') {
    throw new Error(
      'As notificacoes estao bloqueadas no navegador. Libere a permissao do site para continuar.'
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) {
    return existingSubscription.toJSON()
  }

  let subscription

  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  } catch (error) {
    throw new Error(pushErrorMessage(error))
  }

  return subscription.toJSON()
}

export async function unsubscribePush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) return true
  return subscription.unsubscribe()
}
