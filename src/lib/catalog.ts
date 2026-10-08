import { z } from 'zod'

import { GRAMS_MAX, KCAL_100G_MAX, MACRO_100G_MAX, MACRO_SUM_TOLERANCE } from './constants'
import { hasKcalMismatch, type FoodValues } from './foodValidation'
import type { Per100g } from './nutrition'
import { PORTION_NAME_MAX, type FoodUnit, type Portion } from './portions'

/** Categorie fisse del catalogo (docs/prompts/catalogo-ingredienti.md). */
export const CATALOG_CATEGORIES = [
  'Cereali e derivati',
  'Legumi',
  'Verdure e ortaggi',
  'Frutta',
  'Frutta secca e semi',
  'Pesce e frutti di mare',
  'Carne',
  'Uova',
  'Latte, latticini e formaggi',
  'Grassi e condimenti',
  'Bevande',
  'Dolcificanti e altro',
] as const

const nonNegative = z.number().min(0)

const itemSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id: minuscolo con trattini'),
  name: z.string().trim().min(1).max(120),
  category: z.enum(CATALOG_CATEGORIES),
  unit: z.enum(['g', 'ml']),
  kcal: nonNegative,
  protein: nonNegative,
  carbs: nonNegative,
  fat: nonNegative,
  portions: z.array(z.strictObject({ name: z.string().trim().min(1).max(PORTION_NAME_MAX), amount: z.number().gt(0).max(GRAMS_MAX) })),
  source: z.string().trim().min(1, 'fonte obbligatoria'),
  portionsSource: z.string(),
  notes: z.string(),
})

const catalogSchema = z.strictObject({ version: z.literal(1), items: z.array(z.unknown()) })

export type CatalogItem = z.infer<typeof itemSchema>

export function itemPer100g(item: CatalogItem): Per100g {
  return { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat }
}

/** Problemi di una voce secondo §9; kcal incoerenti (> 20%) sono accettate solo se spiegate nella nota. */
export function catalogItemProblems(item: CatalogItem): string[] {
  const problems: string[] = []
  if (item.kcal > KCAL_100G_MAX) problems.push(`kcal oltre ${KCAL_100G_MAX}`)
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    if (item[key] > MACRO_100G_MAX) problems.push(`${key} oltre ${MACRO_100G_MAX} g`)
  }
  if (item.protein + item.carbs + item.fat > MACRO_100G_MAX * (1 + MACRO_SUM_TOLERANCE)) problems.push('macro oltre 100 g in totale')
  if (problems.length === 0 && hasKcalMismatch(itemPer100g(item)) && item.notes.trim() === '') {
    problems.push('kcal incoerenti con i macro (> 20%) senza spiegazione nella nota')
  }
  return problems
}

export type CatalogParse = { items: CatalogItem[]; errors: string[] }

/**
 * Controlla un catalogo (una o più parti con lo stesso formato): struttura con zod, regole §9, id e nomi unici.
 * Le voci valide si tengono comunque, gli errori dicono quali voci sono state scartate e perché.
 */
export function parseCatalog(...parts: unknown[]): CatalogParse {
  const items: CatalogItem[] = []
  const errors: string[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  parts.forEach((part, partIndex) => {
    const parsed = catalogSchema.safeParse(part)
    if (!parsed.success) {
      errors.push(`Parte ${partIndex + 1}: formato non valido (${parsed.error.issues[0]?.message ?? 'sconosciuto'}).`)
      return
    }
    parsed.data.items.forEach((raw, index) => {
      const where = `Parte ${partIndex + 1}, voce ${index + 1}`
      const item = itemSchema.safeParse(raw)
      if (!item.success) {
        const issue = item.error.issues[0]
        errors.push(`${where}: ${issue?.path.join('.') || 'voce'} — ${issue?.message ?? 'non valida'}.`)
        return
      }
      const label = `${where} (${item.data.id})`
      const problems = catalogItemProblems(item.data)
      if (ids.has(item.data.id)) problems.push('id ripetuto')
      const nameKey = item.data.name.trim().toLowerCase()
      if (names.has(nameKey)) problems.push('nome ripetuto')
      if (problems.length > 0) {
        errors.push(`${label}: ${problems.join('; ')}.`)
        return
      }
      ids.add(item.data.id)
      names.add(nameKey)
      items.push({ ...item.data, name: item.data.name.trim() })
    })
  })
  return { items, errors }
}

/** Voce del catalogo → valori da salvare tra i propri cibi (alla prima scelta). */
export function catalogToFood(item: CatalogItem): { values: FoodValues; portions: Portion[] } {
  const unit: FoodUnit = item.unit
  return {
    values: { name: item.name, brand: null, barcode: null, unit, servingG: null, per100g: itemPer100g(item) },
    portions: item.portions.map((portion) => ({ name: portion.name.trim(), amount: portion.amount })),
  }
}
