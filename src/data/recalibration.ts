import { addDays, weekRange } from '../lib/dates'
import { bmr, maintenance } from '../lib/nutrition'
import { acceptedActivityFactor, evaluateRecalibration, type RecalEvaluation } from '../lib/recalibration'
import { ageOn, weightForDay } from '../lib/weight'
import { throwIfError } from './dbErrors'
import { listEntriesBetween } from './meals'
import { getProfile } from './profile'
import { getSupabase } from './supabase'
import { listTargetsBetween } from './targets'
import { listWeights } from './weights'

export type EstimateStatus = 'pending' | 'accepted' | 'rejected' | 'none'

export interface TdeeEstimate {
  id: string
  weekStart: string
  windowDays: number
  avgIntakeKcal: number | null
  slopeKgWeek: number | null
  estimatedMaintenanceKcal: number | null
  proposedMaintenanceKcal: number | null
  status: EstimateStatus
}

interface EstimateRow {
  id: string
  week_start: string
  window_days: number
  avg_intake_kcal: number | null
  trend_slope_kg_week: number | string | null
  estimated_maintenance_kcal: number | null
  proposed_maintenance_kcal: number | null
  status: EstimateStatus
}

const COLUMNS =
  'id, week_start, window_days, avg_intake_kcal, trend_slope_kg_week, estimated_maintenance_kcal, proposed_maintenance_kcal, status'

const toEstimate = (row: EstimateRow): TdeeEstimate => ({
  id: row.id,
  weekStart: row.week_start,
  windowDays: row.window_days,
  avgIntakeKcal: row.avg_intake_kcal,
  slopeKgWeek: row.trend_slope_kg_week === null ? null : Number(row.trend_slope_kg_week),
  estimatedMaintenanceKcal: row.estimated_maintenance_kcal,
  proposedMaintenanceKcal: row.proposed_maintenance_kcal,
  status: row.status,
})

export interface RecalibrationState {
  estimate: TdeeEstimate | null
  evaluation: RecalEvaluation
  currentBmrKcal: number | null
  currentMaintenanceKcal: number | null
  surplusPct: number
}

async function firstUseDate(): Promise<string | null> {
  const supabase = getSupabase()
  const [entry, weight] = await Promise.all([
    supabase.from('meal_entries').select('entry_date').order('entry_date').limit(1).maybeSingle(),
    supabase.from('weight_logs').select('log_date').order('log_date').limit(1).maybeSingle(),
  ])
  throwIfError(entry.error)
  throwIfError(weight.error)
  const dates = [(entry.data as { entry_date: string } | null)?.entry_date, (weight.data as { log_date: string } | null)?.log_date]
  return dates.filter((d): d is string => Boolean(d)).sort()[0] ?? null
}

/**
 * Esecuzione settimanale "pigra" (step 10): alla prima apertura di una nuova settimana si valuta
 * e si salva UNA riga in tdee_estimates (al massimo una proposta a settimana).
 */
export async function runWeeklyRecalibration(today: string): Promise<RecalibrationState> {
  const weekStart = weekRange(today).start
  const windowStart = addDays(today, -28)
  const [profile, weights, entries, targets, firstUse, existing] = await Promise.all([
    getProfile(),
    listWeights(addDays(windowStart, -6)),
    listEntriesBetween(windowStart, addDays(today, -1)),
    listTargetsBetween(windowStart, addDays(today, -1)),
    firstUseDate(),
    getSupabase().from('tdee_estimates').select(COLUMNS).eq('week_start', weekStart).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  throwIfError(existing.error)

  const weightKg = weightForDay(weights, today)
  const currentBmrKcal =
    profile && weightKg !== null
      ? bmr({ sex: profile.sex, weightKg, heightCm: profile.heightCm, ageYears: ageOn(profile.birthDate, today) })
      : null
  const currentMaintenanceKcal =
    profile && currentBmrKcal !== null ? Math.round(maintenance(currentBmrKcal, profile.activityFactor)) : null
  const surplusPct = profile?.surplusPct ?? 0

  const kcalByDay = new Map<string, number>()
  for (const entry of entries) kcalByDay.set(entry.entryDate, (kcalByDay.get(entry.entryDate) ?? 0) + entry.kcal)
  const targetByDay = new Map(targets.map((t) => [t.date, t.targetKcal]))
  const days = [...new Set([...kcalByDay.keys(), ...targetByDay.keys()])].map((date) => ({
    date,
    kcal: kcalByDay.get(date) ?? 0,
    target: targetByDay.get(date) ?? null,
  }))

  const evaluation = evaluateRecalibration({
    today,
    firstUseDate: firstUse,
    days,
    weights,
    currentMaintenanceKcal: currentMaintenanceKcal ?? 0,
    surplusPct,
  })

  let estimate = existing.data ? toEstimate(existing.data as EstimateRow) : null
  if (!estimate && currentMaintenanceKcal !== null) {
    const computed = evaluation.status !== 'notEnoughData'
    const { data, error } = await getSupabase()
      .from('tdee_estimates')
      .insert({
        week_start: weekStart,
        window_days: Math.max(1, evaluation.windowDays),
        avg_intake_kcal: computed ? Math.round(evaluation.averageIntakeKcal) : null,
        trend_slope_kg_week: computed ? evaluation.slopeKgWeek : null,
        estimated_maintenance_kcal: computed ? Math.round(evaluation.estimatedMaintenanceKcal) : null,
        proposed_maintenance_kcal: evaluation.status === 'proposal' ? evaluation.proposedMaintenanceKcal : null,
        status: evaluation.status === 'proposal' ? 'pending' : 'none',
      })
      .select(COLUMNS)
      .single()
    throwIfError(error)
    estimate = toEstimate(data as EstimateRow)
  }
  return { estimate, evaluation, currentBmrKcal, currentMaintenanceKcal, surplusPct }
}

/** Accetta: activity_factor = proposto / BMR attuale. Vale dal giorno dopo: il target di oggi non cambia. */
export async function acceptProposal(estimate: TdeeEstimate, currentBmrKcal: number): Promise<void> {
  if (estimate.proposedMaintenanceKcal === null) return
  const factor = acceptedActivityFactor(estimate.proposedMaintenanceKcal, currentBmrKcal)
  const profileUpdate = await getSupabase().from('profiles').update({ activity_factor: factor }).not('user_id', 'is', null)
  throwIfError(profileUpdate.error)
  const { error } = await getSupabase().from('tdee_estimates').update({ status: 'accepted' }).eq('id', estimate.id)
  throwIfError(error)
}

/** Rifiuta: non cambia nulla, si registra solo la scelta. */
export async function rejectProposal(estimateId: string): Promise<void> {
  const { error } = await getSupabase().from('tdee_estimates').update({ status: 'rejected' }).eq('id', estimateId)
  throwIfError(error)
}
