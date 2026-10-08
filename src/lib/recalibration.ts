import {
  ENERGY_PER_KG,
  RECAL_BAND_MAX,
  RECAL_BAND_MIN,
  RECAL_FAT_WARNING_KG_WEEK,
  RECAL_MAX_CHANGE,
  RECAL_MIN_DAYS,
  RECAL_MIN_REGISTERED_SHARE,
  RECAL_MIN_WEIGHTS,
  RECAL_REGISTERED_MIN_TARGET_SHARE,
  RECAL_WINDOW_DAYS,
  TARGET_ROUNDING_KCAL,
} from './constants'
import { addDays, daysBetween } from './dates'
import { round } from './numbers'
import { slopeKgPerWeek, type WeightLog } from './weight'

/** Kcal mangiate e target di un giorno (target null se quel giorno non è stato creato). */
export interface RecalDay {
  date: string
  kcal: number
  target: number | null
}

export interface RecalInput {
  /** Giorno in cui si esegue: la finestra sono i 28 giorni conclusi prima di oggi. */
  today: string
  /** Primo giorno d'uso (prima voce o prima pesata). */
  firstUseDate: string | null
  days: readonly RecalDay[]
  weights: readonly WeightLog[]
  currentMaintenanceKcal: number
  surplusPct: number
}

export type RecalEvaluation =
  | {
      status: 'notEnoughData'
      windowDays: number
      registeredDays: number
      weightCount: number
      /** Cosa manca, in italiano. */
      reasons: string[]
    }
  | {
      status: 'inBand' | 'proposal'
      windowDays: number
      registeredDays: number
      weightCount: number
      averageIntakeKcal: number
      slopeKgWeek: number
      estimatedMaintenanceKcal: number
      /** Solo con status 'proposal'. */
      proposedMaintenanceKcal: number | null
      /** Target nuovo nei giorni di riposo (mantenimento proposto · (1 + surplus)). */
      proposedRestTargetKcal: number | null
      /** Ritmo oltre +0,5 kg/settimana: l'eccesso è soprattutto grasso. */
      fatWarning: boolean
    }

/** Un giorno conta come registrato se ha almeno il 50% del suo target (sotto: giorno quasi certamente dimenticato). */
export function isRegisteredDay(day: RecalDay): boolean {
  return day.target !== null && day.target > 0 && day.kcal >= RECAL_REGISTERED_MIN_TARGET_SHARE * day.target
}

const round10 = (value: number) => round(value / TARGET_ROUNDING_KCAL) * TARGET_ROUNDING_KCAL

/**
 * Ricalibrazione adattiva (DOMAIN_RULES §7). Solo una PROPOSTA, mai automatica.
 * Finestra: i 28 giorni conclusi prima di `today`, tagliati all'inizio dell'uso (ADR-044); servono
 * almeno 21 giorni, l'80% registrati e 10 pesate.
 */
export function evaluateRecalibration(input: RecalInput): RecalEvaluation {
  const windowEnd = addDays(input.today, -1)
  let windowStart = addDays(input.today, -RECAL_WINDOW_DAYS)
  if (input.firstUseDate && input.firstUseDate > windowStart) windowStart = input.firstUseDate
  const windowDates = windowStart <= windowEnd ? daysBetween(windowStart, windowEnd) : []
  const byDate = new Map(input.days.map((day) => [day.date, day]))
  const registered = windowDates
    .map((date) => byDate.get(date))
    .filter((day): day is RecalDay => day !== undefined && isRegisteredDay(day))
  const weightCount = input.weights.filter((w) => w.date >= windowStart && w.date <= windowEnd).length

  const windowDays = windowDates.length
  const reasons: string[] = []
  if (input.firstUseDate === null || windowDays < RECAL_MIN_DAYS) {
    reasons.push(`almeno ${RECAL_MIN_DAYS} giorni di uso (ora ${windowDays})`)
  }
  if (windowDays === 0 || registered.length / windowDays < RECAL_MIN_REGISTERED_SHARE) {
    reasons.push(`almeno l’80% dei giorni registrati (ora ${registered.length} su ${windowDays})`)
  }
  if (weightCount < RECAL_MIN_WEIGHTS) reasons.push(`almeno ${RECAL_MIN_WEIGHTS} pesate (ora ${weightCount})`)

  const rawSlope = reasons.length === 0 ? slopeKgPerWeek(input.weights.filter((w) => w.date <= windowEnd), windowEnd) : null
  // 3 decimali come la colonna trend_slope_kg_week: evita che 0,19999… cada fuori dalla banda.
  const slopeWeek = rawSlope === null ? null : round(rawSlope, 3)
  if (reasons.length > 0 || slopeWeek === null) {
    return { status: 'notEnoughData', windowDays, registeredDays: registered.length, weightCount, reasons }
  }

  const averageIntakeKcal = registered.reduce((sum, day) => sum + day.kcal, 0) / registered.length
  const realSurplus = (slopeWeek / 7) * ENERGY_PER_KG
  const estimatedMaintenanceKcal = averageIntakeKcal - realSurplus
  const base = {
    windowDays,
    registeredDays: registered.length,
    weightCount,
    averageIntakeKcal,
    slopeKgWeek: slopeWeek,
    estimatedMaintenanceKcal,
    fatWarning: slopeWeek > RECAL_FAT_WARNING_KG_WEEK,
  }

  if (slopeWeek >= RECAL_BAND_MIN && slopeWeek <= RECAL_BAND_MAX) {
    return { status: 'inBand', ...base, proposedMaintenanceKcal: null, proposedRestTargetKcal: null }
  }
  const low = input.currentMaintenanceKcal * (1 - RECAL_MAX_CHANGE)
  const high = input.currentMaintenanceKcal * (1 + RECAL_MAX_CHANGE)
  const proposedMaintenanceKcal = round10(Math.min(high, Math.max(low, estimatedMaintenanceKcal)))
  return {
    status: 'proposal',
    ...base,
    proposedMaintenanceKcal,
    proposedRestTargetKcal: round10(proposedMaintenanceKcal * (1 + input.surplusPct)),
  }
}

/** Accettare: activity_factor = mantenimento proposto / BMR attuale, a 3 decimali (ADR-009). */
export function acceptedActivityFactor(proposedMaintenanceKcal: number, currentBmrKcal: number): number {
  return round(proposedMaintenanceKcal / currentBmrKcal, 3)
}
