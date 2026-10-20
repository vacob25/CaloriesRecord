import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

/**
 * Inserisce una riga con un id deciso dall'app. Se una riga con quell'id esiste già (la richiesta di prima era
 * arrivata ma la risposta no) non succede niente: niente doppioni. In SQL è `INSERT … ON CONFLICT (id) DO NOTHING`.
 * La riga resta protetta dalla RLS come ogni altra: serve solo il permesso di inserimento.
 */
export async function insertOnce(table: string, row: { id: string } & Record<string, unknown>): Promise<void> {
  const { error } = await getSupabase().from(table).upsert(row, { onConflict: 'id', ignoreDuplicates: true })
  throwIfError(error)
}
