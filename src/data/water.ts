import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

/** Acqua (step 15, ADR-049): tabella a sé, niente calorie, non entra nel diario dei pasti. */

export interface WaterEntry {
  id: string
  entryDate: string
  ml: number
  /** Contenitore da cui viene (chiave di lib/water.ts), null per una quantità libera (migrazione 004). */
  container: string | null
  createdAt: string
}

export interface DrinkContainer {
  id: string
  name: string
  ml: number
}

interface WaterRow {
  id: string
  entry_date: string
  ml: number
  container: string | null
  created_at: string
}

/** Aggiunte di acqua di un giorno locale, in ordine di inserimento. */
export async function listWater(date: string): Promise<WaterEntry[]> {
  const { data, error } = await getSupabase()
    .from('water_entries')
    .select('id, entry_date, ml, container, created_at')
    .eq('entry_date', date)
    .order('created_at')
  throwIfError(error)
  return (data as WaterRow[]).map((row) => ({
    id: row.id,
    entryDate: row.entry_date,
    ml: row.ml,
    container: row.container,
    createdAt: row.created_at,
  }))
}

export async function addWater(date: string, ml: number, container: string | null): Promise<void> {
  const { error } = await getSupabase().from('water_entries').insert({ entry_date: date, ml, container })
  throwIfError(error)
}

export async function deleteWater(id: string): Promise<void> {
  const { error } = await getSupabase().from('water_entries').delete().eq('id', id)
  throwIfError(error)
}

/** Contenitori personali (es. borraccia), dal più vecchio. */
export async function listContainers(): Promise<DrinkContainer[]> {
  const { data, error } = await getSupabase().from('drink_containers').select('id, name, ml').order('created_at')
  throwIfError(error)
  return data as DrinkContainer[]
}

export async function createContainer(name: string, ml: number): Promise<void> {
  const { error } = await getSupabase().from('drink_containers').insert({ name, ml })
  throwIfError(error)
}

export async function deleteContainer(id: string): Promise<void> {
  const { error } = await getSupabase().from('drink_containers').delete().eq('id', id)
  throwIfError(error)
}

/** Obiettivo acqua in ml, o null per nessun obiettivo. */
export async function updateWaterGoal(goalMl: number | null): Promise<void> {
  const { error } = await getSupabase().from('profiles').update({ water_goal_ml: goalMl }).not('user_id', 'is', null)
  throwIfError(error)
}
