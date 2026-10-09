import { SPORT_NAME_MAX, SPORTS_MAX } from './constants'
import type { TrainingType } from './labels'
import { normalizeText } from './search'

/** Sport suggeriti (scorciatoie): Palestra è consigliata, il resto si scrive liberamente. */
export const RECOMMENDED_SPORT = 'Palestra'
export const SUGGESTED_SPORTS = ['Palestra', 'Calcio', 'Corsa', 'Nuoto', 'Ciclismo', 'Basket', 'Pallavolo', 'Tennis'] as const

/** Nome pulito: spazi sistemati, niente caratteri di controllo, iniziale maiuscola ("calcio a 5" → "Calcio a 5"). */
export function cleanSportName(input: string): string {
  // eslint-disable-next-line no-control-regex
  const text = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return text === '' ? '' : text.charAt(0).toUpperCase() + text.slice(1)
}

export type SportsResult = { ok: true; value: string[] } | { ok: false; message: string }

/** Aggiunge uno sport alla lista: non vuoto, ≤ 24 caratteri, senza doppioni (anche con maiuscole/accenti diversi), al massimo 2. */
export function addSport(current: readonly string[], input: string): SportsResult {
  const name = cleanSportName(input)
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
    const name = cleanSportName(item).slice(0, SPORT_NAME_MAX)
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

export interface DayTypeOption {
  type: TrainingType
  label: string
}

/** Tipi di giorno dell'utente: Riposo, ogni sport, e "A + b" se ne ha due (come prima: Palestra / Calcio / entrambi). */
export function trainingDayTypes(sports: readonly string[]): DayTypeOption[] {
  const [first, second] = sports
  const options: DayTypeOption[] = [{ type: 'rest', label: 'Riposo' }]
  if (first) options.push({ type: 'sport_1', label: first })
  if (second) options.push({ type: 'sport_2', label: second })
  if (first && second) options.push({ type: 'both', label: `${first} + ${inSentence(second)}` })
  return options
}

/** Etichetta di un tipo di giorno con gli sport di adesso; se lo sport non c'è più (profilo cambiato) "Allenamento". */
export function trainingLabel(type: TrainingType, sports: readonly string[]): string {
  return trainingDayTypes(sports).find((option) => option.type === type)?.label ?? (type === 'rest' ? 'Riposo' : 'Allenamento')
}

/** Se il tipo di giorno richiede uno sport che non c'è più, si torna a Riposo (profilo modificato). */
export function coerceTrainingType(type: TrainingType, sports: readonly string[]): TrainingType {
  return trainingDayTypes(sports).some((option) => option.type === type) ? type : 'rest'
}
