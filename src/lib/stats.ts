import { RESPECTED_MAX_RATIO, RESPECTED_MIN_RATIO } from './constants'
import { daysBetween } from './dates'
import { MEAL_TYPES, type MealType } from './labels'
import { sumNutrients, type Nutrients } from './nutrition'
import { movingAverage7, type WeightLog } from './weight'

/** Ciò che serve di una voce pasto per le statistiche. */
export interface StatsEntry extends Nutrients {
  entryDate: string
  mealType: MealType
  foodId: string | null
  foodName: string
}

export type DayStatus = 'unregistered' | 'noTarget' | 'under' | 'respected' | 'over'

export interface DayStat {
  date: string
  kcal: number
  target: number | null
  status: DayStatus
}

/** Stato di un giorno (§5). Un giorno senza voci non è "sotto target": è "non registrato". */
export function dayStatus(kcal: number, entries: number, target: number | null): DayStatus {
  if (entries === 0) return 'unregistered'
  if (target === null || target <= 0) return 'noTarget'
  if (kcal < RESPECTED_MIN_RATIO * target) return 'under'
  if (kcal > RESPECTED_MAX_RATIO * target) return 'over'
  return 'respected'
}

export interface PeriodStats {
  days: DayStat[]
  /** Giorni con almeno una voce. */
  registeredDays: number
  /** Media kcal dei soli giorni registrati (null se nessuno). */
  averageKcal: number | null
  /** Macro medie (g) dei soli giorni registrati. */
  averageMacros: Omit<Nutrients, 'kcal'> | null
  /** Giorni rispettati / giorni registrati con un target. */
  respected: { count: number; of: number }
  /** kcal per pasto / totale del periodo (0-1). */
  mealShare: Record<MealType, number>
  /** Cibi più frequenti per numero di voci (food_id, o nome se il cibo è stato cancellato). */
  topFoods: { key: string; name: string; count: number }[]
  /** Variazione della media mobile tra inizio e fine periodo, in kg/settimana (null se manca una delle due). */
  weightKgPerWeek: number | null
}

/** Statistiche di un periodo (DOMAIN_RULES §8). */
export function periodStats(
  start: string,
  end: string,
  entries: readonly StatsEntry[],
  targets: ReadonlyMap<string, number>,
  weights: readonly WeightLog[],
  topLimit = 5,
  /** Oggi: per un periodo non ancora finito la variazione del peso si misura fino a oggi, non alla fine del periodo. */
  today?: string,
): PeriodStats {
  const inPeriod = entries.filter((e) => e.entryDate >= start && e.entryDate <= end)
  const days = daysBetween(start, end).map((date) => {
    const dayEntries = inPeriod.filter((e) => e.entryDate === date)
    const kcal = sumNutrients(dayEntries).kcal
    const target = targets.get(date) ?? null
    return { date, kcal, target, status: dayStatus(kcal, dayEntries.length, target) }
  })

  const registered = days.filter((d) => d.status !== 'unregistered')
  const registeredDates = new Set(registered.map((d) => d.date))
  const registeredEntries = inPeriod.filter((e) => registeredDates.has(e.entryDate))
  const totals = sumNutrients(registeredEntries)
  const n = registered.length

  const withTarget = registered.filter((d) => d.status !== 'noTarget')
  const respectedCount = withTarget.filter((d) => d.status === 'respected').length

  const mealShare = Object.fromEntries(MEAL_TYPES.map((meal) => [meal, 0])) as Record<MealType, number>
  if (totals.kcal > 0) {
    for (const entry of inPeriod) mealShare[entry.mealType] += entry.kcal / totals.kcal
  }

  const counts = new Map<string, { key: string; name: string; count: number }>()
  for (const entry of inPeriod) {
    const key = entry.foodId ?? `name:${entry.foodName}`
    const current = counts.get(key) ?? { key, name: entry.foodName, count: 0 }
    current.count += 1
    counts.set(key, current)
  }
  const topFoods = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'it'))
    .slice(0, topLimit)

  const startAverage = movingAverage7(weights, start)
  const weightEnd = today !== undefined && today < end ? today : end
  const endAverage = movingAverage7(weights, weightEnd)
  const spanDays = daysBetween(start, weightEnd).length - 1
  const weightKgPerWeek =
    startAverage !== null && endAverage !== null && spanDays > 0 ? ((endAverage - startAverage) / spanDays) * 7 : null

  return {
    days,
    registeredDays: n,
    averageKcal: n > 0 ? totals.kcal / n : null,
    averageMacros: n > 0 ? { protein: totals.protein / n, carbs: totals.carbs / n, fat: totals.fat / n } : null,
    respected: { count: respectedCount, of: withTarget.length },
    mealShare,
    topFoods,
    weightKgPerWeek,
  }
}
