import {
  WEIGHT_REMINDER_DAYS,
  MOVING_AVERAGE_DAYS,
  MOVING_AVERAGE_MIN_LOGS,
  SLOPE_MIN_LOGS,
  SLOPE_WINDOW_DAYS,
  WEIGHT_JUMP_CONFIRM_KG,
} from './constants'
import { addDays } from './dates'

/** Una pesata: giorno locale 'YYYY-MM-DD' e kg. */
export interface WeightLog {
  date: string
  kg: number
}

function logsInWindow(logs: readonly WeightLog[], day: string, days: number): WeightLog[] {
  const from = addDays(day, -(days - 1))
  return logs.filter((log) => log.date >= from && log.date <= day)
}

/**
 * Media mobile 7 giorni (DOMAIN_RULES §4): media delle pesate nei 7 giorni fino al giorno incluso.
 * Con meno di 4 pesate nella finestra non c'è media: null.
 */
export function movingAverage7(logs: readonly WeightLog[], day: string): number | null {
  const window = logsInWindow(logs, day, MOVING_AVERAGE_DAYS)
  if (window.length < MOVING_AVERAGE_MIN_LOGS) return null
  return window.reduce((sum, log) => sum + log.kg, 0) / window.length
}

function dayNumber(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000
}

/**
 * Pendenza in kg/settimana (§4): regressione lineare ai minimi quadrati sulle pesate degli
 * ultimi 28 giorni (usando le date vere, non l'ordine), per 7. Servono almeno 10 pesate.
 */
export function slopeKgPerWeek(logs: readonly WeightLog[], day: string): number | null {
  const window = logsInWindow(logs, day, SLOPE_WINDOW_DAYS)
  if (window.length < SLOPE_MIN_LOGS) return null
  const xs = window.map((log) => dayNumber(log.date))
  const ys = window.map((log) => log.kg)
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < xs.length; i++) {
    const dx = (xs[i] ?? 0) - meanX
    numerator += dx * ((ys[i] ?? 0) - meanY)
    denominator += dx * dx
  }
  if (denominator === 0) return null
  return (numerator / denominator) * 7
}

/** Ultima pesata fino al giorno incluso. */
export function lastLogOnOrBefore(logs: readonly WeightLog[], day: string): WeightLog | null {
  let last: WeightLog | null = null
  for (const log of logs) if (log.date <= day && (!last || log.date > last.date)) last = log
  return last
}

/** Peso per il BMR: la media mobile quando c'è, altrimenti l'ultima pesata (step 7, ADR-037). */
export function weightForDay(logs: readonly WeightLog[], day: string): number | null {
  return movingAverage7(logs, day) ?? lastLogOnOrBefore(logs, day)?.kg ?? null
}

/** Una pesata che si discosta più di 2 kg da quella del giorno prima chiede conferma (§9). */
export function needsJumpConfirmation(logs: readonly WeightLog[], day: string, kg: number): boolean {
  const previous = logs.find((log) => log.date === addDays(day, -1))
  return previous !== undefined && Math.abs(kg - previous.kg) > WEIGHT_JUMP_CONFIRM_KG
}

/** Età in anni compiuti al giorno considerato. */
export function ageOn(birthDate: string, day: string): number {
  const years = Number(day.slice(0, 4)) - Number(birthDate.slice(0, 4))
  return day.slice(5) >= birthDate.slice(5) ? years : years - 1
}

export interface WeightPoint {
  date: string
  /** Pesata grezza del giorno (punto), se c'è. */
  kg: number | null
  /** Media mobile 7 giorni (linea), se ci sono abbastanza pesate. */
  average: number | null
}

/** Serie per il grafico: un elemento per giorno nell'intervallo, con punto grezzo e media. */
export function weightSeries(logs: readonly WeightLog[], from: string, to: string): WeightPoint[] {
  const byDate = new Map(logs.map((log) => [log.date, log.kg]))
  const points: WeightPoint[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const average = movingAverage7(logs, day)
    points.push({ date: day, kg: byDate.get(day) ?? null, average: average === null ? null : Math.round(average * 100) / 100 })
  }
  return points
}

/** Variazione della media mobile nell'intervallo (prima e ultima media disponibili). */
export function averageChange(points: readonly WeightPoint[]): { kg: number; days: number } | null {
  const withAverage = points.filter((point) => point.average !== null)
  const first = withAverage[0]
  const last = withAverage[withAverage.length - 1]
  if (!first || !last || first === last || first.average === null || last.average === null) return null
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000
  return { kg: last.average - first.average, days }
}

/** Distanza dal peso obiettivo: quanti kg mancano e in che direzione. */
export function distanceToGoal(currentKg: number, goalKg: number): { kg: number; direction: 'up' | 'down' | 'reached' } {
  const diff = goalKg - currentKg
  if (Math.abs(diff) < 0.05) return { kg: 0, direction: 'reached' }
  return { kg: Math.abs(diff), direction: diff > 0 ? 'up' : 'down' }
}

/** Giorni passati dall'ultima pesata (fino a oggi incluso); null se non ce ne sono. */
export function daysSinceLastWeight(logs: readonly WeightLog[], today: string): number | null {
  const last = lastLogOnOrBefore(logs, today)
  if (!last) return null
  return Math.round((dayNumber(today) - dayNumber(last.date)))
}

/** Promemoria in Oggi: nessuna pesata, oppure l'ultima ha 5 giorni o più (ADR-047). */
export function needsWeightReminder(logs: readonly WeightLog[], today: string, days = WEIGHT_REMINDER_DAYS): boolean {
  const since = daysSinceLastWeight(logs, today)
  return since === null || since >= days
}

export interface RecentSummary {
  count: number
  average: number | null
  /** Media degli ultimi giorni meno media dei giorni prima (null se manca una delle due). */
  change: number | null
}

/** Riepilogo degli ultimi `days` giorni (oggi incluso) confrontato con i `days` giorni prima. */
export function recentWeightSummary(logs: readonly WeightLog[], today: string, days = WEIGHT_REMINDER_DAYS): RecentSummary {
  const mean = (list: WeightLog[]) => (list.length === 0 ? null : list.reduce((sum, log) => sum + log.kg, 0) / list.length)
  const current = logsInWindow(logs, today, days)
  const previous = logsInWindow(logs, addDays(today, -days), days)
  const average = mean(current)
  const before = mean(previous)
  return { count: current.length, average, change: average !== null && before !== null ? average - before : null }
}
