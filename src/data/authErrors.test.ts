import { describe, expect, it } from 'vitest'

import { describeAuthError, OFFLINE_MESSAGE } from './authErrors'

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

  it('rete assente', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 }, 'send')).toEqual({
      kind: 'message',
      message: OFFLINE_MESSAGE,
    })
    expect(describeAuthError({ code: 'otp_expired' }, 'verify', false)).toEqual({
      kind: 'message',
      message: OFFLINE_MESSAGE,
    })
  })

  it('errore sconosciuto: messaggio generico', () => {
    expect(describeAuthError({ code: 'unexpected_failure', status: 500 }, 'send')).toEqual({
      kind: 'message',
      message: expect.stringContaining('Riprova'),
    })
  })
})
