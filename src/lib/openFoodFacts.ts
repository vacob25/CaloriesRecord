import { z } from 'zod'

import type { FoodFormInput } from './foodValidation'
import { validateFood, type FoodValues } from './foodValidation'
import { round } from './numbers'

/**
 * Conversione delle risposte di Open Food Facts in un tipo interno (ARCHITECTURE regola 5).
 * I campi possono mancare o essere sbagliati: niente si usa senza passare da qui.
 * Campi dagli schemi ufficiali (API v3.4, struttura `nutriments` stabile; ADR-041).
 */

/** Numero o stringa numerica (OFF a volte manda "12.5"); tutto il resto → undefined. */
const looseNumber = z.preprocess((value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}, z.number().optional())

const looseText = z.preprocess((value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined), z.string().optional())

const offProductSchema = z.object({
  code: looseText,
  product_name: looseText,
  product_name_it: looseText,
  brands: looseText,
  serving_quantity: looseNumber,
  serving_quantity_unit: looseText,
  nutriments: z
    .object({
      'energy-kcal_100g': looseNumber,
      proteins_100g: looseNumber,
      carbohydrates_100g: looseNumber,
      fat_100g: looseNumber,
    })
    .partial()
    .optional()
    .catch(undefined),
})

export type OffProductRaw = z.infer<typeof offProductSchema>

/** Esito della conversione di un prodotto. */
export type OffConversion =
  /** Dati completi e validi (§9): si può salvare tra i propri cibi. */
  | { kind: 'complete'; values: FoodValues; warnings: string[] }
  /** Dati mancanti o non validi: si propone la creazione a mano, già compilata. Mai zeri silenziosi. */
  | { kind: 'incomplete'; form: FoodFormInput; missing: string[] }

const NUTRIENTS = [
  ['energy-kcal_100g', 'kcal', 'kcal'],
  ['proteins_100g', 'protein', 'proteine'],
  ['carbohydrates_100g', 'carbs', 'carboidrati'],
  ['fat_100g', 'fat', 'grassi'],
] as const

const text = (value: number | undefined) => (value === undefined ? '' : String(round(value, 2)).replace('.', ','))

/** Converte un prodotto grezzo (`product` della risposta) nel modulo di un cibo e, se possibile, nei valori pronti. */
export function convertOffProduct(raw: unknown, barcodeFallback = ''): OffConversion {
  const parsed = offProductSchema.safeParse(raw ?? {})
  const product: OffProductRaw = parsed.success ? parsed.data : {}
  const name = product.product_name_it ?? product.product_name ?? ''
  const nutriments = product.nutriments ?? {}
  // Porzione solo se in grammi: in v1 i cibi sono solo in grammi (DECISIONS, punto step 4).
  const servingG = product.serving_quantity_unit === undefined || product.serving_quantity_unit === 'g' ? product.serving_quantity : undefined

  const form: FoodFormInput = {
    name,
    brand: product.brands?.split(',')[0]?.trim() ?? '',
    barcode: product.code ?? barcodeFallback,
    basis: '100g',
    servingG: servingG !== undefined && servingG > 0 ? text(servingG) : '',
    kcal: text(nutriments['energy-kcal_100g']),
    protein: text(nutriments.proteins_100g),
    carbs: text(nutriments.carbohydrates_100g),
    fat: text(nutriments.fat_100g),
  }

  const missing: string[] = []
  if (!name) missing.push('nome')
  for (const [field, , label] of NUTRIENTS) if (nutriments[field] === undefined) missing.push(label)
  if (missing.length > 0) return { kind: 'incomplete', form, missing }

  const validation = validateFood(form)
  if (!validation.ok) return { kind: 'incomplete', form, missing: ['valori non validi (controlla l’etichetta)'] }
  return { kind: 'complete', values: validation.value, warnings: validation.warnings }
}

const productResponseSchema = z.object({
  status: z.string().optional(),
  product: z.unknown().optional(),
})

/** Risposta di GET /api/v3.4/product/{code}: trovato o no (v3: status "failure" o HTTP 404 se manca). */
export function parseProductResponse(httpStatus: number, body: unknown): { found: true; product: unknown } | { found: false } {
  if (httpStatus === 404) return { found: false }
  const parsed = productResponseSchema.safeParse(body)
  if (!parsed.success || parsed.data.status === 'failure' || !parsed.data.product) return { found: false }
  return { found: true, product: parsed.data.product }
}

export interface OffSearchHit {
  code: string
  name: string
  brand: string
  /** kcal/100 g se presenti (solo per mostrarle nell'elenco). */
  kcal: number | null
  conversion: OffConversion
}

const searchResponseSchema = z.object({ hits: z.array(z.unknown()).catch([]) })

/** Risultati di Search-a-licious: si scartano quelli senza codice; gli altri si convertono uno per uno. */
export function parseSearchResponse(body: unknown): OffSearchHit[] {
  const parsed = searchResponseSchema.safeParse(body)
  if (!parsed.success) return []
  const hits: OffSearchHit[] = []
  for (const raw of parsed.data.hits) {
    const product = offProductSchema.safeParse(raw)
    if (!product.success || !product.data.code) continue
    const conversion = convertOffProduct(raw)
    const name = product.data.product_name_it ?? product.data.product_name
    if (!name) continue
    hits.push({
      code: product.data.code,
      name,
      brand: product.data.brands?.split(',')[0]?.trim() ?? '',
      kcal: product.data.nutriments?.['energy-kcal_100g'] ?? null,
      conversion,
    })
  }
  return hits
}

/** Un codice a barre plausibile: solo cifre, da 8 a 14 (EAN-8, UPC, EAN-13, GTIN-14). */
export function isPlausibleBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code)
}
