import { COOKED_WEIGHT_MAX_G } from './constants'
import { parseDecimal, round } from './numbers'
import { validateGrams } from './foodValidation'
import type { FoodUnit } from './portions'

export interface RecipeFormInput {
  name: string
  cookedWeightG: string
  /** `unit` dell'ingrediente: per gli ingredienti in ml i messaggi parlano di ml. */
  items: { key: string; grams: string; unit?: FoodUnit }[]
}

export interface RecipeFormErrors {
  name?: string
  cookedWeightG?: string
  items?: string
  /** Errore per ingrediente, indicizzato per `key`. */
  itemGrams: Record<string, string>
}

export type RecipeValidation =
  | { ok: true; value: { name: string; cookedWeightG: number; grams: Record<string, number> } }
  | { ok: false; errors: RecipeFormErrors }

/**
 * Valida il modulo di una ricetta: nome, almeno un ingrediente, grammi di ogni
 * ingrediente come §9 (> 0, ≤ 5000), peso cotto > 0. Il peso cotto non ha il tetto
 * dei 5000 g: una pentola per più giorni può superarlo.
 */
export function validateRecipe(input: RecipeFormInput): RecipeValidation {
  const errors: RecipeFormErrors = { itemGrams: {} }
  const name = input.name.trim()
  if (!name) errors.name = 'Inserisci il nome della ricetta.'
  if (input.items.length === 0) errors.items = 'Aggiungi almeno un ingrediente.'

  const grams: Record<string, number> = {}
  for (const item of input.items) {
    const result = validateGrams(item.grams, item.unit)
    if (result.ok) grams[item.key] = result.value
    else errors.itemGrams[item.key] = result.message
  }

  const cookedRaw = parseDecimal(input.cookedWeightG)
  const cooked = cookedRaw === null ? null : round(cookedRaw, 1)
  if (cooked === null) errors.cookedWeightG = 'Inserisci il peso totale cotto.'
  else if (cooked <= 0) errors.cookedWeightG = 'Il peso cotto deve essere più di 0.'
  // Limite della colonna numeric(8,1): oltre, il database rifiuterebbe con un errore generico.
  else if (cooked > COOKED_WEIGHT_MAX_G) errors.cookedWeightG = `Al massimo ${COOKED_WEIGHT_MAX_G} g.`

  const hasErrors =
    errors.name !== undefined ||
    errors.items !== undefined ||
    errors.cookedWeightG !== undefined ||
    Object.keys(errors.itemGrams).length > 0
  if (hasErrors || cooked === null) return { ok: false, errors }
  return { ok: true, value: { name, cookedWeightG: cooked, grams } }
}
