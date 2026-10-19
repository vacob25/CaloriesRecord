import { SPORT_NAME_MAX, SPORTS_MAX } from './constants'
import type { TrainingType } from './labels'
import { normalizeText } from './search'
import { cleanName } from './text'

/** Sport suggeriti (scorciatoie): Palestra è consigliata, il resto si scrive liberamente. */
export const RECOMMENDED_SPORT = 'Palestra'
export const SUGGESTED_SPORTS = ['Palestra', 'Calcio', 'Corsa', 'Nuoto', 'Ciclismo', 'Basket', 'Pallavolo', 'Tennis'] as const

export type SportsResult = { ok: true; value: string[] } | { ok: false; message: string }

/** Aggiunge uno sport alla lista: non vuoto, ≤ 24 caratteri, senza doppioni (anche con maiuscole/accenti diversi), al massimo 4 (SPORTS_MAX). */
export function addSport(current: readonly string[], input: string): SportsResult {
  const name = cleanName(input)
  if (name === '') return { ok: false, message: 'Scrivi il nome dello sport.' }
  if (name.length > SPORT_NAME_MAX) return { ok: false, message: `Al massimo ${SPORT_NAME_MAX} caratteri.` }
  if (current.some((sport) => normalizeText(sport) === normalizeText(name))) {
    return { ok: false, message: 'Hai già aggiunto questo sport.' }
  }
  if (current.length >= SPORTS_MAX) {
    return { ok: false, message: `Al massimo ${SPORTS_MAX} sport: togline uno per aggiungerne un altro.` }
  }
  return { ok: true, value: [...current, name] }
}

/** Sport letti dal database (jsonb): solo testi validi, puliti, senza doppioni, al massimo 2. Mai un crash per un dato sporco. */
export function parseSports(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = cleanName(item).slice(0, SPORT_NAME_MAX)
    if (name === '' || result.some((sport) => normalizeText(sport) === normalizeText(name))) continue
    result.push(name)
    if (result.length === SPORTS_MAX) break
  }
  return result
}

/** "Calcio" dopo "Palestra" diventa "calcio" ("Palestra + calcio"); le sigle e i nomi con maiuscole interne restano ("HIIT", "CrossFit"). */
function inSentence(name: string): string {
  return /[A-ZÀ-Ý]/.test(name.slice(1)) ? name : name.charAt(0).toLowerCase() + name.slice(1)
}

/** Posizioni (0-based) degli sport di un tipo di giorno. 'rest' e valori non validi → nessuno; il vecchio 'both' → [0, 1]. */
export function trainingSportIndexes(type: TrainingType): number[] {
  if (type === 'both') return [0, 1]
  const indexes: number[] = []
  for (const part of type.split('+')) {
    const match = /^sport_([1-9])$/.exec(part)
    if (!match) return []
    indexes.push(Number(match[1]) - 1)
  }
  return [...new Set(indexes)].sort((a, b) => a - b)
}

/** Tipo di giorno dagli sport scelti (posizioni 0-based): ordinati, senza doppioni; nessuno = 'rest'. */
export function buildTrainingType(indexes: readonly number[]): TrainingType {
  const unique = [...new Set(indexes)].sort((a, b) => a - b)
  return unique.length === 0 ? 'rest' : unique.map((index) => `sport_${index + 1}`).join('+')
}

/** Tocco su uno sport: lo aggiunge al giorno o, se c'è già, lo toglie. Così "Palestra + calcio" nasce toccandoli uno dopo l'altro. */
export function toggleSportInType(type: TrainingType, index: number): TrainingType {
  const current = trainingSportIndexes(type)
  return buildTrainingType(current.includes(index) ? current.filter((i) => i !== index) : [...current, index])
}

/** Etichetta di un tipo di giorno con gli sport di adesso: "Riposo", "Palestra", "Palestra + calcio + nuoto". */
export function trainingLabel(type: TrainingType, sports: readonly string[]): string {
  const names = trainingSportIndexes(type)
    .map((index) => sports[index])
    .filter((name): name is string => name !== undefined)
  if (names.length === 0) return type === 'rest' ? 'Riposo' : 'Allenamento'
  return names.map((name, i) => (i === 0 ? name : inSentence(name))).join(' + ')
}

/** Tipo di giorno valido con gli sport di adesso: gli sport che non ci sono più si tolgono; se non resta niente, Riposo. */
export function coerceTrainingType(type: TrainingType, sports: readonly string[]): TrainingType {
  return buildTrainingType(trainingSportIndexes(type).filter((index) => index < sports.length))
}
