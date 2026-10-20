import { MUSCLE_KEYS, type Exercise, type MuscleKey } from './exercises'
import { formatNumber, parseDecimal, round } from './numbers'

// Schede di allenamento (Fase 4, ADR-090). Qui solo logica pura: validazione, ripetizioni, pesi, recupero, riordino, raggruppamento.
// Nessun numero di dominio inventato: questi sono solo limiti di sicurezza dei campi (come nei vincoli del database).

export const MAX_DAYS = 10
export const MAX_EXERCISES_PER_DAY = 30
export const MIN_SETS = 1
export const MAX_SETS = 20
export const MAX_REPS = 100
export const MIN_REST_SECONDS = 5
export const MAX_REST_SECONDS = 1800
export const MAX_WEIGHT_KG = 1000
export const PLAN_NAME_MAX = 80
export const DAY_NAME_MAX = 40
export const EXERCISE_NOTE_MAX = 500

/** Valori di partenza di un esercizio appena aggiunto: segnaposto modificabili, non un consiglio di allenamento. */
export const DEFAULT_SETS = 3
export const DEFAULT_REPS = 10

export interface PlanSummary {
  id: string
  name: string
  isArchived: boolean
  dayCount: number
}

export interface PlanDay {
  id: string
  planId: string
  name: string
  /** 1 = lunedì … 7 = domenica, o null. */
  weekday: number | null
  position: number
}

export interface PlanExercise {
  id: string
  dayId: string
  catalogId: string | null
  userExerciseId: string | null
  position: number
  sets: number
  repsMin: number
  repsMax: number | null
  /** Un valore per serie (null = non impostato), al massimo `sets`. */
  weightsKg: (number | null)[]
  restSeconds: number | null
  note: string
}

const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const
export const weekdayLabel = (weekday: number): string => WEEKDAYS[weekday - 1] ?? ''

export type TextResult = { ok: true; value: string } | { ok: false; message: string }

function validateName(input: string, max: number, what: string): TextResult {
  const value = input.trim().replace(/\s+/g, ' ')
  if (value === '') return { ok: false, message: `Scrivi il nome ${what}.` }
  if (value.length > max) return { ok: false, message: `Al massimo ${max} caratteri.` }
  return { ok: true, value }
}
export const validatePlanName = (input: string) => validateName(input, PLAN_NAME_MAX, 'della scheda')
export const validateDayName = (input: string) => validateName(input, DAY_NAME_MAX, 'del giorno')

/** Nomi di partenza per i giorni di una scheda nuova: "Giorno 1", "Giorno 2"… */
export const defaultDayNames = (count: number): string[] => Array.from({ length: count }, (_, index) => `Giorno ${index + 1}`)

export type RepsResult = { ok: true; min: number; max: number | null } | { ok: false; message: string }

/** "10" → 10 fisse; "8-12" (anche con il trattino lungo) → intervallo. Due numeri uguali ("10-10") diventano 10 fisse. */
export function parseReps(input: string): RepsResult {
  const text = input.trim().replace(/[–—]/g, '-').replace(/\s+/g, '')
  const match = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(text)
  if (!match) return { ok: false, message: 'Scrivi un numero (10) o un intervallo (8-12).' }
  const min = Number(match[1])
  const max = match[2] === undefined ? null : Number(match[2])
  if (min < 1 || min > MAX_REPS || (max !== null && (max < 1 || max > MAX_REPS))) return { ok: false, message: `Le ripetizioni vanno da 1 a ${MAX_REPS}.` }
  if (max !== null && max < min) return { ok: false, message: 'Nell’intervallo il primo numero non può superare il secondo.' }
  return { ok: true, min, max: max === null || max === min ? null : max }
}

export const formatReps = (min: number, max: number | null): string => (max === null ? String(min) : `${min}–${max}`)

export type WeightResult = { ok: true; value: number | null } | { ok: false; message: string }

/** Peso in kg con la virgola o il punto; vuoto = non impostato; un decimale al massimo. */
export function parseWeight(input: string): WeightResult {
  if (input.trim() === '') return { ok: true, value: null }
  const value = parseDecimal(input)
  if (value === null || value < 0 || value > MAX_WEIGHT_KG) return { ok: false, message: `Il peso va da 0 a ${formatNumber(MAX_WEIGHT_KG)} kg.` }
  return { ok: true, value: round(value, 1) }
}

export type RestResult = { ok: true; value: number | null } | { ok: false; message: string }

/** Recupero: secondi ("90") o minuti e secondi ("1:30"); vuoto = nessuno. */
export function parseRest(input: string): RestResult {
  const text = input.trim()
  if (text === '') return { ok: true, value: null }
  const mmss = /^(\d{1,2}):([0-5]\d)$/.exec(text)
  const seconds = mmss ? Number(mmss[1]) * 60 + Number(mmss[2]) : /^\d{1,4}$/.test(text) ? Number(text) : null
  if (seconds === null || seconds < MIN_REST_SECONDS || seconds > MAX_REST_SECONDS) {
    return { ok: false, message: `Scrivi i secondi (90) o minuti e secondi (1:30), da ${MIN_REST_SECONDS} s a ${MAX_REST_SECONDS / 60} min.` }
  }
  return { ok: true, value: seconds }
}

export function formatRest(seconds: number | null): string {
  if (seconds === null) return ''
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Nuovo numero di serie: dentro i limiti, e i pesi in più spariscono (le serie tolte non lasciano pesi orfani). */
export function withSets(item: Pick<PlanExercise, 'weightsKg'>, sets: number): { sets: number; weightsKg: (number | null)[] } {
  const clamped = Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(sets)))
  const weightsKg = item.weightsKg.slice(0, clamped)
  while (weightsKg.length > 0 && weightsKg[weightsKg.length - 1] === null) weightsKg.pop()
  return { sets: clamped, weightsKg }
}

/** Peso della serie `index` (0 = prima), null se non impostato. */
export const weightAt = (weights: readonly (number | null)[], index: number): number | null => weights[index] ?? null

/** Aggiorna il peso di una serie, riempiendo con null le serie prima non impostate. */
export function setWeightAt(weights: readonly (number | null)[], index: number, value: number | null, sets: number): (number | null)[] {
  // Una serie fuori dal numero previsto non esiste: nessun peso viene aggiunto.
  if (index < 0 || index >= sets) return weights.slice(0, sets) as (number | null)[]
  const next = Array.from({ length: Math.min(sets, Math.max(weights.length, index + 1)) }, (_, i) => weights[i] ?? null)
  next[index] = value
  // Se in coda non c'è più nessun peso si accorcia l'elenco.
  while (next.length > 0 && next[next.length - 1] === null) next.pop()
  return next
}

/** "3×8–12", con "· 60 kg" se tutte le serie hanno lo stesso peso, o "· 60–65 kg" se cambiano. */
export function describeSets(item: Pick<PlanExercise, 'sets' | 'repsMin' | 'repsMax' | 'weightsKg'>): string {
  const base = `${item.sets}×${formatReps(item.repsMin, item.repsMax)}`
  const weights = item.weightsKg.filter((weight): weight is number => weight !== null)
  if (weights.length === 0) return base
  const low = Math.min(...weights)
  const high = Math.max(...weights)
  return `${base} · ${low === high ? formatNumber(low, 1) : `${formatNumber(low, 1)}–${formatNumber(high, 1)}`} kg`
}

/** Sposta un elemento di un posto (−1 su, +1 giù); ai bordi non fa niente. */
export function moveById<T extends { id: string }>(items: readonly T[], id: string, direction: 1 | -1): T[] {
  const from = items.findIndex((item) => item.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= items.length) return [...items]
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

export interface MuscleGroup {
  muscle: MuscleKey
  exercises: Exercise[]
}

/**
 * Esercizi divisi per gruppo muscolare, per sceglierli in una scheda: ogni esercizio sta sotto il suo primo gruppo
 * principale (una volta sola). I gruppi seguono l'ordine del vocabolario; quelli senza esercizi non compaiono.
 */
export function groupByMuscle(exercises: readonly Exercise[]): MuscleGroup[] {
  const groups = new Map<MuscleKey, Exercise[]>()
  for (const exercise of exercises) {
    const muscle = exercise.primaryMuscles[0]
    if (!muscle) continue
    groups.set(muscle, [...(groups.get(muscle) ?? []), exercise])
  }
  return MUSCLE_KEYS.filter((muscle) => groups.has(muscle)).map((muscle) => ({ muscle, exercises: groups.get(muscle)! }))
}

/** L'esercizio "effettivo" di una riga di scheda (catalogo + copia personale, o esercizio proprio), se esiste ancora nell'elenco. */
export function resolveExercise(item: Pick<PlanExercise, 'catalogId' | 'userExerciseId'>, exercises: readonly Exercise[]): Exercise | undefined {
  return exercises.find((exercise) => (item.catalogId !== null ? exercise.catalogId === item.catalogId : exercise.userExerciseId === item.userExerciseId))
}
