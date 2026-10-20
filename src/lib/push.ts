import { z } from 'zod'

// Notifiche push (Fase 1, ADR-086). Qui solo logica pura: niente browser, niente rete.

/** Chiave pubblica VAPID: 65 byte (punto P-256 non compresso) in base64url = 87 caratteri. */
const VAPID_PUBLIC_KEY = /^[A-Za-z0-9_-]{87}$/

/** Legge VITE_VAPID_PUBLIC_KEY. Facoltativa: senza, la sezione notifiche dice "non configurate". */
export function readVapidPublicKey(env: { VITE_VAPID_PUBLIC_KEY?: string }): string | null {
  const value = env.VITE_VAPID_PUBLIC_KEY?.trim() ?? ''
  return VAPID_PUBLIC_KEY.test(value) ? value : null
}

/** base64url → byte, nel formato che `pushManager.subscribe` vuole per `applicationServerKey`. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const subscriptionSchema = z.object({
  endpoint: z.string().startsWith('https://').min(20).max(2048),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
})

export interface ParsedSubscription {
  endpoint: string
  p256dhKey: string
  authSecret: string
}

/** Controlla il risultato di `subscription.toJSON()` prima di salvarlo; null se non è utilizzabile. */
export function parseSubscription(json: unknown): ParsedSubscription | null {
  const parsed = subscriptionSchema.safeParse(json)
  if (!parsed.success) return null
  return { endpoint: parsed.data.endpoint, p256dhKey: parsed.data.keys.p256dh, authSecret: parsed.data.keys.auth }
}

export type PushState =
  | 'not-configured' // manca la chiave VAPID pubblica nella build
  | 'unsupported' // il browser non ha service worker / Push / Notification
  | 'needs-install' // iPhone: le notifiche funzionano solo con l'app aggiunta alla schermata Home
  | 'denied' // permesso negato nelle impostazioni
  | 'off' // si può attivare
  | 'on' // questo dispositivo è iscritto

export interface PushEnvironment {
  configured: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  /** Su iOS Safari fuori dalla Home il supporto Push non c'è: lo si distingue dal "non supportato" vero. */
  isIos: boolean
  isStandalone: boolean
  permission: NotificationPermission | 'unavailable'
  subscribed: boolean
}

export function pushState(env: PushEnvironment): PushState {
  if (!env.configured) return 'not-configured'
  if (env.isIos && !env.isStandalone) return 'needs-install'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  if (env.permission === 'denied') return 'denied'
  return env.subscribed && env.permission === 'granted' ? 'on' : 'off'
}

/** Risposta della funzione send-test-push. */
export const testResultSchema = z.object({ sent: z.number(), removed: z.number(), failed: z.number() })
export type TestResult = z.infer<typeof testResultSchema>

export function testResultMessage(result: TestResult): string {
  if (result.sent > 0) return 'Notifica inviata. Se non la vedi in qualche secondo, controlla le impostazioni di iPhone.'
  if (result.removed > 0) return 'Questo dispositivo non era più valido: riattiva le notifiche.'
  return 'Il servizio di notifiche non ha accettato l’invio. Riprova tra poco.'
}
