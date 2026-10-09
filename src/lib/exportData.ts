/**
 * Esportazione dei propri dati (step 18): un JSON con tutte le tabelle dell'utente.
 * La RLS filtra già: ogni select restituisce solo le righe di chi è loggato.
 * Un test confronta questo elenco con le tabelle delle migrazioni: una tabella nuova non può restare fuori.
 */
export const EXPORT_TABLES = [
  'profiles',
  'foods',
  'recipe_items',
  'meal_entries',
  'weight_logs',
  'daily_targets',
  'tdee_estimates',
  'water_entries',
  'drink_containers',
] as const

/** Tabelle che NON sono dati dell'utente (non si esportano), con il motivo. */
export const NOT_EXPORTED_TABLES: Record<string, string> = {
  allowed_emails: 'elenco degli invitati: lo gestisce l’amministratore, l’app non può leggerlo',
}

export type ExportTable = (typeof EXPORT_TABLES)[number]

export function buildExport(data: Record<ExportTable, unknown[]>, exportedAt: Date, email: string | null): string {
  return JSON.stringify(
    {
      app: 'CaloriesRecord',
      formato: 1,
      esportato_il: exportedAt.toISOString(),
      account: email,
      tabelle: data,
    },
    null,
    2,
  )
}

/** Nome del file: calories-record-dati-AAAA-MM-GG.json (giorno locale passato da chi chiama). */
export function exportFileName(localDay: string): string {
  return `calories-record-dati-${localDay}.json`
}

/** Parola da scrivere per eliminare l'account (conferma esplicita, step 18). */
export const DELETE_CONFIRM_WORD = 'ELIMINA'

/** Conferma valida solo con la parola esatta (spazi ai lati ammessi, maiuscole obbligatorie). */
export function isDeleteConfirmed(text: string): boolean {
  return text.trim() === DELETE_CONFIRM_WORD
}
