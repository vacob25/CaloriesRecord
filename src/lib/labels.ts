/** Etichette in italiano dei valori del database (una sola fonte per tutte le schermate). */

export const FOOD_SOURCE_LABEL = {
  manual: 'I miei cibi',
  open_food_facts: 'Open Food Facts',
  recipe: 'Ricetta',
} as const

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snack: 'Snack',
}

export function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value)
}
