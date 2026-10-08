import { z } from 'zod'

import {
  GRAMS_MAX,
  KCAL_100G_MAX,
  KCAL_MISMATCH_WARNING,
  MACRO_100G_MAX,
  MACRO_SUM_TOLERANCE,
} from './constants'
import { parseDecimal, round } from './numbers'
import { kcalFromMacros, per100gFromServing, type Per100g } from './nutrition'
import type { FoodUnit } from './portions'

/** Grammi di una voce pasto o di un ingrediente: > 0 e ≤ 5000 (§9). */
export const gramsSchema = z
  .number({ message: 'Inserisci i grammi.' })
  .gt(0, { message: 'I grammi devono essere più di 0.' })
  .max(GRAMS_MAX, { message: `Al massimo ${GRAMS_MAX} g.` })

export function validateGrams(input: string, unit: FoodUnit = 'g'): { ok: true; value: number } | { ok: false; message: string } {
  // Si arrotonda PRIMA del controllo: "0,04" diventerebbe 0 g, che il database rifiuta.
  const raw = parseDecimal(input)
  const parsed = gramsSchema.safeParse(raw === null ? undefined : round(raw, 1))
  if (parsed.success) return { ok: true, value: parsed.data }
  const message = parsed.error.issues[0]?.message ?? 'Quantità non valida.'
  // Per i liquidi gli stessi limiti valgono in ml.
  return { ok: false, message: unit === 'ml' ? message.replace('i grammi', 'i ml').replace('I grammi', 'I ml').replace(' g.', ' ml.') : message }
}

/** Testo del modulo "Nuovo cibo / Modifica cibo", così come l'utente lo scrive. */
export interface FoodFormInput {
  name: string
  brand: string
  barcode: string
  /** g, oppure ml per i liquidi (valori per 100 ml, ADR-048). */
  unit: FoodUnit
  /** I valori scritti sono per 100 g/ml o per una porzione di `servingG` grammi/ml. */
  basis: '100g' | 'serving'
  servingG: string
  kcal: string
  protein: string
  carbs: string
  fat: string
}

/** Cibo pronto da salvare: valori sempre per 100 g. */
export interface FoodValues {
  name: string
  brand: string | null
  barcode: string | null
  unit: FoodUnit
  servingG: number | null
  per100g: Per100g
}

export type FoodField = keyof FoodFormInput | 'macroSum'

export type FoodValidation =
  | { ok: true; value: FoodValues; warnings: string[] }
  | { ok: false; errors: Partial<Record<FoodField, string>> }

const requiredNumber = (label: string) =>
  z
    .string()
    .transform((text) => parseDecimal(text))
    .pipe(z.number({ message: `Inserisci ${label}.` }).min(0, { message: 'Non può essere negativo.' }))

const optionalText = z
  .string()
  .trim()
  .transform((text) => (text === '' ? null : text))

const formSchema = z.object({
  name: z.string().trim().min(1, { message: 'Inserisci il nome.' }),
  brand: optionalText,
  barcode: optionalText,
  unit: z.enum(['g', 'ml']),
  basis: z.enum(['100g', 'serving']),
  servingG: z.string().transform((text) => parseDecimal(text)),
  kcal: requiredNumber('le kcal'),
  protein: requiredNumber('le proteine'),
  carbs: requiredNumber('i carboidrati'),
  fat: requiredNumber('i grassi'),
})

/**
 * Valida il modulo di un cibo (DOMAIN_RULES §9):
 * kcal/100 g 0-900; ogni macro 0-100 g; P + C + G ≤ 100 g (tolleranza 1%).
 * Se le kcal dichiarate e quelle dai macro differiscono più del 20%: avviso, non errore.
 */
export function validateFood(input: FoodFormInput): FoodValidation {
  const parsed = formSchema.safeParse(input)
  const errors: Partial<Record<FoodField, string>> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as FoodField
      errors[field] ??= issue.message
    }
  }

  let servingG: number | null = null
  const servingText = input.servingG.trim()
  if (input.basis === 'serving' || servingText !== '') {
    const serving = validateGrams(servingText, input.unit)
    if (serving.ok) servingG = serving.value
    else errors.servingG = servingText === '' ? 'Inserisci i grammi della porzione.' : serving.message
  }

  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors }

  const { name, brand, barcode, unit, basis, kcal, protein, carbs, fat } = parsed.data
  const written = { kcal, protein, carbs, fat }
  const raw = basis === 'serving' && servingG !== null ? per100gFromServing(written, servingG) : written
  const per100g: Per100g = {
    kcal: round(raw.kcal, 2),
    protein: round(raw.protein, 2),
    carbs: round(raw.carbs, 2),
    fat: round(raw.fat, 2),
  }

  const where = basis === 'serving' ? ` (convertito a 100 ${unit})` : ''
  if (per100g.kcal > KCAL_100G_MAX) errors.kcal = `Al massimo ${KCAL_100G_MAX} kcal per 100 ${unit}${where}.`
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    if (per100g[key] > MACRO_100G_MAX) errors[key] = `Al massimo ${MACRO_100G_MAX} g per 100 ${unit}${where}.`
  }
  const macroSum = per100g.protein + per100g.carbs + per100g.fat
  if (macroSum > MACRO_100G_MAX * (1 + MACRO_SUM_TOLERANCE)) {
    errors.macroSum = `Proteine + carboidrati + grassi superano 100 g su 100 ${unit}${where}: controlla i valori.`
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const warnings: string[] = []
  const fromMacros = kcalFromMacros(per100g)
  if (hasKcalMismatch(per100g)) {
    warnings.push(
      `Valori incoerenti: i macro danno circa ${Math.round(fromMacros)} kcal invece di ${Math.round(per100g.kcal)}. Controlla l’etichetta.`,
    )
  }

  return { ok: true, value: { name, brand, barcode, unit, servingG, per100g }, warnings }
}

/** §9: kcal dichiarate e kcal dai macro differiscono di oltre il 20% (avviso, non blocco). */
export function hasKcalMismatch(per100g: Per100g): boolean {
  const fromMacros = kcalFromMacros(per100g)
  return per100g.kcal === 0 ? fromMacros > 0 : Math.abs(fromMacros - per100g.kcal) / per100g.kcal > KCAL_MISMATCH_WARNING
}
