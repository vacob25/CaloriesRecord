import { parseDecimal, round } from './numbers'
import { validateGrams } from './foodValidation'

export interface RecipeFormInput {
  name: string
  cookedWeightG: string
  items: { key: string; grams: string }[]
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
    const result = validateGrams(item.grams)
    if (result.ok) grams[item.key] = result.value
    else errors.itemGrams[item.key] = result.message
  }

  const cooked = parseDecimal(input.cookedWeightG)
  if (cooked === null) errors.cookedWeightG = 'Inserisci il peso totale cotto.'
  else if (cooked <= 0) errors.cookedWeightG = 'Il peso cotto deve essere più di 0.'

  const hasErrors =
    errors.name !== undefined ||
    errors.items !== undefined ||
    errors.cookedWeightG !== undefined ||
    Object.keys(errors.itemGrams).length > 0
  if (hasErrors || cooked === null) return { ok: false, errors }
  return { ok: true, value: { name, cookedWeightG: round(cooked, 1), grams } }
}
