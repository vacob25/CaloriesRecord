import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { readSupabaseEnv } from './env'

/** Esito della lettura delle variabili: l'app lo controlla prima di mostrare qualunque schermata. */
export const supabaseEnv = readSupabaseEnv(import.meta.env)

let client: SupabaseClient | null = null

/**
 * Unico client Supabase dell'app. Solo i file di `src/data/` lo usano.
 * - persistSession: la sessione resta salvata sul telefono, chiudere l'app non fa uscire.
 * - autoRefreshToken: il token si rinnova da solo prima di scadere.
 * - detectSessionInUrl false: il login avviene nell'app (email e password, ADR-028), mai tramite link: non c'è niente da leggere nell'URL.
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseEnv.ok) {
    throw new Error('Configurazione di Supabase mancante o non valida.')
  }
  client ??= createClient(supabaseEnv.url, supabaseEnv.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  return client
}
