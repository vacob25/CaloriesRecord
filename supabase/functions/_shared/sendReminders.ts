// Logica dei promemoria dei pasti (Fase 2, ADR-087). Nessun import di Deno né di npm: si prova con Vitest.
// send-reminders/index.ts le passa le dipendenze (database con chiave di servizio, web-push).
import { deliverPush, type DeliverDeps, type StoredSubscription } from './deliverPush.ts'

/** Una riga di due_reminders(). */
export interface DueReminder {
  reminder_user: string
  reminder_slot: string
  reminder_day: string
}

export interface SendRemindersDeps extends DeliverDeps {
  listDue: () => Promise<DueReminder[]>
  /** Subscription di UN utente (la funzione gira con la chiave di servizio: qui il filtro per utente è obbligatorio). */
  listSubscriptions: (userId: string) => Promise<StoredSubscription[]>
  /** Cancella una subscription scaduta di quell'utente. */
  deleteUserSubscription: (userId: string, endpoint: string) => Promise<void>
  /** Scrive il registro: il promemoria è partito, con quanti dispositivi l'hanno accettato. */
  recordSent: (reminder: DueReminder, accepted: number) => Promise<void>
}

export interface SendRemindersResult {
  due: number
  /** Promemoria accettati da almeno un dispositivo. */
  delivered: number
  /** Promemoria per cui nessun dispositivo ha accettato. */
  notDelivered: number
}

/**
 * Testo generico (HO_01): niente nome del pasto, peso o calorie. Il `tag` fa sostituire un promemoria uguale ancora
 * visibile invece di accumularne; vive nel payload cifrato, come il resto.
 */
export function reminderPayload(reminder: DueReminder): string {
  return JSON.stringify({ title: 'Calorie', body: 'È ora di registrare il pasto.', url: '/', tag: `promemoria-${reminder.reminder_slot}` })
}

export async function sendReminders(deps: SendRemindersDeps): Promise<SendRemindersResult> {
  const log = deps.log ?? (() => {})
  const due = await deps.listDue()
  const result: SendRemindersResult = { due: due.length, delivered: 0, notDelivered: 0 }

  for (const reminder of due) {
    const userId = reminder.reminder_user
    // Un errore su un utente non deve bloccare gli altri; il promemoria resta "da mandare" (nessun registro scritto)
    // e al giro dopo, entro la finestra di un'ora, si riprova.
    try {
      const subscriptions = await deps.listSubscriptions(userId)
      const outcome = await deliverPush(subscriptions, reminderPayload(reminder), {
        send: deps.send,
        deleteSubscription: (endpoint) => deps.deleteUserSubscription(userId, endpoint),
        log,
      })
      if (outcome.sent === 0 && outcome.failed > 0 && outcome.removed === 0) {
        // Solo errori temporanei (rete, 5xx): non si registra, si riprova al prossimo giro.
        result.notDelivered += 1
        continue
      }
      await deps.recordSent(reminder, outcome.sent)
      if (outcome.sent > 0) result.delivered += 1
      else result.notDelivered += 1
    } catch {
      result.notDelivered += 1
      log('promemoria: errore su un utente, saltato')
    }
  }
  log(`promemoria: dovuti ${result.due}, consegnati ${result.delivered}, non consegnati ${result.notDelivered}`)
  return result
}
