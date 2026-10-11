/** Etichette in italiano dei valori del database (una sola fonte per tutte le schermate). */

export const FOOD_SOURCE_LABEL = {
  manual: 'I miei cibi',
  open_food_facts: 'Open Food Facts',
  recipe: 'Ricetta',
} as const

/**
 * Chiave di un pasto (`meal_slots.slot_key`). Dal step 20 i pasti sono dell'utente: i cinque di partenza hanno le chiavi
 * 'breakfast', 'morning_snack', 'lunch', 'dinner', 'snack' (vedi lib/mealSlots.ts), gli altri 'custom_…'.
 */
export type MealType = string

/**
 * Tipo di giorno. 'sport_1' e 'sport_2' sono il primo e il secondo sport del profilo (step 19): le etichette si
 * ricavano da lib/sports.ts. Prima erano fissi Palestra e Calcio ('gym', 'football').
 */
export const TRAINING_TYPES = ['rest', 'sport_1', 'sport_2', 'both'] as const
export type TrainingType = (typeof TRAINING_TYPES)[number]

export type Sex = 'male' | 'female'
export const SEX_LABEL: Record<Sex, string> = { male: 'Uomo', female: 'Donna' }

export const DAY_STATUS_LABEL = {
  respected: 'Rispettato',
  under: 'Sotto target',
  over: 'Oltre il target',
  noTarget: 'Senza target',
  unregistered: 'Non registrato',
} as const
