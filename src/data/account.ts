import { EXPORT_TABLES, type ExportTable } from '../lib/exportData'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

/**
 * I propri dati, tabella per tabella (step 18). Nessun filtro qui: è la RLS a restituire solo le righe
 * di chi è loggato. Tutte le colonne, così l'esportazione è completa.
 */
export async function exportMyData(): Promise<{ email: string | null; data: Record<ExportTable, unknown[]> }> {
  const supabase = getSupabase()
  const { data: userData } = await supabase.auth.getUser()
  const entries = await Promise.all(
    EXPORT_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*')
      throwIfError(error)
      return [table, data ?? []] as const
    }),
  )
  return { email: userData.user?.email ?? null, data: Object.fromEntries(entries) as Record<ExportTable, unknown[]> }
}

/**
 * Elimina il proprio account (funzione SQL delete_my_account, migrazione 005): cancella l'utente della
 * sessione e, a cascata, tutte le sue righe. Nessuna service_role: la funzione vede solo auth.uid().
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('delete_my_account')
  throwIfError(error)
}
