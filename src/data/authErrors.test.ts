import { describe, expect, it } from 'vitest'

import {
  describeAuthError,
  OFFLINE_MESSAGE,
  TOO_MANY_ATTEMPTS_MESSAGE,
  UNREACHABLE_MESSAGE,
  WRONG_CREDENTIALS_MESSAGE,
} from './authErrors'

describe('describeAuthError', () => {
  it('password sbagliata e email inesistente danno lo stesso messaggio', () => {
    expect(describeAuthError({ code: 'invalid_credentials', status: 400 })).toBe(WRONG_CREDENTIALS_MESSAGE)
    expect(describeAuthError({ code: 'user_not_found', status: 400 })).toBe(WRONG_CREDENTIALS_MESSAGE)
    expect(describeAuthError({ status: 400 })).toBe(WRONG_CREDENTIALS_MESSAGE)
  })

  it('account non confermato', () => {
    expect(describeAuthError({ code: 'email_not_confirmed', status: 400 })).toContain('non ancora confermato')
  })

  it('troppi tentativi (anche con un 429 senza codice)', () => {
    expect(describeAuthError({ code: 'over_request_rate_limit', status: 429 })).toBe(TOO_MANY_ATTEMPTS_MESSAGE)
    expect(describeAuthError({ status: 429 })).toBe(TOO_MANY_ATTEMPTS_MESSAGE)
  })

  it('accesso con password disattivato in Supabase', () => {
    expect(describeAuthError({ code: 'email_provider_disabled', status: 400 })).toContain('disattivato in Supabase')
  })

  it('telefono offline', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 }, false)).toBe(OFFLINE_MESSAGE)
    expect(describeAuthError({ code: 'invalid_credentials' }, false)).toBe(OFFLINE_MESSAGE)
  })

  it('telefono online ma server irraggiungibile (indirizzo sbagliato): non dice "serve la connessione"', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 }, true)).toBe(UNREACHABLE_MESSAGE)
  })

  it('guasto del server (5xx): messaggio dedicato con stato e testo del server', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 503, message: 'Service Unavailable' })).toBe(
      'Il server di login non risponde. Riprova tra poco. (Dettaglio: AuthRetryableFetchError, stato 503, "Service Unavailable")',
    )
  })

  it('errore sconosciuto: messaggio generico con codice e stato', () => {
    expect(describeAuthError({ code: 'unexpected_failure', status: 422 })).toBe(
      'Qualcosa è andato storto. Riprova tra poco. (Dettaglio: unexpected_failure, stato 422)',
    )
  })

  it('errore senza codice né stato: usa il nome dell’errore; testo lungo troncato', () => {
    expect(describeAuthError({ name: 'TypeError' })).toBe('Qualcosa è andato storto. Riprova tra poco. (Dettaglio: TypeError)')
    expect(describeAuthError({ code: 'x', status: 418, message: 'a'.repeat(300) }).length).toBeLessThan(220)
  })
})
