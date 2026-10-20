// Logica della notifica di prova (Fase 1, ADR-086). Nessun import di Deno né di npm: si prova con Vitest.
// La funzione vera (send-test-push/index.ts) le passa le dipendenze: chi è l'utente, come leggere le sue subscription
// (con la RLS), come mandare il push e come cancellare una subscription scaduta.

/** Una subscription come la salva l'app (colonne di push_subscriptions). */
export interface StoredSubscription {
  endpoint: string
  p256dh_key: string
  auth_secret: string
}

/** Quello che serve a web-push per cifrare e spedire. */
export interface PushTarget {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface SendTestPushDeps {
  /** Le subscription dell'utente che chiama (la RLS lascia passare solo le sue). */
  listSubscriptions: () => Promise<StoredSubscription[]>
  /** Manda il push; se il servizio push risponde con un errore lancia un errore con `statusCode`. */
  send: (target: PushTarget, payload: string) => Promise<{ statusCode: number }>
  /** Cancella una subscription scaduta (la RLS permette solo le proprie). */
  deleteSubscription: (endpoint: string) => Promise<void>
  /** Log senza dati: solo conteggi e codici di stato, mai indirizzi, chiavi o testi. */
  log?: (message: string) => void
}

export interface SendTestPushResult {
  /** Accettati dal servizio push (risposta 2xx): non vuol dire ancora "arrivati sul telefono". */
  sent: number
  /** Subscription scadute (404/410) e cancellate. */
  removed: number
  /** Altri errori del servizio push (rete, 4xx/5xx diversi da 404/410). */
  failed: number
}

/**
 * Testo generico (HO_01): il testo passa dai server di Apple e Google, quindi non contiene mai peso, calorie, nomi di
 * cibi o altri dati personali.
 */
export const TEST_PAYLOAD = JSON.stringify({
  title: 'Calorie',
  body: 'Notifica di prova: funziona.',
  url: '/profilo',
  tag: 'prova',
})

const EXPIRED_STATUS = [404, 410]

function statusOf(error: unknown): number | null {
  if (error && typeof error === 'object' && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
    return (error as { statusCode: number }).statusCode
  }
  return null
}

export async function sendTestPush(deps: SendTestPushDeps): Promise<SendTestPushResult> {
  const log = deps.log ?? (() => {})
  const subscriptions = await deps.listSubscriptions()
  const result: SendTestPushResult = { sent: 0, removed: 0, failed: 0 }

  for (const subscription of subscriptions) {
    const target: PushTarget = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_secret } }
    try {
      const response = await deps.send(target, TEST_PAYLOAD)
      if (response.statusCode >= 200 && response.statusCode < 300) result.sent += 1
      else {
        result.failed += 1
        log(`push: risposta ${response.statusCode}`)
      }
    } catch (error) {
      const status = statusOf(error)
      if (status !== null && EXPIRED_STATUS.includes(status)) {
        await deps.deleteSubscription(subscription.endpoint)
        result.removed += 1
        log(`push: subscription scaduta (${status}), cancellata`)
      } else {
        result.failed += 1
        log(`push: errore ${status ?? 'di rete'}`)
      }
    }
  }
  log(`push: inviati ${result.sent}, scaduti ${result.removed}, falliti ${result.failed}`)
  return result
}
