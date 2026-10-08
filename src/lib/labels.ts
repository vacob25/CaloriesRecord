/** Etichette in italiano dei valori del database (una sola fonte per tutte le schermate). */

export const FOOD_SOURCE_LABEL = {
  manual: 'I miei cibi',
  open_food_facts: 'Open Food Facts',
  recipe: 'Ricetta',
} as const

/** Ordine della giornata. 'snack' è lo spuntino del pomeriggio/sera; 'morning_snack' quello di metà mattina (step 17). */
export const MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Snack',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snack: 'Spuntino',
}

export function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value)
}

export const TRAINING_TYPES = ['rest', 'gym', 'football', 'both'] as const
export type TrainingType = (typeof TRAINING_TYPES)[number]

export const TRAINING_LABEL: Record<TrainingType, string> = {
  rest: 'Riposo',
  gym: 'Palestra',
  football: 'Calcio',
  both: 'Palestra + calcio',
}

export type Sex = 'male' | 'female'
export const SEX_LABEL: Record<Sex, string> = { male: 'Uomo', female: 'Donna' }

export const DAY_STATUS_LABEL = {
  respected: 'Rispettato',
  under: 'Sotto target',
  over: 'Oltre il target',
  noTarget: 'Senza target',
  unregistered: 'Non registrato',
} as const
