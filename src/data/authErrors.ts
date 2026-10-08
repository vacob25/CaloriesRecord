/** Ciò che serve di un errore di Supabase Auth per spiegarlo all'utente. */
export interface AuthErrorLike {
  name?: string
  code?: string
  status?: number
}

export type AuthStep = 'send' | 'verify'

export type AuthErrorResult =
  /** Da trattare come successo: non riveliamo se un'email è registrata o no. */
  | { kind: 'silent' }
  | { kind: 'message'; message: string }

export const OFFLINE_MESSAGE = 'Serve la connessione. Controlla la rete e riprova.'

/**
 * Traduce un errore di Supabase Auth in un messaggio in italiano.
 * Con `shouldCreateUser: false` un'email non registrata dà un errore (otp_disabled / signup_disabled):
 * lo trattiamo come un invio riuscito, così da fuori non si può scoprire quali email esistono.
 */
export function describeAuthError(error: AuthErrorLike, step: AuthStep, online = true): AuthErrorResult {
  if (!online || error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return { kind: 'message', message: OFFLINE_MESSAGE }
  }

  switch (error.code) {
    case 'otp_disabled':
    case 'signup_disabled':
    case 'user_not_found':
      if (step === 'send') return { kind: 'silent' }
      break
    case 'email_address_not_authorized':
      // Problema di configurazione dell'invio email (SMTP), non dice nulla sull'esistenza dell'utente.
      return { kind: 'message', message: 'Il servizio email non può scrivere a questo indirizzo. Controlla l’SMTP in Supabase.' }
    case 'otp_expired':
      return { kind: 'message', message: 'Codice sbagliato o scaduto. Controllalo o chiedine uno nuovo.' }
    case 'over_email_send_rate_limit':
      return {
        kind: 'message',
        message: 'Hai chiesto troppi codici. Aspetta qualche minuto prima di chiederne un altro.',
      }
    case 'over_request_rate_limit':
      return { kind: 'message', message: 'Troppi tentativi. Aspetta qualche minuto e riprova.' }
    case 'email_address_invalid':
    case 'validation_failed':
      return {
        kind: 'message',
        message: step === 'send' ? 'Inserisci un indirizzo email valido.' : 'Codice non valido.',
      }
  }

  if (error.status === 429) {
    return { kind: 'message', message: 'Troppi tentativi. Aspetta qualche minuto e riprova.' }
  }
  if (step === 'verify' && (error.status === 401 || error.status === 403)) {
    return { kind: 'message', message: 'Codice sbagliato o scaduto. Controllalo o chiedine uno nuovo.' }
  }
  return { kind: 'message', message: 'Qualcosa è andato storto. Riprova tra poco.' }
}
