import type { EquipmentKey, MuscleKey } from '../lib/exercises'
import { lastKey, type ExerciseStatus, type LastSet, type LastTime, type Session, type SessionExercise, type SessionSet, type SetKind } from '../lib/workoutSession'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

// Sessioni di allenamento (Fase 5a, ADR-091): sessione → esercizi (con istantanea) → serie. RLS: solo righe proprie.
// Ogni riga ha l'id deciso dall'app e si scrive con "inserisci o aggiorna per id": ripetere una richiesta non crea doppioni.

interface SessionRow {
  id: string
  session_date: string
  started_at: string
  ended_at: string | null
  plan_id: string | null
  day_id: string | null
  plan_name: string | null
  day_name: string | null
  note: string | null
}
interface ExerciseRow {
  id: string
  session_id: string
  position: number
  exercise_name: string
  equipment: EquipmentKey
  primary_muscles: MuscleKey[]
  secondary_muscles: MuscleKey[]
  catalog_id: string | null
  user_exercise_id: string | null
  planned_sets: number | null
  planned_reps_min: number | null
  planned_reps_max: number | null
  planned_rest_seconds: number | null
  status: ExerciseStatus
  note: string | null
}
interface SetRow {
  id: string
  session_exercise_id: string
  set_number: number
  kind: SetKind
  weight_kg: number | string | null
  reps: number | null
  done: boolean
  completed_at: string | null
}

const SESSION_COLUMNS = 'id, session_date, started_at, ended_at, plan_id, day_id, plan_name, day_name, note'
const EXERCISE_COLUMNS =
  'id, session_id, position, exercise_name, equipment, primary_muscles, secondary_muscles, catalog_id, user_exercise_id, planned_sets, planned_reps_min, planned_reps_max, planned_rest_seconds, status, note'
const SET_COLUMNS = 'id, session_exercise_id, set_number, kind, weight_kg, reps, done, completed_at'

const toSet = (row: SetRow): SessionSet => ({
  id: row.id,
  number: row.set_number,
  kind: row.kind,
  weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
  reps: row.reps,
  done: row.done,
  completedAt: row.completed_at,
})

const setRow = (exerciseId: string, set: SessionSet) => ({
  id: set.id,
  session_exercise_id: exerciseId,
  set_number: set.number,
  kind: set.kind,
  weight_kg: set.weightKg,
  reps: set.reps,
  done: set.done,
  completed_at: set.completedAt,
})

const exerciseRow = (sessionId: string, exercise: SessionExercise) => ({
  id: exercise.id,
  session_id: sessionId,
  position: exercise.position,
  exercise_name: exercise.name,
  equipment: exercise.equipment,
  primary_muscles: exercise.primaryMuscles,
  secondary_muscles: exercise.secondaryMuscles,
  catalog_id: exercise.catalogId,
  user_exercise_id: exercise.userExerciseId,
  planned_sets: exercise.plannedSets,
  planned_reps_min: exercise.plannedRepsMin,
  planned_reps_max: exercise.plannedRepsMax,
  planned_rest_seconds: exercise.plannedRestSeconds,
  status: exercise.status,
  note: exercise.note.trim() === '' ? null : exercise.note,
})

const IN_LIMIT = 200

export async function getSession(id: string): Promise<Session | null> {
  const supabase = getSupabase()
  const { data: session, error } = await supabase.from('workout_sessions').select(SESSION_COLUMNS).eq('id', id).maybeSingle()
  throwIfError(error)
  if (!session) return null
  const { data: exercises, error: exercisesError } = await supabase.from('workout_session_exercises').select(EXERCISE_COLUMNS).eq('session_id', id).order('position').order('created_at')
  throwIfError(exercisesError)
  const exerciseRows = (exercises ?? []) as ExerciseRow[]
  let setRows: SetRow[] = []
  if (exerciseRows.length > 0) {
    const result = await supabase.from('workout_sets').select(SET_COLUMNS).in('session_exercise_id', exerciseRows.map((row) => row.id)).order('set_number')
    throwIfError(result.error)
    setRows = (result.data ?? []) as SetRow[]
  }
  const row = session as SessionRow
  return {
    id: row.id,
    date: row.session_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    planId: row.plan_id,
    dayId: row.day_id,
    planName: row.plan_name,
    dayName: row.day_name,
    note: row.note ?? '',
    exercises: exerciseRows.map((exercise) => ({
      id: exercise.id,
      position: exercise.position,
      name: exercise.exercise_name,
      equipment: exercise.equipment,
      primaryMuscles: exercise.primary_muscles,
      secondaryMuscles: exercise.secondary_muscles,
      catalogId: exercise.catalog_id,
      userExerciseId: exercise.user_exercise_id,
      plannedSets: exercise.planned_sets,
      plannedRepsMin: exercise.planned_reps_min,
      plannedRepsMax: exercise.planned_reps_max,
      plannedRestSeconds: exercise.planned_rest_seconds,
      status: exercise.status,
      note: exercise.note ?? '',
      sets: setRows.filter((set) => set.session_exercise_id === exercise.id).map(toSet),
    })),
  }
}

/** La sessione iniziata e non ancora terminata più recente (per "Riprendi allenamento"), o null. */
export async function getActiveSession(): Promise<{ id: string; startedAt: string; dayName: string | null; planName: string | null } | null> {
  const { data, error } = await getSupabase()
    .from('workout_sessions')
    .select('id, started_at, plan_name, day_name')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  throwIfError(error)
  if (!data) return null
  const row = data as { id: string; started_at: string; plan_name: string | null; day_name: string | null }
  return { id: row.id, startedAt: row.started_at, dayName: row.day_name, planName: row.plan_name }
}

export interface SessionListItem {
  id: string
  planId: string | null
  dayId: string | null
  date: string
  startedAt: string
  endedAt: string | null
  planName: string | null
  dayName: string | null
  exercisesDone: number
  exercisesTotal: number
  workSets: number
}

export async function listRecentSessions(limit = 20): Promise<SessionListItem[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('workout_sessions').select('id, session_date, started_at, ended_at, plan_id, day_id, plan_name, day_name').order('started_at', { ascending: false }).limit(limit)
  throwIfError(error)
  const sessions = (data ?? []) as { id: string; session_date: string; started_at: string; ended_at: string | null; plan_id: string | null; day_id: string | null; plan_name: string | null; day_name: string | null }[]
  if (sessions.length === 0) return []
  const exercises = await supabase.from('workout_session_exercises').select('id, session_id, status').in('session_id', sessions.map((session) => session.id)).limit(2000)
  throwIfError(exercises.error)
  const exerciseRows = (exercises.data ?? []) as { id: string; session_id: string; status: ExerciseStatus }[]
  let sets: { session_exercise_id: string }[] = []
  if (exerciseRows.length > 0) {
    const result = await supabase.from('workout_sets').select('session_exercise_id').in('session_exercise_id', exerciseRows.map((row) => row.id).slice(0, IN_LIMIT * 5)).eq('done', true).neq('kind', 'warmup').limit(5000)
    throwIfError(result.error)
    sets = (result.data ?? []) as { session_exercise_id: string }[]
  }
  const ownerOf = new Map(exerciseRows.map((row) => [row.id, row.session_id]))
  return sessions.map((session) => {
    const own = exerciseRows.filter((row) => row.session_id === session.id)
    return {
      id: session.id,
      planId: session.plan_id,
      dayId: session.day_id,
      date: session.session_date,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      planName: session.plan_name,
      dayName: session.day_name,
      exercisesDone: own.filter((row) => row.status === 'done').length,
      exercisesTotal: own.length,
      workSets: sets.filter((set) => ownerOf.get(set.session_exercise_id) === session.id).length,
    }
  })
}

/** "Ultima volta" di più esercizi in una richiesta sola (funzione SQL last_sets). Chiave: `lastKey`. */
export async function fetchLastTimes(refs: readonly { catalogId: string | null; userExerciseId: string | null }[]): Promise<Map<string, LastTime>> {
  const catalogIds = [...new Set(refs.flatMap((ref) => (ref.catalogId ? [ref.catalogId] : [])))]
  const userIds = [...new Set(refs.flatMap((ref) => (ref.userExerciseId ? [ref.userExerciseId] : [])))]
  const result = new Map<string, LastTime>()
  if (catalogIds.length === 0 && userIds.length === 0) return result
  const { data, error } = await getSupabase().rpc('last_sets', { p_catalog_ids: catalogIds, p_user_exercise_ids: userIds })
  throwIfError(error)
  for (const row of (data ?? []) as { catalog_id: string | null; user_exercise_id: string | null; session_date: string; set_number: number; kind: SetKind; weight_kg: number | string | null; reps: number | null }[]) {
    const key = lastKey({ catalogId: row.catalog_id, userExerciseId: row.user_exercise_id })
    const entry = result.get(key) ?? { date: row.session_date, sets: [] as LastSet[] }
    entry.sets.push({ number: row.set_number, kind: row.kind, weightKg: row.weight_kg === null ? null : Number(row.weight_kg), reps: row.reps })
    result.set(key, entry)
  }
  return result
}

async function upsertRows(table: string, rows: Record<string, unknown>[], ignoreDuplicates: boolean): Promise<void> {
  if (rows.length === 0) return
  const { error } = await getSupabase().from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates })
  throwIfError(error)
}

/** Crea la sessione intera (esercizi e serie compresi). Ripetibile: le righe già salvate non si duplicano. */
export async function insertSession(session: Session): Promise<void> {
  await upsertRows(
    'workout_sessions',
    [
      {
        id: session.id,
        session_date: session.date,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        plan_id: session.planId,
        day_id: session.dayId,
        plan_name: session.planName,
        day_name: session.dayName,
        note: session.note.trim() === '' ? null : session.note,
      },
    ],
    true,
  )
  await upsertRows('workout_session_exercises', session.exercises.map((exercise) => exerciseRow(session.id, exercise)), true)
  await upsertRows('workout_sets', session.exercises.flatMap((exercise) => exercise.sets.map((set) => setRow(exercise.id, set))), true)
}

/** Aggiunge un esercizio (con le sue serie) a una sessione già salvata. */
export async function insertSessionExercise(sessionId: string, exercise: SessionExercise): Promise<void> {
  await upsertRows('workout_session_exercises', [exerciseRow(sessionId, exercise)], true)
  await upsertRows('workout_sets', exercise.sets.map((set) => setRow(exercise.id, set)), true)
}

/** Salva i valori di una o più serie di un esercizio (inserisce o aggiorna per id). */
export async function saveSets(exerciseId: string, sets: readonly SessionSet[]): Promise<void> {
  await upsertRows('workout_sets', sets.map((set) => setRow(exerciseId, set)), false)
}

export async function deleteSetRow(id: string): Promise<void> {
  const { error } = await getSupabase().from('workout_sets').delete().eq('id', id)
  throwIfError(error)
}

export async function saveExerciseFields(id: string, fields: { status?: ExerciseStatus; note?: string }): Promise<void> {
  const columns: Record<string, unknown> = {}
  if (fields.status !== undefined) columns.status = fields.status
  if (fields.note !== undefined) columns.note = fields.note.trim() === '' ? null : fields.note
  const { error } = await getSupabase().from('workout_session_exercises').update(columns).eq('id', id)
  throwIfError(error)
}

export async function deleteSessionExerciseRow(id: string): Promise<void> {
  const { error } = await getSupabase().from('workout_session_exercises').delete().eq('id', id)
  throwIfError(error)
}

export async function saveSessionFields(id: string, fields: { endedAt?: string | null; note?: string }): Promise<void> {
  const columns: Record<string, unknown> = {}
  if (fields.endedAt !== undefined) columns.ended_at = fields.endedAt
  if (fields.note !== undefined) columns.note = fields.note.trim() === '' ? null : fields.note
  const { error } = await getSupabase().from('workout_sessions').update(columns).eq('id', id)
  throwIfError(error)
}

export async function deleteSessionRow(id: string): Promise<void> {
  const { error } = await getSupabase().from('workout_sessions').delete().eq('id', id)
  throwIfError(error)
}
