import { DEFAULT_GRAMS, GRAMS_MAX, GRAMS_STEP, MEAL_BY_HOUR } from './constants'
import type { MealType } from './labels'
import { round } from './numbers'
import { nutrientsFor, sumNutrients, type Nutrients, type Per100g } from './nutrition'

/** Pasto proposto per un'ora locale 0-23. */
export function mealForHour(hour: number): MealType {
  let meal: MealType = MEAL_BY_HOUR[0][1]
  for (const [from, type] of MEAL_BY_HOUR) if (hour >= from) meal = type
  return meal
}

/**
 * Snapshot di una voce pasto (ADR-011): kcal e macro calcolati ora, arrotondati a 1 decimale
 * come le colonne numeric(7,1). Cambiare il cibo dopo non li tocca.
 */
export function entrySnapshot(food: Per100g, grams: number): Nutrients {
  const values = nutrientsFor(food, grams)
  return {
    kcal: round(values.kcal, 1),
    protein: round(values.protein, 1),
    carbs: round(values.carbs, 1),
    fat: round(values.fat, 1),
  }
}

/**
 * Nuovi valori di una voce quando cambiano i grammi: si scala lo snapshot esistente
 * (non si rilegge il cibo, che potrebbe essere cambiato o cancellato).
 */
export function rescaleEntry(entry: Nutrients & { grams: number }, newGrams: number): Nutrients {
  const factor = newGrams / entry.grams
  return {
    kcal: round(entry.kcal * factor, 1),
    protein: round(entry.protein * factor, 1),
    carbs: round(entry.carbs * factor, 1),
    fat: round(entry.fat * factor, 1),
  }
}

/** Pulsanti − / +: passi di 10 g, mai ≤ 0 né oltre il massimo. */
export function stepGrams(grams: number, direction: 1 | -1): number {
  const next = round(grams + direction * GRAMS_STEP, 1)
  if (next <= 0 || next > GRAMS_MAX) return grams
  return next
}

/** Grammi proposti: gli ultimi usati per quel cibo, altrimenti la porzione, altrimenti 100 g. */
export function defaultGrams(lastGrams: number | undefined, servingG: number | null): number {
  return lastGrams ?? servingG ?? DEFAULT_GRAMS
}

/**
 * Quantità proposta con le porzioni casalinghe (step 14): ultima usata → porzione abituale →
 * 1 × la prima porzione casalinga (già selezionata) → 100.
 */
export function defaultQuantity(
  lastGrams: number | undefined,
  servingG: number | null,
  portions: readonly { amount: number }[],
): { amount: number; portionIndex: number | null } {
  const first = portions[0]
  if (lastGrams === undefined && servingG === null && first) return { amount: first.amount, portionIndex: 0 }
  return { amount: defaultGrams(lastGrams, servingG), portionIndex: null }
}

export interface EntryLike extends Nutrients {
  mealType: MealType
}

/** Voci raggruppate per pasto, nell'ordine Colazione, Pranzo, Cena, Snack, con i totali. */
export function groupByMeal<T extends EntryLike>(entries: readonly T[]): Record<MealType, { entries: T[]; total: Nutrients }> {
  const groups = {} as Record<MealType, { entries: T[]; total: Nutrients }>
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
    const list = entries.filter((entry) => entry.mealType === meal)
    groups[meal] = { entries: list, total: sumNutrients(list) }
  }
  return groups
}

/** Cibi usati di recente, dal più recente (DATA_MODEL: last_used_at desc, limite 20). */
export function recentFoods<T extends { lastUsedAt: string | null }>(foods: readonly T[], limit = 20): T[] {
  return foods
    .filter((food) => food.lastUsedAt !== null)
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    .slice(0, limit)
}
