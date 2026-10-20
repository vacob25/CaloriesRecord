// Logica della notifica di prova (Fase 1, ADR-086). Nessun import di Deno né di npm: si prova con Vitest.
// La funzione vera (send-test-push/index.ts) le passa le dipendenze: come leggere le subscription di chi chiama
// (con la RLS), come mandare il push e come cancellare una subscription scaduta.
import { deliverPush, type DeliverDeps, type DeliverResult, type StoredSubscription } from './deliverPush.ts'

export type { PushTarget, StoredSubscription } from './deliverPush.ts'

export interface SendTestPushDeps extends DeliverDeps {
  /** Le subscription dell'utente che chiama (la RLS lascia passare solo le sue). */
  listSubscriptions: () => Promise<StoredSubscription[]>
}

export type SendTestPushResult = DeliverResult

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

export async function sendTestPush(deps: SendTestPushDeps): Promise<SendTestPushResult> {
  const log = deps.log ?? (() => {})
  const result = await deliverPush(await deps.listSubscriptions(), TEST_PAYLOAD, deps)
  log(`push: inviati ${result.sent}, scaduti ${result.removed}, falliti ${result.failed}`)
  return result
}
