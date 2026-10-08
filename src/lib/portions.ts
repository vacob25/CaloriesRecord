import { z } from 'zod'

import { GRAMS_MAX } from './constants'
import { formatNumber, parseDecimal, round } from './numbers'

/** Unità di un cibo: g, oppure ml per i liquidi (valori per 100 ml, ADR-048). */
export type FoodUnit = 'g' | 'ml'

/** Porzione casalinga: nome e quantità nell'unità del cibo, es. "1 uovo medio" = 50 (g). */
export interface Portion {
  name: string
  amount: number
}

export const PORTION_NAME_MAX = 40
/** Passo del numero di porzioni: si può dire anche "mezzo" (es. ½ banana). */
export const PORTION_COUNT_STEP = 0.5

const portionSchema = z.object({
  name: z.string().trim().min(1).max(PORTION_NAME_MAX),
  amount: z.number().gt(0).max(GRAMS_MAX),
})

/** Porzioni lette dal database (jsonb): si tengono solo quelle valide, mai un crash per un dato sporco. */
export function parsePortions(value: unknown): Portion[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = portionSchema.safeParse(item)
    return parsed.success ? [{ name: parsed.data.name, amount: round(parsed.data.amount, 1) }] : []
  })
}

/** Quantità di `count` porzioni (es. 2 uova da 50 g = 100 g), a 1 decimale. */
export function portionAmount(portion: Portion, count: number): number {
  return round(portion.amount * count, 1)
}

/** Numero di porzioni dopo − / +: passi di ½, mai sotto ½. */
export function stepCount(count: number, direction: 1 | -1): number {
  const next = round(count + direction * PORTION_COUNT_STEP, 1)
  return next < PORTION_COUNT_STEP ? count : next
}

/** "100 g", "200 ml", "12,5 g". */
export function formatQuantity(value: number, unit: FoodUnit): string {
  return `${formatNumber(value, 1)} ${unit}`
}

/** "per 100 g" / "per 100 ml". */
export function per100Label(unit: FoodUnit): string {
  return `per 100 ${unit}`
}

/** Numero di porzioni in italiano: 1 → "1", 0,5 → "½", 1,5 → "1½". */
export function formatCount(count: number): string {
  const whole = Math.floor(count)
  const half = count - whole >= 0.5
  if (!half) return String(whole)
  return whole === 0 ? '½' : `${whole}½`
}

export interface PortionRowInput {
  key: string
  name: string
  amount: string
}

/** Valida le porzioni scritte nel modulo di un cibo; righe completamente vuote ignorate. */
export function validatePortionRows(
  rows: readonly PortionRowInput[],
): { ok: true; value: Portion[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const value: Portion[] = []
  for (const row of rows) {
    const name = row.name.trim()
    const amount = parseDecimal(row.amount)
    if (!name && row.amount.trim() === '') continue
    if (!name) errors[row.key] = 'Dai un nome alla porzione (es. "1 cucchiaio").'
    else if (name.length > PORTION_NAME_MAX) errors[row.key] = `Nome troppo lungo (al massimo ${PORTION_NAME_MAX} caratteri).`
    else if (amount === null || amount <= 0) errors[row.key] = 'Scrivi la quantità della porzione.'
    else if (amount > GRAMS_MAX) errors[row.key] = `Al massimo ${GRAMS_MAX}.`
    else value.push({ name, amount: round(amount, 1) })
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value }
}
