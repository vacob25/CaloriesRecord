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
 * Tipo di giorno: 'rest', oppure gli sport fatti quel giorno come 'sport_1', 'sport_1+sport_3' (numeri in ordine = posizione
 * nell'elenco degli sport del profilo, step 21). Le funzioni per leggerlo e costruirlo sono in lib/sports.ts.
 */
export type TrainingType = string

export type Sex = 'male' | 'female'
export const SEX_LABEL: Record<Sex, string> = { male: 'Uomo', female: 'Donna' }

export const DAY_STATUS_LABEL = {
  respected: 'Rispettato',
  under: 'Sotto target',
  over: 'Oltre il target',
  noTarget: 'Senza target',
  unregistered: 'Non registrato',
} as const
