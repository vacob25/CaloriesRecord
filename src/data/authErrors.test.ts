import { describe, expect, it } from 'vitest'

import { describeAuthError, OFFLINE_MESSAGE, UNREACHABLE_MESSAGE } from './authErrors'

describe('describeAuthError', () => {
  it('email non registrata all’invio: nessun messaggio (non riveliamo se esiste)', () => {
    expect(describeAuthError({ code: 'otp_disabled', status: 422 }, 'send')).toEqual({ kind: 'silent' })
    expect(describeAuthError({ code: 'signup_disabled', status: 422 }, 'send')).toEqual({ kind: 'silent' })
  })

  it('codice sbagliato o scaduto', () => {
    const result = describeAuthError({ code: 'otp_expired', status: 403 }, 'verify')
    expect(result).toEqual({ kind: 'message', message: expect.stringContaining('sbagliato o scaduto') })
  })

  it('troppi codici richiesti', () => {
    const result = describeAuthError({ code: 'over_email_send_rate_limit', status: 429 }, 'send')
    expect(result).toEqual({ kind: 'message', message: expect.stringContaining('troppi codici') })
  })

  it('troppi tentativi (anche con un 429 senza codice)', () => {
    expect(describeAuthError({ code: 'over_request_rate_limit', status: 429 }, 'verify')).toEqual({
      kind: 'message',
      message: expect.stringContaining('Troppi tentativi'),
    })
    expect(describeAuthError({ status: 429 }, 'send')).toEqual({
      kind: 'message',
      message: expect.stringContaining('Troppi tentativi'),
    })
  })

  it('telefono offline', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 }, 'send', false)).toEqual({
      kind: 'message',
      message: OFFLINE_MESSAGE,
    })
    expect(describeAuthError({ code: 'otp_expired' }, 'verify', false)).toEqual({
      kind: 'message',
      message: OFFLINE_MESSAGE,
    })
  })

  it('telefono online ma server irraggiungibile (indirizzo sbagliato): non dice "serve la connessione"', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 }, 'send', true)).toEqual({
      kind: 'message',
      message: UNREACHABLE_MESSAGE,
    })
  })

  it('guasto del server (5xx): messaggio dedicato con lo stato', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 503 }, 'send')).toEqual({
      kind: 'message',
      message: 'Il server di login non risponde. Riprova tra poco. (Dettaglio: AuthRetryableFetchError, stato 503)',
    })
  })

  it('errore sconosciuto: messaggio generico con codice e stato per capire il problema', () => {
    expect(describeAuthError({ code: 'unexpected_failure', status: 422 }, 'send')).toEqual({
      kind: 'message',
      message: 'Qualcosa è andato storto. Riprova tra poco. (Dettaglio: unexpected_failure, stato 422)',
    })
  })

  it('include il testo del server, troncato', () => {
    const result = describeAuthError(
      { name: 'AuthRetryableFetchError', status: 500, message: 'Error sending magic link email' },
      'send',
    )
    expect(result).toEqual({
      kind: 'message',
      message:
        'Il server di login non risponde. Riprova tra poco. (Dettaglio: AuthRetryableFetchError, stato 500, "Error sending magic link email")',
    })
    const long = describeAuthError({ code: 'x', status: 400, message: 'a'.repeat(300) }, 'send')
    expect(long.kind === 'message' && long.message.length < 220).toBe(true)
  })

  it('errore senza codice: usa il nome dell’errore', () => {
    expect(describeAuthError({ name: 'TypeError' }, 'send')).toEqual({
      kind: 'message',
      message: 'Qualcosa è andato storto. Riprova tra poco. (Dettaglio: TypeError)',
    })
  })
})
