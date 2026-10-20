import { readVapidPublicKey, parseSubscription, pushState, testResultSchema, urlBase64ToUint8Array, type PushState, type TestResult } from '../lib/push'
import { DataError } from './dbErrors'
import { getSupabase } from './supabase'

// Notifiche push (Fase 1, ADR-086). Il browser dà una "subscription"; la salviamo (RLS: solo la propria) e la
// Edge Function send-test-push la usa per mandare la prova.

const vapidPublicKey = readVapidPublicKey(import.meta.env)

function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ si presenta come "Macintosh" ma ha il touch.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** Stato delle notifiche su questo dispositivo, per la sezione del Profilo. */
export async function readPushState(): Promise<PushState> {
  return pushState({
    configured: vapidPublicKey !== null,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos: isIos(),
    isStandalone: isStandalone(),
    permission: 'Notification' in window ? Notification.permission : 'unavailable',
    subscribed: (await currentSubscription()) !== null,
  })
}

/**
 * Chiede il permesso (deve partire da un tocco: iOS lo richiede), iscrive il dispositivo e salva la subscription.
 * Se il salvataggio fallisce l'iscrizione nel browser viene annullata, così lo stato mostrato resta quello vero.
 */
export async function enablePush(): Promise<void> {
  if (vapidPublicKey === null) throw new DataError('Le notifiche non sono configurate in questa versione dell’app.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new DataError('Permesso negato: puoi cambiarlo nelle impostazioni di iPhone.')

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }))
  const parsed = parseSubscription(subscription.toJSON())
  if (parsed === null) {
    await subscription.unsubscribe()
    throw new DataError('Il dispositivo ha dato una subscription non valida. Riprova.')
  }
  const { error } = await getSupabase()
    .from('push_subscriptions')
    .upsert({ endpoint: parsed.endpoint, p256dh_key: parsed.p256dhKey, auth_secret: parsed.authSecret }, { onConflict: 'user_id,endpoint' })
  if (error) {
    await subscription.unsubscribe()
    throw new DataError('Non sono riuscito a salvare l’attivazione. Riprova.')
  }
}

/** Disattiva su questo dispositivo: cancella la riga e annulla l'iscrizione nel browser. */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (subscription === null) return
  const { error } = await getSupabase().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  if (error) throw new DataError('Non sono riuscito a disattivare le notifiche. Riprova.')
  await subscription.unsubscribe()
}

const LOGOUT_TIMEOUT_MS = 3000

/**
 * All'uscita toglie solo la subscription di QUESTO dispositivo (gli altri dispositivi dell'utente restano). Va chiamata
 * prima di `signOut`, finché la sessione c'è. Best effort: con poco tempo o senza rete si lascia perdere, e la riga
 * orfana viene eliminata dalla funzione al primo invio che riceve 404/410.
 */
export async function removeThisDeviceSubscription(): Promise<void> {
  try {
    const work = (async () => {
      const subscription = await currentSubscription()
      if (subscription === null) return
      await getSupabase().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      await subscription.unsubscribe()
    })()
    await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, LOGOUT_TIMEOUT_MS))])
  } catch {
    // Mai bloccare l'uscita per le notifiche.
  }
}

/** Chiede alla Edge Function di mandare la notifica di prova ai dispositivi dell'utente. */
export async function sendTestPush(): Promise<TestResult> {
  const { data, error } = await getSupabase().functions.invoke('send-test-push', { method: 'POST' })
  if (error) throw new DataError('Non sono riuscito a mandare la prova. Controlla la connessione e riprova.')
  const parsed = testResultSchema.safeParse(data)
  if (!parsed.success) throw new DataError('Risposta inattesa dal server. Riprova.')
  return parsed.data
}
