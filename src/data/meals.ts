import type { MealType } from '../lib/labels'
import { entrySnapshot, rescaleEntry } from '../lib/meals'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'
import type { Food, MealEntry } from './types'

interface EntryRow {
  id: string
  entry_date: string
  meal_type: MealType
  food_id: string | null
  food_name: string
  grams: number | string
  kcal: number | string
  protein_g: number | string
  carbs_g: number | string
  fat_g: number | string
  created_at: string
}

const ENTRY_COLUMNS = 'id, entry_date, meal_type, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g, created_at'

function toEntry(row: EntryRow): MealEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    mealType: row.meal_type,
    foodId: row.food_id,
    foodName: row.food_name,
    grams: Number(row.grams),
    kcal: Number(row.kcal),
    protein: Number(row.protein_g),
    carbs: Number(row.carbs_g),
    fat: Number(row.fat_g),
    createdAt: row.created_at,
  }
}

/** Voci di un giorno locale, in ordine di inserimento. */
export async function listEntries(date: string): Promise<MealEntry[]> {
  const { data, error } = await getSupabase()
    .from('meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('entry_date', date)
    .order('created_at')
  throwIfError(error)
  return (data as EntryRow[]).map(toEntry)
}

/** Voci di un intervallo di giorni (statistiche). */
export async function listEntriesBetween(start: string, end: string): Promise<MealEntry[]> {
  const { data, error } = await getSupabase()
    .from('meal_entries')
    .select(ENTRY_COLUMNS)
    .gte('entry_date', start)
    .lte('entry_date', end)
    .order('entry_date')
    .order('created_at')
  throwIfError(error)
  return (data as EntryRow[]).map(toEntry)
}

export interface NewEntry {
  date: string
  mealType: MealType
  food: Food
  grams: number
}

/** Registra un cibo: copia nome e valori (snapshot) e aggiorna "usato di recente". */
export async function addEntry(input: NewEntry): Promise<MealEntry> {
  const values = entrySnapshot(input.food.per100g, input.grams)
  const { data, error } = await getSupabase()
    .from('meal_entries')
    .insert({
      entry_date: input.date,
      meal_type: input.mealType,
      food_id: input.food.id,
      food_name: input.food.name,
      grams: input.grams,
      kcal: values.kcal,
      protein_g: values.protein,
      carbs_g: values.carbs,
      fat_g: values.fat,
    })
    .select(ENTRY_COLUMNS)
    .single()
  throwIfError(error)
  // Secondario: se fallisce, la voce è salvata lo stesso; solo l'ordine dei "Recenti" resta indietro.
  await getSupabase().from('foods').update({ last_used_at: new Date().toISOString() }).eq('id', input.food.id)
  return toEntry(data as EntryRow)
}

/** Cambia i grammi (e il pasto) di una voce: lo snapshot si scala, il cibo non si rilegge. */
export async function updateEntry(entry: MealEntry, grams: number, mealType: MealType): Promise<void> {
  const values = rescaleEntry(entry, grams)
  const { error } = await getSupabase()
    .from('meal_entries')
    .update({
      grams,
      meal_type: mealType,
      kcal: values.kcal,
      protein_g: values.protein,
      carbs_g: values.carbs,
      fat_g: values.fat,
    })
    .eq('id', entry.id)
  throwIfError(error)
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await getSupabase().from('meal_entries').delete().eq('id', id)
  throwIfError(error)
}

/** Ultimi grammi usati per ogni cibo (per proporli di nuovo). */
export async function lastGramsByFood(): Promise<Record<string, number>> {
  const { data, error } = await getSupabase()
    .from('meal_entries')
    .select('food_id, grams')
    .not('food_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300)
  throwIfError(error)
  const result: Record<string, number> = {}
  for (const row of (data ?? []) as { food_id: string; grams: number | string }[]) {
    if (!(row.food_id in result)) result[row.food_id] = Number(row.grams)
  }
  return result
}
