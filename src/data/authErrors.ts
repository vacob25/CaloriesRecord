/** Ciò che serve di un errore di Supabase Auth per spiegarlo all'utente. */
export interface AuthErrorLike {
  name?: string
  message?: string
  code?: string
  status?: number
}

export type AuthStep = 'send' | 'verify'

export type AuthErrorResult =
  /** Da trattare come successo: non riveliamo se un'email è registrata o no. */
  | { kind: 'silent' }
  | { kind: 'message'; message: string }

export const OFFLINE_MESSAGE = 'Serve la connessione. Controlla la rete e riprova.'
export const UNREACHABLE_MESSAGE =
  'Non riesco a raggiungere il server di login. Se la connessione funziona, controlla l’indirizzo VITE_SUPABASE_URL. (Dettaglio: server non raggiungibile)'

/**
 * Traduce un errore di Supabase Auth in un messaggio in italiano.
 * Con `shouldCreateUser: false` un'email non registrata dà un errore (otp_disabled / signup_disabled):
 * lo trattiamo come un invio riuscito, così da fuori non si può scoprire quali email esistono.
 */
export function describeAuthError(error: AuthErrorLike, step: AuthStep, online = true): AuthErrorResult {
  if (!online) {
    return { kind: 'message', message: OFFLINE_MESSAGE }
  }
  // Il telefono è online ma la richiesta non arriva al server: di solito VITE_SUPABASE_URL è sbagliato.
  if (error.name === 'AuthRetryableFetchError' && !error.status) {
    return { kind: 'message', message: UNREACHABLE_MESSAGE }
  }
  // Il server risponde ma con un guasto (5xx): non è colpa della rete del telefono.
  if (error.status !== undefined && error.status >= 500) {
    return {
      kind: 'message',
      message: `Il server di login non risponde. Riprova tra poco. ${technicalDetail(error)}`,
    }
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
  return { kind: 'message', message: `Qualcosa è andato storto. Riprova tra poco. ${technicalDetail(error)}` }
}

/** Codice e stato dell'errore (mai dati personali): servono a capire il problema guardando il telefono. */
function technicalDetail(error: AuthErrorLike): string {
  const parts = [error.code ?? error.name ?? 'sconosciuto', error.status !== undefined ? `stato ${error.status}` : null]
  // Il testo del server (es. "Error sending magic link email") dice la causa; troncato per non riempire lo schermo.
  const serverText = error.message?.trim().slice(0, 100)
  if (serverText) parts.push(`"${serverText}"`)
  return `(Dettaglio: ${parts.filter(Boolean).join(', ')})`
}
