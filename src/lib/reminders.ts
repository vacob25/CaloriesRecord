import { addDays } from './dates'

// Promemoria dei pasti (Fase 2, ADR-087). Qui solo logica pura: niente browser, niente rete.
// Gli orari sono ora locale di Roma e li interpreta il database (due_reminders), ora legale compresa.

/** Quanti giorni di fila "mandato e non registrato" prima di proporre di sospendere i promemoria di un pasto. */
export const SUSPEND_PROPOSAL_DAYS = 5

/** Lo scheduler gira ogni 5 minuti: gli orari validi sono a passi di 5 minuti (lo impone anche il database). */
export const REMINDER_MINUTE_STEP = 5

/** Identificatore del promemoria di un pasto, come lo salva il database ('meal:<chiave del pasto>'). */
export function mealReminderSlot(mealKey: string): string {
  return `meal:${mealKey}`
}

/** Orari di partenza suggeriti quando si attiva un pasto (modificabili); per i pasti creati dall'utente, mezzogiorno. */
const DEFAULT_TIMES: Record<string, string> = {
  breakfast: '08:00',
  morning_snack: '10:30',
  lunch: '12:30',
  snack: '16:30',
  dinner: '20:00',
}
export const FALLBACK_REMINDER_TIME = '12:00'

export function defaultReminderTime(mealKey: string): string {
  return DEFAULT_TIMES[mealKey] ?? FALLBACK_REMINDER_TIME
}

export interface ReminderSetting {
  /** 'meal:<chiave>' */
  slot: string
  enabled: boolean
  /** 'HH:MM' nei giorni feriali (e nel weekend se `timeWeekend` è null). */
  timeWeekday: string
  /** 'HH:MM' per sabato e domenica; null = lo stesso dei feriali. */
  timeWeekend: string | null
  /** Giorno in cui l'utente ha scelto "Continua" davanti alla proposta di sospendere. */
  proposalDismissedDay: string | null
}

/** Il database restituisce i `time` come 'HH:MM:SS': l'app lavora con 'HH:MM'. */
export function toHourMinute(value: string): string {
  return value.slice(0, 5)
}

/** 'HH:MM' valido a passi di 5 minuti. */
export function isValidReminderTime(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match !== null && Number(match[2]) % REMINDER_MINUTE_STEP === 0
}

/** Riporta un orario qualunque ('HH:MM') al passo di 5 minuti più vicino verso il basso; null se non è un orario. */
export function snapReminderTime(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (match === null) return null
  const minute = Math.floor(Number(match[2]) / REMINDER_MINUTE_STEP) * REMINDER_MINUTE_STEP
  return `${match[1]}:${String(minute).padStart(2, '0')}`
}

/** Impostazione di partenza di un pasto non ancora configurato: spenta, con l'orario suggerito. */
export function initialSetting(mealKey: string): ReminderSetting {
  return { slot: mealReminderSlot(mealKey), enabled: false, timeWeekday: defaultReminderTime(mealKey), timeWeekend: null, proposalDismissedDay: null }
}

export interface SuspensionInput {
  /** Giorni in cui il promemoria del pasto è partito ed è stato accettato da almeno un dispositivo (reminder_log). */
  sentDays: readonly string[]
  /** Giorni in cui il pasto è stato registrato (reminder_status). */
  doneDays: readonly string[]
  /** Oggi (giorno locale). */
  today: string
  /** Giorno della scelta "Continua": si contano solo i giorni dopo. */
  dismissedDay: string | null
}

/**
 * Proposta di sospendere (mai automatica): negli ultimi `SUSPEND_PROPOSAL_DAYS` giorni di calendario, prima di oggi,
 * il promemoria è partito ogni giorno e il pasto non è mai stato registrato. Oggi non conta: la giornata non è finita.
 * Un giorno senza promemoria (telefono spento, finestra scaduta) interrompe la serie: non è colpa dell'utente.
 */
export function shouldProposeSuspension(input: SuspensionInput): boolean {
  const sent = new Set(input.sentDays)
  const done = new Set(input.doneDays)
  for (let back = 1; back <= SUSPEND_PROPOSAL_DAYS; back += 1) {
    const day = addDays(input.today, -back)
    if (input.dismissedDay !== null && day <= input.dismissedDay) return false
    if (!sent.has(day) || done.has(day)) return false
  }
  return true
}
