import { describe, expect, it } from 'vitest'

import { parseEmail, parsePassword } from './auth'

describe('parseEmail', () => {
  it('accetta un indirizzo e lo normalizza (spazi, maiuscole)', () => {
    expect(parseEmail('  Utente.Prova@Example.com ')).toEqual({ ok: true, value: 'utente.prova@example.com' })
  })

  it.each(['', 'utente', 'utente@', '@example.com', 'utente@@example.com'])('rifiuta "%s"', (input) => {
    expect(parseEmail(input).ok).toBe(false)
  })
})

describe('parsePassword', () => {
  it('rifiuta la password vuota', () => {
    expect(parsePassword('')).toEqual({ ok: false, message: 'Inserisci la password.' })
  })

  it('non modifica la password, nemmeno gli spazi', () => {
    expect(parsePassword(' una frase lunga ')).toEqual({ ok: true, value: ' una frase lunga ' })
  })
})
