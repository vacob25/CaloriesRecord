import { isGoal } from '../lib/goals'
import type { ParamsValues, PersonalValues, PlanValues } from '../lib/profileValidation'
import { parseSports } from '../lib/sports'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'
import type { Profile } from './types'

interface ProfileRow {
  sex: 'male' | 'female'
  birth_date: string
  height_cm: number | string
  activity_factor: number | string
  surplus_pct: number | string
  training_bonus_kcal: number
  goal_weight_kg: number | string | null
  protein_g_per_kg: number | string
  fat_g_per_kg: number | string
  water_goal_ml: number | null
  goal: string
  cut_rate_pct: number | string
  sports: unknown
  tutorial_done_at: string | null
}

const PROFILE_COLUMNS =
  'sex, birth_date, height_cm, activity_factor, surplus_pct, training_bonus_kcal, goal_weight_kg, protein_g_per_kg, fat_g_per_kg, water_goal_ml, goal, cut_rate_pct, sports, tutorial_done_at'

function toProfile(row: ProfileRow): Profile {
  return {
    sex: row.sex,
    birthDate: row.birth_date,
    heightCm: Number(row.height_cm),
    activityFactor: Number(row.activity_factor),
    surplusPct: Number(row.surplus_pct),
    trainingBonusKcal: Number(row.training_bonus_kcal),
    goalWeightKg: row.goal_weight_kg === null ? null : Number(row.goal_weight_kg),
    proteinGPerKg: Number(row.protein_g_per_kg),
    fatGPerKg: Number(row.fat_g_per_kg),
    waterGoalMl: row.water_goal_ml,
    goal: isGoal(row.goal) ? row.goal : 'bulk',
    cutRatePct: Number(row.cut_rate_pct),
    sports: parseSports(row.sports),
    tutorialDoneAt: row.tutorial_done_at,
  }
}

/** Il profilo dell'utente, o null se non è ancora stato creato (prima apertura). */
export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await getSupabase().from('profiles').select(PROFILE_COLUMNS).maybeSingle()
  throwIfError(error)
  return data ? toProfile(data as ProfileRow) : null
}


/** Crea il profilo con l'obiettivo, gli sport e il fattore di attività scelti; gli altri parametri prendono i default (DATA_MODEL.md). */
export async function createProfile(values: PersonalValues, plan: PlanValues, activityFactor: number): Promise<void> {
  const { error } = await getSupabase().from('profiles').insert({
    sex: values.sex,
    birth_date: values.birthDate,
    height_cm: values.heightCm,
    goal_weight_kg: values.goalWeightKg,
    goal: plan.goal,
    cut_rate_pct: plan.cutRatePct,
    sports: plan.sports,
    activity_factor: activityFactor,
  })
  throwIfError(error)
}

/** Cambia obiettivo, ritmo del cut e sport (Profilo). I giorni passati non cambiano (ADR-039). */
export async function updatePlan(plan: PlanValues): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update({ goal: plan.goal, cut_rate_pct: plan.cutRatePct, sports: plan.sports })
    .not('user_id', 'is', null)
  throwIfError(error)
}

/** Il tutorial è stato finito (o saltato): non si ripropone da solo. `null` lo fa rivedere. */
export async function setTutorialDone(done: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update({ tutorial_done_at: done ? new Date().toISOString() : null })
    .not('user_id', 'is', null)
  throwIfError(error)
}

export async function updatePersonal(values: PersonalValues): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update({ sex: values.sex, birth_date: values.birthDate, height_cm: values.heightCm, goal_weight_kg: values.goalWeightKg })
    .not('user_id', 'is', null)
  throwIfError(error)
}

export async function updateParams(values: ParamsValues): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      activity_factor: values.activityFactor,
      surplus_pct: values.surplusPct,
      training_bonus_kcal: values.trainingBonusKcal,
      protein_g_per_kg: values.proteinGPerKg,
      fat_g_per_kg: values.fatGPerKg,
    })
    .not('user_id', 'is', null)
  throwIfError(error)
}
