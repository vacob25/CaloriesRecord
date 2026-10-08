/** Ciò che serve di un errore di Supabase Auth per spiegarlo all'utente. */
export interface AuthErrorLike {
  name?: string
  message?: string
  code?: string
  status?: number
}

export const OFFLINE_MESSAGE = 'Serve la connessione. Controlla la rete e riprova.'
export const UNREACHABLE_MESSAGE =
  'Non riesco a raggiungere il server di login. Se la connessione funziona, controlla l’indirizzo VITE_SUPABASE_URL. (Dettaglio: server non raggiungibile)'
export const WRONG_CREDENTIALS_MESSAGE = 'Email o password non corretti.'
export const TOO_MANY_ATTEMPTS_MESSAGE = 'Troppi tentativi. Aspetta qualche minuto e riprova.'

/**
 * Traduce un errore di Supabase Auth in un messaggio in italiano.
 * Email sbagliata e password sbagliata danno lo stesso messaggio: così da fuori
 * non si può scoprire quale email ha un account.
 */
export function describeAuthError(error: AuthErrorLike, online = true): string {
  if (!online) return OFFLINE_MESSAGE
  // Il telefono è online ma la richiesta non arriva al server: di solito VITE_SUPABASE_URL è sbagliato.
  if (error.name === 'AuthRetryableFetchError' && !error.status) return UNREACHABLE_MESSAGE
  // Il server risponde ma con un guasto (5xx): non è colpa della rete del telefono.
  if (error.status !== undefined && error.status >= 500) {
    return `Il server di login non risponde. Riprova tra poco. ${technicalDetail(error)}`
  }

  switch (error.code) {
    case 'invalid_credentials':
    case 'user_not_found':
      return WRONG_CREDENTIALS_MESSAGE
    case 'email_not_confirmed':
      return 'Account non ancora confermato. In Supabase conferma l’utente (Authentication → Users).'
    case 'user_banned':
      return 'Questo account è disattivato.'
    case 'over_request_rate_limit':
      return TOO_MANY_ATTEMPTS_MESSAGE
    case 'email_address_invalid':
      return 'Inserisci un indirizzo email valido.'
    case 'email_provider_disabled':
    case 'provider_disabled':
      return 'L’accesso con email e password è disattivato in Supabase (Authentication → Sign In / Providers).'
  }

  if (error.status === 429) return TOO_MANY_ATTEMPTS_MESSAGE
  // Versioni del server senza codice: 400 al login = credenziali sbagliate.
  if (error.status === 400 && !error.code) return WRONG_CREDENTIALS_MESSAGE
  return `Qualcosa è andato storto. Riprova tra poco. ${technicalDetail(error)}`
}

/** Codice, stato e testo del server (mai dati personali): servono a capire il problema guardando il telefono. */
function technicalDetail(error: AuthErrorLike): string {
  const parts = [error.code ?? error.name ?? 'sconosciuto', error.status !== undefined ? `stato ${error.status}` : null]
  // Troncato per non riempire lo schermo.
  const serverText = error.message?.trim().slice(0, 100)
  if (serverText) parts.push(`"${serverText}"`)
  return `(Dettaglio: ${parts.filter(Boolean).join(', ')})`
}
