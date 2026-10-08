import { describe, expect, it } from 'vitest'

import { CODE_VALIDITY_MS, parseCode, parseEmail, restorePendingLogin, secondsUntilResend } from './auth'

describe('parseEmail', () => {
  it('accetta un indirizzo e lo normalizza (spazi, maiuscole)', () => {
    expect(parseEmail('  Utente.Prova@Example.com ')).toEqual({ ok: true, value: 'utente.prova@example.com' })
  })

  it.each(['', 'utente', 'utente@', '@example.com', 'utente@@example.com'])('rifiuta "%s"', (input) => {
    expect(parseEmail(input).ok).toBe(false)
  })
})

describe('parseCode', () => {
  it('accetta 6 cifre e toglie gli spazi', () => {
    expect(parseCode(' 123 456 ')).toEqual({ ok: true, value: '123456' })
  })

  it('accetta fino a 10 cifre', () => {
    expect(parseCode('1234567890').ok).toBe(true)
  })

  it.each(['', '12345', '12345678901', '12a456', '12-456'])('rifiuta "%s"', (input) => {
    expect(parseCode(input).ok).toBe(false)
  })
})

describe('secondsUntilResend', () => {
  const sentAt = 1_000_000

  it('subito dopo l’invio mancano 60 s', () => {
    expect(secondsUntilResend(sentAt, sentAt)).toBe(60)
  })

  it('arrotonda per eccesso i secondi parziali', () => {
    expect(secondsUntilResend(sentAt, sentAt + 59_001)).toBe(1)
  })

  it('a 60 s esatti si può reinviare', () => {
    expect(secondsUntilResend(sentAt, sentAt + 60_000)).toBe(0)
  })

  it('non supera mai i 60 s, anche con un orario di invio nel futuro', () => {
    expect(secondsUntilResend(sentAt, sentAt - 15_000)).toBe(60)
  })

  it('non va mai sotto zero', () => {
    expect(secondsUntilResend(sentAt, sentAt + 600_000)).toBe(0)
  })
})

describe('restorePendingLogin', () => {
  const now = 1_700_000_000_000
  const saved = (data: unknown) => JSON.stringify(data)

  it('rilegge un login salvato da poco', () => {
    expect(restorePendingLogin(saved({ email: 'utente@example.com', sentAt: now - 5_000 }), now)).toEqual({
      email: 'utente@example.com',
      sentAt: now - 5_000,
    })
  })

  it('scarta un login con il codice scaduto (1 ora)', () => {
    expect(restorePendingLogin(saved({ email: 'utente@example.com', sentAt: now - CODE_VALIDITY_MS }), now)).toBeNull()
  })

  it('scarta un orario nel futuro', () => {
    expect(restorePendingLogin(saved({ email: 'utente@example.com', sentAt: now + 1 }), now)).toBeNull()
  })

  it.each([null, '', 'non json', saved({ email: 'non-una-email', sentAt: now }), saved({ email: 'utente@example.com' })])(
    'scarta dati assenti o corrotti (%s)',
    (raw) => {
      expect(restorePendingLogin(raw, now)).toBeNull()
    },
  )
})
