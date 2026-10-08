import type { FoodFormInput } from '../lib/foodValidation'
import { findFoodByBarcode, saveOffFood } from './foods'
import { lookupBarcode } from './openFoodFacts'
import type { Food } from './types'

export type BarcodeResolution =
  /** Già tra i propri cibi, oppure appena salvato da Open Food Facts. */
  | { kind: 'food'; food: Food }
  /** Trovato ma con dati mancanti o non validi: modulo precompilato da completare. */
  | { kind: 'incomplete'; form: FoodFormInput; missing: string[] }
  | { kind: 'notFound'; code: string }

/** Cosa fare con un codice letto: prima i propri cibi (anche offline), poi Open Food Facts. */
export async function resolveBarcode(code: string): Promise<BarcodeResolution> {
  const own = await findFoodByBarcode(code)
  if (own) return { kind: 'food', food: own }
  const lookup = await lookupBarcode(code)
  if (!lookup.found) return { kind: 'notFound', code }
  if (lookup.conversion.kind === 'incomplete') {
    return { kind: 'incomplete', form: lookup.conversion.form, missing: lookup.conversion.missing }
  }
  return { kind: 'food', food: await saveOffFood(lookup.conversion.values) }
}
