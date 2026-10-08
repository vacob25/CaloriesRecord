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
