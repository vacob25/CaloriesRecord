import { CONTAINER_NAME_MAX, WATER_GOAL_MAX_L, WATER_ML_MAX } from './constants'
import { formatNumber, parseDecimal, round } from './numbers'

type Result<T> = { ok: true; value: T } | { ok: false; message: string }

export type ContainerIcon = 'glass' | 'small-bottle' | 'bottle' | 'flask'

export interface Container {
  /** Chiave salvata in `water_entries.container`: il nome dell'icona per i tre rapidi, l'id del database per quelli personali. */
  key: string
  name: string
  ml: number
  icon: ContainerIcon
}

/** Formati comuni in Italia (ADR-049): bicchiere 200 ml, bottiglietta 500 ml, bottiglia 1,5 L. */
export const DEFAULT_CONTAINERS: readonly Container[] = [
  { key: 'glass', name: 'Bicchiere', ml: 200, icon: 'glass' },
  { key: 'small-bottle', name: 'Bottiglietta', ml: 500, icon: 'small-bottle' },
  { key: 'bottle', name: 'Bottiglia', ml: 1500, icon: 'bottle' },
]

/** Aggiunta d'acqua: `container` null = quantità libera ("Altra quantità"). */
export interface WaterAddition {
  id: string
  ml: number
  container: string | null
}

/** Quante volte oggi è stato aggiunto un contenitore (null = le quantità libere). */
export function countFor(entries: readonly WaterAddition[], container: string | null): number {
  return entries.filter((entry) => entry.container === container).length
}

/** L'ultima aggiunta di quel contenitore (per il "−"); le voci sono in ordine di inserimento. */
export function lastFor(entries: readonly WaterAddition[], container: string | null): WaterAddition | undefined {
  return entries.filter((entry) => entry.container === container).at(-1)
}

/** ml delle quantità libere del giorno. */
export function freeTotal(entries: readonly WaterAddition[]): number {
  return waterTotal(entries.filter((entry) => entry.container === null))
}

/** Totale del giorno in ml. */
export function waterTotal(entries: readonly { ml: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.ml, 0)
}

/** Avanzamento verso l'obiettivo: senza obiettivo non c'è percentuale (nessun valore inventato). */
export function waterProgress(totalMl: number, goalMl: number | null): { fraction: number; remainingMl: number } | null {
  if (goalMl === null || goalMl <= 0) return null
  return { fraction: Math.min(totalMl / goalMl, 1), remainingMl: Math.max(goalMl - totalMl, 0) }
}

/** "200 ml" sotto il litro, "1,5 L" da 1 litro in su. */
export function formatWater(ml: number): string {
  return ml < 1000 ? `${formatNumber(ml)} ml` : `${formatNumber(ml / 1000, 2)} L`
}

/** Quantità libera in ml: intero, 1-5000. */
export function validateWaterMl(input: string): Result<number> {
  const value = parseDecimal(input)
  if (value === null) return { ok: false, message: 'Scrivi quanti ml.' }
  const ml = Math.round(value)
  if (ml <= 0) return { ok: false, message: 'I ml devono essere più di 0.' }
  if (ml > WATER_ML_MAX) return { ok: false, message: `Al massimo ${WATER_ML_MAX} ml alla volta.` }
  return { ok: true, value: ml }
}

/** Nome di un contenitore personale (es. "Borraccia"). */
export function validateContainerName(input: string, existing: readonly string[] = []): Result<string> {
  const name = input.trim()
  if (!name) return { ok: false, message: 'Dai un nome al contenitore (es. "Borraccia").' }
  if (name.length > CONTAINER_NAME_MAX) return { ok: false, message: `Al massimo ${CONTAINER_NAME_MAX} caratteri.` }
  if (existing.some((other) => other.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: 'Hai già un contenitore con questo nome.' }
  }
  return { ok: true, value: name }
}

/** Obiettivo in litri scritto dall'utente ("2,5") → ml; vuoto = nessun obiettivo. */
export function validateWaterGoal(input: string): Result<number | null> {
  if (input.trim() === '') return { ok: true, value: null }
  const liters = parseDecimal(input)
  if (liters === null || liters <= 0) return { ok: false, message: 'Scrivi l’obiettivo in litri, es. 2,5.' }
  if (liters > WATER_GOAL_MAX_L) return { ok: false, message: `Al massimo ${WATER_GOAL_MAX_L} L.` }
  const ml = Math.round(liters * 1000)
  // "0,0004" diventerebbe 0 ml, che il database rifiuta.
  if (ml < 1) return { ok: false, message: 'Scrivi l’obiettivo in litri, es. 2,5.' }
  return { ok: true, value: ml }
}

/** ml salvati → testo in litri per il campo ("2,5"). */
export function goalToText(goalMl: number | null): string {
  return goalMl === null ? '' : String(round(goalMl / 1000, 2)).replace('.', ',')
}
