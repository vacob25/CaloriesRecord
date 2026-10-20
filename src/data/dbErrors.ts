/** Ciò che serve di un errore di Supabase (PostgREST) o di rete. */
export interface DbErrorLike {
  code?: string
  message?: string
  details?: string | null
  name?: string
}

/** Errore dei dati con un messaggio già pronto per l'utente. */
export class DataError extends Error {
  /** Codice dell'errore di origine (es. PGRST303), se c'era: serve a chi deve reagire, non all'utente. */
  readonly code: string | undefined

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'DataError'
    this.code = code
  }
}

/** PostgREST risponde così quando il token di accesso è scaduto (PGRST301: non valido o scaduto, PGRST303: scaduto). */
const SESSION_EXPIRED_CODES = ['PGRST301', 'PGRST303']

export function isSessionExpiredCode(code: string | undefined): boolean {
  return code !== undefined && SESSION_EXPIRED_CODES.includes(code)
}

export const SESSION_EXPIRED_MESSAGE = 'La sessione era scaduta: l’ho rinnovata. Riprova.'

export const OFFLINE_DATA_MESSAGE = 'Serve la connessione per caricare e salvare i dati. Controlla la rete e riprova.'

/** Traduce un errore del database in italiano. I casi tecnici dicono anche cosa fare. */
export function describeDbError(error: DbErrorLike, online = true): string {
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  if (!online || error.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed/i.test(text)) {
    return OFFLINE_DATA_MESSAGE
  }
  switch (error.code) {
    case '23505':
      if (text.includes('barcode')) return 'Hai già un cibo con questo codice a barre.'
      if (text.includes('meal_slots')) return 'Hai già un pasto con questo nome.'
      return 'Esiste già un elemento uguale.'
    case '23503':
      if (text.includes('recipe_items_ingredient_fkey')) {
        return 'Questo cibo è usato in una ricetta: toglilo prima dagli ingredienti.'
      }
      if (text.includes('meal_entries_slot_fkey')) {
        return 'Questo pasto ha già delle voci registrate: non si può eliminare. Puoi rinominarlo.'
      }
      return 'Questo elemento è collegato ad altri dati e non si può modificare così.'
    case '23514':
      if (text.includes('ricetta')) return error.message ?? 'Valori della ricetta non validi.'
      return 'Alcuni valori non sono validi. Controllali e riprova.'
    case '22003':
      return 'Un numero è troppo grande per essere salvato. Controlla i valori (es. il peso cotto della ricetta).'
    case 'PGRST301':
    case 'PGRST303':
      return SESSION_EXPIRED_MESSAGE
    case '42501':
      return 'Permesso negato: la sessione potrebbe essere scaduta. Esci e accedi di nuovo.'
    case 'P0002':
      return 'Elemento non trovato: forse è stato cancellato.'
    case 'PGRST116':
      return 'Elemento non trovato: forse è stato cancellato.'
    case 'PGRST202':
    case '42883':
      return 'Funzione del database mancante: esegui in Supabase le migrazioni in supabase/migrations (es. 002, 005).'
    case '42703':
    case 'PGRST204':
      return 'Colonna mancante: esegui in Supabase la migrazione più recente in supabase/migrations (es. 003).'
    case 'PGRST205':
    case '42P01':
      return 'Tabella mancante: esegui in Supabase la migrazione 001 (supabase/migrations).'
  }
  const detail = [error.code, error.message?.slice(0, 100)].filter(Boolean).join(', ')
  return `Qualcosa è andato storto. Riprova tra poco.${detail ? ` (Dettaglio: ${detail})` : ''}`
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/** Lancia un DataError se la risposta di Supabase contiene un errore. */
export function throwIfError(error: DbErrorLike | null): void {
  if (error) throw new DataError(describeDbError(error, isOnline()), error.code)
}

/** Messaggio da mostrare per un errore qualunque arrivato dal livello dati. */
export function errorMessage(error: unknown): string {
  if (error instanceof DataError) return error.message
  if (error && typeof error === 'object') return describeDbError(error as DbErrorLike, isOnline())
  return 'Qualcosa è andato storto. Riprova tra poco.'
}
