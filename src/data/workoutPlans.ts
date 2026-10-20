import type { PlanDay, PlanExercise, PlanSummary } from '../lib/workoutPlans'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

// Schede di allenamento (Fase 4, ADR-090): scheda → giorni → esercizi del giorno. RLS: solo righe proprie.

interface PlanRow {
  id: string
  name: string
  is_archived: boolean
}
interface DayRow {
  id: string
  plan_id: string
  name: string
  weekday: number | null
  position: number
}
interface ItemRow {
  id: string
  day_id: string
  catalog_id: string | null
  user_exercise_id: string | null
  position: number
  sets: number
  reps_min: number
  reps_max: number | null
  weights_kg: (number | string | null)[] | null
  rest_seconds: number | null
  note: string | null
}

const ITEM_COLUMNS = 'id, day_id, catalog_id, user_exercise_id, position, sets, reps_min, reps_max, weights_kg, rest_seconds, note'

const toDay = (row: DayRow): PlanDay => ({ id: row.id, planId: row.plan_id, name: row.name, weekday: row.weekday, position: row.position })
const toItem = (row: ItemRow): PlanExercise => ({
  id: row.id,
  dayId: row.day_id,
  catalogId: row.catalog_id,
  userExerciseId: row.user_exercise_id,
  position: row.position,
  sets: row.sets,
  repsMin: row.reps_min,
  repsMax: row.reps_max,
  weightsKg: (row.weights_kg ?? []).map((weight) => (weight === null ? null : Number(weight))),
  restSeconds: row.rest_seconds,
  note: row.note ?? '',
})

export async function listPlans(): Promise<PlanSummary[]> {
  const [plans, days] = await Promise.all([
    getSupabase().from('workout_plans').select('id, name, is_archived').order('created_at', { ascending: false }),
    getSupabase().from('workout_days').select('plan_id'),
  ])
  throwIfError(plans.error)
  throwIfError(days.error)
  const counts = new Map<string, number>()
  for (const day of (days.data ?? []) as { plan_id: string }[]) counts.set(day.plan_id, (counts.get(day.plan_id) ?? 0) + 1)
  return ((plans.data ?? []) as PlanRow[]).map((row) => ({ id: row.id, name: row.name, isArchived: row.is_archived, dayCount: counts.get(row.id) ?? 0 }))
}

export interface PlanDetail {
  plan: { id: string; name: string; isArchived: boolean }
  days: PlanDay[]
  items: PlanExercise[]
}

export async function getPlan(id: string): Promise<PlanDetail | null> {
  const [plan, days] = await Promise.all([
    getSupabase().from('workout_plans').select('id, name, is_archived').eq('id', id).maybeSingle(),
    getSupabase().from('workout_days').select('id, plan_id, name, weekday, position').eq('plan_id', id).order('position').order('created_at'),
  ])
  throwIfError(plan.error)
  throwIfError(days.error)
  if (!plan.data) return null
  const dayRows = (days.data ?? []) as DayRow[]
  let items: PlanExercise[] = []
  if (dayRows.length > 0) {
    const result = await getSupabase()
      .from('workout_day_exercises')
      .select(ITEM_COLUMNS)
      .in('day_id', dayRows.map((day) => day.id))
      .order('position')
      .order('created_at')
    throwIfError(result.error)
    items = ((result.data ?? []) as ItemRow[]).map(toItem)
  }
  const row = plan.data as PlanRow
  return { plan: { id: row.id, name: row.name, isArchived: row.is_archived }, days: dayRows.map(toDay), items }
}

/** Crea la scheda con i suoi giorni. Se i giorni non si salvano, la scheda appena creata viene tolta (niente schede vuote a metà). */
export async function createPlan(name: string, days: { name: string; weekday: number | null }[]): Promise<string> {
  const { data, error } = await getSupabase().from('workout_plans').insert({ name }).select('id').single()
  throwIfError(error)
  const planId = (data as { id: string }).id
  const rows = days.map((day, position) => ({ plan_id: planId, name: day.name, weekday: day.weekday, position }))
  const result = await getSupabase().from('workout_days').insert(rows)
  if (result.error) {
    await getSupabase().from('workout_plans').delete().eq('id', planId)
    throwIfError(result.error)
  }
  return planId
}

export async function renamePlan(id: string, name: string): Promise<void> {
  const { error } = await getSupabase().from('workout_plans').update({ name }).eq('id', id)
  throwIfError(error)
}

export async function setPlanArchived(id: string, isArchived: boolean): Promise<void> {
  const { error } = await getSupabase().from('workout_plans').update({ is_archived: isArchived }).eq('id', id)
  throwIfError(error)
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await getSupabase().from('workout_plans').delete().eq('id', id)
  throwIfError(error)
}

export async function duplicatePlan(id: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('duplicate_workout_plan', { p_plan_id: id })
  throwIfError(error)
  return data as string
}

export async function addDay(planId: string, name: string, position: number): Promise<string> {
  const { data, error } = await getSupabase().from('workout_days').insert({ plan_id: planId, name, position }).select('id').single()
  throwIfError(error)
  return (data as { id: string }).id
}

export async function updateDay(id: string, patch: { name?: string; weekday?: number | null }): Promise<void> {
  const { error } = await getSupabase().from('workout_days').update(patch).eq('id', id)
  throwIfError(error)
}

export async function reorderDays(ids: readonly string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, position) => getSupabase().from('workout_days').update({ position }).eq('id', id)))
  for (const result of results) throwIfError(result.error)
}

export async function deleteDay(id: string): Promise<void> {
  const { error } = await getSupabase().from('workout_days').delete().eq('id', id)
  throwIfError(error)
}

export async function duplicateDay(id: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('duplicate_workout_day', { p_day_id: id })
  throwIfError(error)
  return data as string
}

export interface NewPlanExercise {
  dayId: string
  catalogId: string | null
  userExerciseId: string | null
  position: number
  sets: number
  repsMin: number
}

export async function addPlanExercise(values: NewPlanExercise): Promise<void> {
  const { error } = await getSupabase().from('workout_day_exercises').insert({
    day_id: values.dayId,
    catalog_id: values.catalogId,
    user_exercise_id: values.userExerciseId,
    position: values.position,
    sets: values.sets,
    reps_min: values.repsMin,
  })
  throwIfError(error)
}

export interface PlanExercisePatch {
  sets?: number
  repsMin?: number
  repsMax?: number | null
  weightsKg?: (number | null)[]
  restSeconds?: number | null
  note?: string
}

export async function updatePlanExercise(id: string, patch: PlanExercisePatch): Promise<void> {
  const columns: Record<string, unknown> = {}
  if (patch.sets !== undefined) columns.sets = patch.sets
  if (patch.repsMin !== undefined) columns.reps_min = patch.repsMin
  if (patch.repsMax !== undefined) columns.reps_max = patch.repsMax
  if (patch.weightsKg !== undefined) columns.weights_kg = patch.weightsKg
  if (patch.restSeconds !== undefined) columns.rest_seconds = patch.restSeconds
  if (patch.note !== undefined) columns.note = patch.note.trim() === '' ? null : patch.note
  const { error } = await getSupabase().from('workout_day_exercises').update(columns).eq('id', id)
  throwIfError(error)
}

export async function reorderPlanExercises(ids: readonly string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, position) => getSupabase().from('workout_day_exercises').update({ position }).eq('id', id)))
  for (const result of results) throwIfError(result.error)
}

export async function removePlanExercise(id: string): Promise<void> {
  const { error } = await getSupabase().from('workout_day_exercises').delete().eq('id', id)
  throwIfError(error)
}
