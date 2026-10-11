import { DEFAULT_MEAL_SLOTS, type MealSlot } from '../lib/mealSlots'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

interface SlotRow {
  slot_key: string
  name: string
  position: number
}

/**
 * I pasti dell'utente, nell'ordine scelto. La migrazione 007 e il trigger sul profilo creano i cinque di partenza;
 * se per qualche motivo non ci sono (account creato prima del trigger e senza profilo) li crea qui, una volta.
 */
export async function listMealSlots(): Promise<MealSlot[]> {
  const { data, error } = await getSupabase().from('meal_slots').select('slot_key, name, position').order('position')
  throwIfError(error)
  const rows = (data ?? []) as SlotRow[]
  if (rows.length > 0) return rows.map((row) => ({ key: row.slot_key, name: row.name }))
  const { error: seedError } = await getSupabase()
    .from('meal_slots')
    .upsert(
      DEFAULT_MEAL_SLOTS.map((slot, position) => ({ slot_key: slot.key, name: slot.name, position })),
      { onConflict: 'user_id,slot_key', ignoreDuplicates: true },
    )
  throwIfError(seedError)
  return [...DEFAULT_MEAL_SLOTS]
}

export async function createMealSlot(slot: MealSlot, position: number): Promise<void> {
  const { error } = await getSupabase().from('meal_slots').insert({ slot_key: slot.key, name: slot.name, position })
  throwIfError(error)
}

export async function renameMealSlot(key: string, name: string): Promise<void> {
  const { error } = await getSupabase().from('meal_slots').update({ name }).eq('slot_key', key)
  throwIfError(error)
}

/** Salva il nuovo ordine: la posizione di ogni pasto è il suo indice nell'elenco. */
export async function reorderMealSlots(keys: readonly string[]): Promise<void> {
  const results = await Promise.all(
    keys.map((key, position) => getSupabase().from('meal_slots').update({ position }).eq('slot_key', key)),
  )
  for (const result of results) throwIfError(result.error)
}

/** Elimina un pasto. Se ha già voci registrate il database rifiuta (chiave esterna): l'errore spiega di rinominarlo. */
export async function deleteMealSlot(key: string): Promise<void> {
  const { error } = await getSupabase().from('meal_slots').delete().eq('slot_key', key)
  throwIfError(error)
}
