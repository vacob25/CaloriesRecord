import type { WeightLog } from '../lib/weight'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

interface WeightRow {
  log_date: string
  weight_kg: number | string
}

const toLog = (row: WeightRow): WeightLog => ({ date: row.log_date, kg: Number(row.weight_kg) })

/** Pesate dal giorno `from` incluso (tutte se null), in ordine di data. */
export async function listWeights(from: string | null): Promise<WeightLog[]> {
  let query = getSupabase().from('weight_logs').select('log_date, weight_kg').order('log_date')
  if (from) query = query.gte('log_date', from)
  const { data, error } = await query
  throwIfError(error)
  return (data as WeightRow[]).map(toLog)
}

/** Le ultime pesate fino al giorno incluso (bastano per media mobile e ultima pesata). */
export async function recentWeightsUntil(day: string, limit = 30): Promise<WeightLog[]> {
  const { data, error } = await getSupabase()
    .from('weight_logs')
    .select('log_date, weight_kg')
    .lte('log_date', day)
    .order('log_date', { ascending: false })
    .limit(limit)
  throwIfError(error)
  return (data as WeightRow[]).map(toLog).reverse()
}

/** Una pesata al giorno: la seconda dello stesso giorno sostituisce la prima (upsert). */
export async function saveWeight(day: string, kg: number): Promise<void> {
  const { error } = await getSupabase()
    .from('weight_logs')
    .upsert({ log_date: day, weight_kg: kg }, { onConflict: 'user_id,log_date' })
  throwIfError(error)
}

export async function deleteWeight(day: string): Promise<void> {
  const { error } = await getSupabase().from('weight_logs').delete().eq('log_date', day)
  throwIfError(error)
}
