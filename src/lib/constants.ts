/**
 * Costanti di dominio (docs/DOMAIN_RULES.md). Un solo posto per i numeri:
 * mai valori magici sparsi nel codice.
 */

/** kcal per grammo di macronutriente (§3). */
export const KCAL_PER_G_PROTEIN = 4
export const KCAL_PER_G_CARBS = 4
export const KCAL_PER_G_FAT = 9

/** Validazione degli input (§9). */
export const GRAMS_MAX = 5000
export const KCAL_100G_MAX = 900
export const MACRO_100G_MAX = 100
/** Tolleranza sulla somma dei macro per 100 g: 1%. */
export const MACRO_SUM_TOLERANCE = 0.01
/** Oltre questa differenza tra kcal dichiarate e kcal dai macro si avvisa (non si blocca). */
export const KCAL_MISMATCH_WARNING = 0.2

/** Passo dei pulsanti − / + sui grammi (DESIGN.md, Aggiungi pasto). */
export const GRAMS_STEP = 10
/** Grammi proposti per un cibo mai registrato e senza porzione (i valori sono per 100 g). */
export const DEFAULT_GRAMS = 100

/**
 * Pasto proposto in base all'ora locale (DESIGN.md: "default: in base all'ora").
 * Fasce scelte allo step 5 (ADR-033), da confermare con l'uso: [ora di inizio, pasto].
 */
export const MEAL_BY_HOUR = [
  [0, 'snack'],
  [5, 'breakfast'],
  [11, 'lunch'],
  [15, 'snack'],
  [18, 'dinner'],
  [23, 'snack'],
] as const

/** Durata dell'avviso "Aggiunto · Annulla" (DESIGN.md: "per alcuni secondi"). */
export const UNDO_SECONDS = 6
