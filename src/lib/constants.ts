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

/** Mifflin-St Jeor (DOMAIN_RULES §1). */
export const BMR_SEX_OFFSET = { male: 5, female: -161 } as const

/** Il target si arrotonda al multiplo di 10 kcal più vicino (§2). */
export const TARGET_ROUNDING_KCAL = 10
/** Avviso (non blocco) se il surplus supera il 20% (§2). */
export const SURPLUS_WARNING_PCT = 0.2
/** Avviso se i carboidrati scendono sotto 3 g/kg (§3). */
export const MIN_CARBS_G_PER_KG = 3

/** Peso (§4, §9). */
export const WEIGHT_MIN_KG = 30
export const WEIGHT_MAX_KG = 250
export const MOVING_AVERAGE_DAYS = 7
export const MOVING_AVERAGE_MIN_LOGS = 4
export const SLOPE_WINDOW_DAYS = 28
export const SLOPE_MIN_LOGS = 10
/** Salto dal giorno prima oltre il quale si chiede conferma (§9). */
export const WEIGHT_JUMP_CONFIRM_KG = 2

/** Dati personali (§10, ADR-038). */
export const HEIGHT_MIN_CM = 100
export const HEIGHT_MAX_CM = 250
export const AGE_MIN_YEARS = 14
export const AGE_MAX_YEARS = 100

/** Limiti di Open Food Facts per IP/utente (documentazione ufficiale, ADR-041). */
export const OFF_PRODUCT_READS_PER_MINUTE = 15
export const OFF_SEARCHES_PER_MINUTE = 10

/** Giorno "rispettato" (§5): 0,95 · target ≤ kcal ≤ 1,10 · target (soglie modificabili). */
export const RESPECTED_MIN_RATIO = 0.95
export const RESPECTED_MAX_RATIO = 1.1

/** Ricalibrazione (DOMAIN_RULES §7). */
export const ENERGY_PER_KG = 7700
export const RECAL_WINDOW_DAYS = 28
export const RECAL_MIN_DAYS = 21
export const RECAL_MIN_REGISTERED_SHARE = 0.8
/** Un giorno conta come registrato se ha almeno il 50% del suo target in kcal. */
export const RECAL_REGISTERED_MIN_TARGET_SHARE = 0.5
export const RECAL_MIN_WEIGHTS = 10
/** Banda del ritmo voluto (kg/settimana): dentro, nessuna proposta. */
export const RECAL_BAND_MIN = 0.2
export const RECAL_BAND_MAX = 0.4
/** Oltre questo ritmo si avvisa che l'eccesso è soprattutto grasso. */
export const RECAL_FAT_WARNING_KG_WEEK = 0.5
/** La proposta resta entro ±5% del mantenimento attuale. */
export const RECAL_MAX_CHANGE = 0.05
