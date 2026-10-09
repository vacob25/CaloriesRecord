import type { TrainingType } from '../lib/labels'
import { coerceTrainingType } from '../lib/sports'
import { computeDayTarget, withTrainingType, type DayTargetValues } from '../lib/targets'
import { weightForDay } from '../lib/weight'
import { throwIfError } from './dbErrors'
import { getProfile } from './profile'
import { getSupabase } from './supabase'
import type { DailyTarget } from './types'
import { recentWeightsUntil } from './weights'

interface TargetRow {
  target_date: string
  training_type: TrainingType
  target_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  maintenance_kcal: number
}

const TARGET_COLUMNS = 'target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal'

const toTarget = (row: TargetRow): DailyTarget => ({
  date: row.target_date,
  trainingType: row.training_type,
  targetKcal: row.target_kcal,
  protein: row.protein_g,
  carbs: row.carbs_g,
  fat: row.fat_g,
  maintenanceKcal: row.maintenance_kcal,
})

const toRow = (date: string, values: DayTargetValues) => ({
  target_date: date,
  training_type: values.trainingType,
  target_kcal: values.targetKcal,
  protein_g: values.macros.protein,
  carbs_g: values.macros.carbs,
  fat_g: values.macros.fat,
  maintenance_kcal: values.maintenanceKcal,
})

async function readTarget(date: string): Promise<DailyTarget | null> {
  const { data, error } = await getSupabase().from('daily_targets').select(TARGET_COLUMNS).eq('target_date', date).maybeSingle()
  throwIfError(error)
  return data ? toTarget(data as TargetRow) : null
}

export type TargetState =
  | { status: 'ready'; target: DailyTarget; weightKg: number | null }
  | { status: 'needsProfile' }
  | { status: 'needsWeight' }

/**
 * Target del giorno: si legge da `daily_targets`; se manca si crea copiando il profilo di adesso
 * (DOMAIN_RULES "Target del giorno"). I giorni passati non si ricalcolano mai.
 */
export async function getOrCreateTarget(date: string): Promise<TargetState> {
  const [profile, weights, existing] = await Promise.all([getProfile(), recentWeightsUntil(date), readTarget(date)])
  if (!profile) return { status: 'needsProfile' }
  const weightKg = weightForDay(weights, date)
  if (existing) return { status: 'ready', target: existing, weightKg }
  if (weightKg === null) return { status: 'needsWeight' }

  const values = computeDayTarget(profile, weightKg, date)
  // ignoreDuplicates: se un'altra schermata l'ha appena creato, si tiene quello.
  const { error } = await getSupabase()
    .from('daily_targets')
    .upsert(toRow(date, values), { onConflict: 'user_id,target_date', ignoreDuplicates: true })
  throwIfError(error)
  const created = await readTarget(date)
  if (!created) throw new Error('Target non creato')
  return { status: 'ready', target: created, weightKg }
}

/** Cambia il tipo di giorno: aggiorna solo quella riga, partendo dal suo mantenimento. */
export async function setTrainingType(date: string, trainingType: TrainingType): Promise<void> {
  const state = await getOrCreateTarget(date)
  if (state.status !== 'ready') return
  const profile = await getProfile()
  if (!profile) return
  // Senza pesate (cancellate dopo la creazione) il peso si ricava dalle proteine salvate quel giorno.
  const weightKg =
    state.weightKg ?? (profile.proteinGPerKg > 0 ? state.target.protein / profile.proteinGPerKg : null)
  if (weightKg === null) return
  const values = withTrainingType(state.target.maintenanceKcal, profile, weightKg, trainingType)
  const { error } = await getSupabase().from('daily_targets').update(toRow(date, values)).eq('target_date', date)
  throwIfError(error)
}

/**
 * Ricalcola il target di un giorno con il profilo e il peso di adesso, mantenendo il tipo di giorno.
 * Usato solo per OGGI dopo una modifica del profilo (ADR-039): i giorni passati restano com'erano.
 */
export async function recomputeTarget(date: string): Promise<void> {
  const existing = await readTarget(date)
  if (!existing) return
  const [profile, weights] = await Promise.all([getProfile(), recentWeightsUntil(date)])
  const weightKg = weightForDay(weights, date)
  if (!profile || weightKg === null) return
  // Se lo sport di quel giorno non c'è più nel profilo (sport cambiati) si torna a Riposo.
  const values = computeDayTarget(profile, weightKg, date, coerceTrainingType(existing.trainingType, profile.sports))
  const { error } = await getSupabase().from('daily_targets').update(toRow(date, values)).eq('target_date', date)
  throwIfError(error)
}

export async function listTargetsBetween(start: string, end: string): Promise<DailyTarget[]> {
  const { data, error } = await getSupabase()
    .from('daily_targets')
    .select(TARGET_COLUMNS)
    .gte('target_date', start)
    .lte('target_date', end)
    .order('target_date')
  throwIfError(error)
  return (data as TargetRow[]).map(toTarget)
}
