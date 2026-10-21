import { formatNumber } from './numbers'
import type { EquipmentKey, Exercise, MuscleKey } from './exercises'
import { DEFAULT_SETS, type PlanDay, type PlanExercise, resolveExercise } from './workoutPlans'

// Sessione di allenamento (Fase 5, ADR-091). Logica pura: costruzione dalla scheda, precompilazione con l'ultima volta, modifiche
// (funzioni che restituiscono la sessione nuova), timer di recupero e riepilogo. Il tempo entra sempre come parametro `now`:
// il timer si calcola da orari salvati, non da un contatore (iOS sospende i timer in secondo piano).

export type SetKind = 'warmup' | 'normal' | 'drop'
export type ExerciseStatus = 'todo' | 'done' | 'skipped'

export const SET_KIND_LABEL: Record<SetKind, string> = { warmup: 'Riscaldamento', normal: 'Normale', drop: 'Drop set' }
export const STATUS_LABEL: Record<ExerciseStatus, string> = { todo: 'Da fare', done: 'Fatto', skipped: 'Saltato' }
export const MAX_SESSION_SETS = 50

export interface SessionSet {
  id: string
  number: number
  kind: SetKind
  weightKg: number | null
  reps: number | null
  done: boolean
  /** ISO 8601, presente solo se la serie è spuntata. */
  completedAt: string | null
}

export interface SessionExercise {
  id: string
  position: number
  name: string
  equipment: EquipmentKey
  primaryMuscles: MuscleKey[]
  secondaryMuscles: MuscleKey[]
  catalogId: string | null
  userExerciseId: string | null
  plannedSets: number | null
  plannedRepsMin: number | null
  plannedRepsMax: number | null
  plannedRestSeconds: number | null
  status: ExerciseStatus
  note: string
  sets: SessionSet[]
}

export interface Session {
  id: string
  /** Giorno locale Europe/Rome 'YYYY-MM-DD'. */
  date: string
  startedAt: string
  endedAt: string | null
  planId: string | null
  dayId: string | null
  planName: string | null
  dayName: string | null
  note: string
  exercises: SessionExercise[]
}

/** Le serie dell'ultima volta per un esercizio (solo quelle fatte, dall'ultima sessione terminata). */
export interface LastSet {
  number: number
  kind: SetKind
  weightKg: number | null
  reps: number | null
}
export interface LastTime {
  date: string
  sets: LastSet[]
}

/** Chiave per ritrovare l'ultima volta di un esercizio, che sia del catalogo o personale. */
export const lastKey = (ref: { catalogId: string | null; userExerciseId: string | null }): string =>
  ref.catalogId !== null ? `c:${ref.catalogId}` : ref.userExerciseId !== null ? `u:${ref.userExerciseId}` : ''

/**
 * Giorno da proporre: quello che coincide con il giorno della settimana di oggi; altrimenti il successivo (in ordine di scheda)
 * al giorno dell'ultima sessione; altrimenti il primo. Solo un suggerimento: la scelta resta all'utente.
 */
export function suggestDay(days: readonly PlanDay[], todayWeekday: number, lastDayId: string | null): string | null {
  if (days.length === 0) return null
  const today = days.find((day) => day.weekday === todayWeekday)
  if (today) return today.id
  const index = lastDayId === null ? -1 : days.findIndex((day) => day.id === lastDayId)
  return days[(index + 1) % days.length]!.id
}

/** Giorno della settimana ISO (1 = lunedì … 7 = domenica) di un giorno locale 'YYYY-MM-DD'. */
export function isoWeekday(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1, 12)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

/**
 * Serie di partenza di un esercizio della scheda. Per ogni serie prevista: peso e ripetizioni dell'ultima volta (stessa serie,
 * o l'ultima fatta se ora ce ne sono di più); se non c'è un'ultima volta, il peso scritto in scheda e le ripetizioni previste per quella serie.
 * I riscaldamenti dell'ultima volta non si ripropongono.
 */
export function prefillSets(
  planned: Pick<PlanExercise, 'sets' | 'repsMin' | 'repsPerSet' | 'weightsKg'>,
  last: LastTime | undefined,
  newId: () => string,
): SessionSet[] {
  const work = (last?.sets ?? []).filter((set) => set.kind !== 'warmup')
  return Array.from({ length: planned.sets }, (_, index) => {
    const reference = work[index] ?? work[work.length - 1]
    return {
      id: newId(),
      number: index + 1,
      kind: 'normal' as const,
      weightKg: reference?.weightKg ?? planned.weightsKg[index] ?? null,
      reps: reference?.reps ?? planned.repsPerSet[index] ?? planned.repsMin,
      done: false,
      completedAt: null,
    }
  })
}

/** "3×8 a 60 kg", "3 serie (8/8/6) a 60–62,5 kg", o '' se non ci sono serie di lavoro. */
export function summarizeLast(last: LastTime | undefined): string {
  const work = (last?.sets ?? []).filter((set) => set.kind !== 'warmup')
  if (work.length === 0) return ''
  const reps = work.map((set) => set.reps).filter((value): value is number => value !== null)
  const weights = work.map((set) => set.weightKg).filter((value): value is number => value !== null)
  const repsText = reps.length === 0 ? `${work.length} serie` : reps.every((value) => value === reps[0]) ? `${work.length}×${reps[0]}` : `${work.length} serie (${reps.join('/')})`
  if (weights.length === 0) return repsText
  const low = Math.min(...weights)
  const high = Math.max(...weights)
  return `${repsText} a ${low === high ? formatNumber(low, 1) : `${formatNumber(low, 1)}–${formatNumber(high, 1)}`} kg`
}

export interface BuildSessionInput {
  id: string
  date: string
  now: string
  plan: { id: string; name: string } | null
  day: PlanDay | null
  items: readonly PlanExercise[]
  exercises: readonly Exercise[]
  last: ReadonlyMap<string, LastTime>
}

/**
 * Sessione nuova dal giorno di una scheda (o libera, senza `day`). Ogni esercizio porta l'istantanea di nome, attrezzo e gruppi
 * di adesso. Un esercizio della scheda che non esiste più nell'elenco viene saltato (non c'è nulla da copiare).
 */
export function buildSession(input: BuildSessionInput, newId: () => string): Session {
  const exercises: SessionExercise[] = []
  for (const item of input.items) {
    const exercise = resolveExercise(item, input.exercises)
    if (!exercise) continue
    exercises.push({
      id: newId(),
      position: exercises.length,
      name: exercise.name,
      equipment: exercise.equipment,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      catalogId: item.catalogId,
      userExerciseId: item.userExerciseId,
      plannedSets: item.sets,
      plannedRepsMin: item.repsMin,
      plannedRepsMax: item.repsMax,
      plannedRestSeconds: item.restSeconds,
      status: 'todo',
      note: '',
      sets: prefillSets(item, input.last.get(lastKey(item)), newId),
    })
  }
  return {
    id: input.id,
    date: input.date,
    startedAt: input.now,
    endedAt: null,
    planId: input.plan?.id ?? null,
    dayId: input.day?.id ?? null,
    planName: input.plan?.name ?? null,
    dayName: input.day?.name ?? null,
    note: '',
    exercises,
  }
}

/** Esercizio aggiunto durante l'allenamento (non previsto in scheda). Una serie in più delle fatte l'ultima volta, o 3 vuote. */
export function newExerciseFor(exercise: Exercise, position: number, last: LastTime | undefined, newId: () => string): SessionExercise {
  const work = (last?.sets ?? []).filter((set) => set.kind !== 'warmup')
  const count = work.length > 0 ? work.length : DEFAULT_SETS
  return {
    id: newId(),
    position,
    name: exercise.name,
    equipment: exercise.equipment,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    catalogId: exercise.catalogId,
    userExerciseId: exercise.catalogId ? null : exercise.userExerciseId,
    plannedSets: null,
    plannedRepsMin: null,
    plannedRepsMax: null,
    plannedRestSeconds: null,
    status: 'todo',
    note: '',
    sets: Array.from({ length: count }, (_, index) => ({
      id: newId(),
      number: index + 1,
      kind: 'normal' as const,
      weightKg: work[index]?.weightKg ?? work[work.length - 1]?.weightKg ?? null,
      reps: work[index]?.reps ?? work[work.length - 1]?.reps ?? null,
      done: false,
      completedAt: null,
    })),
  }
}

// ── Modifiche: ognuna restituisce la sessione nuova, senza toccare quella vecchia ───────────────────────────────────────

const mapExercise = (session: Session, exerciseId: string, change: (exercise: SessionExercise) => SessionExercise): Session => ({
  ...session,
  exercises: session.exercises.map((exercise) => (exercise.id === exerciseId ? change(exercise) : exercise)),
})

const renumber = (sets: SessionSet[]): SessionSet[] => sets.map((set, index) => ({ ...set, number: index + 1 }))

export function findSet(session: Session, setId: string): { exercise: SessionExercise; set: SessionSet } | null {
  for (const exercise of session.exercises) {
    const set = exercise.sets.find((candidate) => candidate.id === setId)
    if (set) return { exercise, set }
  }
  return null
}

export function updateSet(session: Session, setId: string, patch: Partial<Pick<SessionSet, 'kind' | 'weightKg' | 'reps'>>): Session {
  const found = findSet(session, setId)
  if (!found) return session
  return mapExercise(session, found.exercise.id, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) }))
}

/**
 * Spunta o toglie la spunta a una serie. Spuntando, se l'esercizio era "da fare" diventa "fatto" (hai iniziato a farlo);
 * se era "saltato" torna "da fare"→"fatto": lo stato "saltato" non resta con serie fatte. Togliendo la spunta lo stato non cambia.
 */
export function toggleSetDone(session: Session, setId: string, now: string): Session {
  const found = findSet(session, setId)
  if (!found) return session
  const done = !found.set.done
  return mapExercise(session, found.exercise.id, (exercise) => ({
    ...exercise,
    status: done && exercise.status !== 'done' ? 'done' : exercise.status,
    sets: exercise.sets.map((set) => (set.id === setId ? { ...set, done, completedAt: done ? now : null } : set)),
  }))
}

/** Aggiunge una serie in fondo, con peso e ripetizioni della serie precedente (di norma si ripetono). Al massimo 50. */
export function addSet(session: Session, exerciseId: string, newId: () => string): Session {
  return mapExercise(session, exerciseId, (exercise) => {
    if (exercise.sets.length >= MAX_SESSION_SETS) return exercise
    const previous = exercise.sets[exercise.sets.length - 1]
    return {
      ...exercise,
      sets: [...exercise.sets, { id: newId(), number: exercise.sets.length + 1, kind: previous?.kind === 'warmup' ? 'normal' : (previous?.kind ?? 'normal'), weightKg: previous?.weightKg ?? null, reps: previous?.reps ?? null, done: false, completedAt: null }],
    }
  })
}

export function removeSet(session: Session, setId: string): Session {
  const found = findSet(session, setId)
  if (!found) return session
  return mapExercise(session, found.exercise.id, (exercise) => ({ ...exercise, sets: renumber(exercise.sets.filter((set) => set.id !== setId)) }))
}

export function setStatus(session: Session, exerciseId: string, status: ExerciseStatus): Session {
  return mapExercise(session, exerciseId, (exercise) => ({ ...exercise, status }))
}

export function setExerciseNote(session: Session, exerciseId: string, note: string): Session {
  return mapExercise(session, exerciseId, (exercise) => ({ ...exercise, note }))
}

export function appendExercise(session: Session, exercise: SessionExercise): Session {
  return { ...session, exercises: [...session.exercises, { ...exercise, position: session.exercises.length }] }
}

export function removeExercise(session: Session, exerciseId: string): Session {
  return { ...session, exercises: session.exercises.filter((exercise) => exercise.id !== exerciseId).map((exercise, position) => ({ ...exercise, position })) }
}

export const finishSession = (session: Session, now: string): Session => ({ ...session, endedAt: session.endedAt ?? now })

// ── Timer e riepilogo ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Secondi dall'ultima serie spuntata (di qualunque tipo), null se non ce n'è. Calcolato da orari, regge al telefono bloccato. */
export function restElapsedSeconds(session: Session, now: string): number | null {
  let latest = 0
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.done && set.completedAt) latest = Math.max(latest, Date.parse(set.completedAt))
    }
  }
  if (latest === 0) return null
  return Math.max(0, Math.floor((Date.parse(now) - latest) / 1000))
}

/** "1:05" sotto l'ora, "1:02:05" da un'ora in su. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** Secondi dall'inizio dell'allenamento (alla fine, se è finito). */
export function sessionElapsedSeconds(session: Session, now: string): number {
  return Math.max(0, Math.floor((Date.parse(session.endedAt ?? now) - Date.parse(session.startedAt)) / 1000))
}

export interface SessionSummary {
  exercisesDone: number
  exercisesSkipped: number
  exercisesTodo: number
  /** Serie di lavoro spuntate (i riscaldamenti non contano). */
  workSets: number
  warmupSets: number
  skippedNames: string[]
  /** Minuti interi dall'inizio alla fine (o a `now` se non è finita). */
  minutes: number
}

export function summarizeSession(session: Session, now: string): SessionSummary {
  const sets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.done)
  return {
    exercisesDone: session.exercises.filter((exercise) => exercise.status === 'done').length,
    exercisesSkipped: session.exercises.filter((exercise) => exercise.status === 'skipped').length,
    exercisesTodo: session.exercises.filter((exercise) => exercise.status === 'todo').length,
    workSets: sets.filter((set) => set.kind !== 'warmup').length,
    warmupSets: sets.filter((set) => set.kind === 'warmup').length,
    skippedNames: session.exercises.filter((exercise) => exercise.status === 'skipped').map((exercise) => exercise.name),
    minutes: Math.max(0, Math.floor((Date.parse(session.endedAt ?? now) - Date.parse(session.startedAt)) / 60_000)),
  }
}

export type DoneRepsResult = { ok: true; value: number | null } | { ok: false; message: string }

/** Ripetizioni fatte: un intero 0-200; vuoto = non impostate. */
export function parseDoneReps(input: string): DoneRepsResult {
  const text = input.trim()
  if (text === '') return { ok: true, value: null }
  if (!/^\d{1,3}$/.test(text) || Number(text) > 200) return { ok: false, message: 'Scrivi le ripetizioni (un numero da 0 a 200).' }
  return { ok: true, value: Number(text) }
}
