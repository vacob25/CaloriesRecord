// Consegna di un push a un elenco di subscription (ADR-086, ADR-087). Nessun import di Deno né di npm: si prova con Vitest.
// La usano sia la notifica di prova sia i promemoria; chi la chiama passa come mandare il push e come cancellare.

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

export interface DeliverDeps {
  /** Manda il push; se il servizio push risponde con un errore lancia un errore con `statusCode`. */
  send: (target: PushTarget, payload: string) => Promise<{ statusCode: number }>
  /** Cancella una subscription scaduta. */
  deleteSubscription: (endpoint: string) => Promise<void>
  /** Log senza dati: solo conteggi e codici di stato, mai indirizzi, chiavi o testi. */
  log?: (message: string) => void
}

export interface DeliverResult {
  /** Accettati dal servizio push (risposta 2xx): non vuol dire ancora "arrivati sul telefono". */
  sent: number
  /** Subscription scadute (404/410) e cancellate. */
  removed: number
  /** Altri errori del servizio push (rete, 4xx/5xx diversi da 404/410). */
  failed: number
}

const EXPIRED_STATUS = [404, 410]

function statusOf(error: unknown): number | null {
  if (error && typeof error === 'object' && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
    return (error as { statusCode: number }).statusCode
  }
  return null
}

export async function deliverPush(subscriptions: StoredSubscription[], payload: string, deps: DeliverDeps): Promise<DeliverResult> {
  const log = deps.log ?? (() => {})
  const result: DeliverResult = { sent: 0, removed: 0, failed: 0 }

  for (const subscription of subscriptions) {
    const target: PushTarget = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_secret } }
    try {
      const response = await deps.send(target, payload)
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
  return result
}
