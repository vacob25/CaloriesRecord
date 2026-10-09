import { describe, expect, it } from 'vitest'

import { clearUserStorage, parseEmail, parseNewPassword, parsePassword, PRIVACY_VERSION, validateSignup } from './auth'

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

describe('nuova password (step 18)', () => {
  it('almeno 8 caratteri', () => {
    expect(parseNewPassword('1234567')).toEqual({ ok: false, message: 'La password deve avere almeno 8 caratteri.' })
    expect(parseNewPassword('12345678')).toEqual({ ok: true, value: '12345678' })
  })
  it('al massimo 72 byte: gli accenti contano doppio', () => {
    expect(parseNewPassword('a'.repeat(72)).ok).toBe(true)
    expect(parseNewPassword('a'.repeat(73)).ok).toBe(false)
    expect(parseNewPassword('è'.repeat(36)).ok).toBe(true)
    expect(parseNewPassword('è'.repeat(37)).ok).toBe(false)
  })
})

describe('registrazione (step 18)', () => {
  const now = new Date('2026-10-09T08:00:00Z')
  it('senza consenso niente registrazione', () => {
    expect(validateSignup({ email: 'utente.prova@example.com', password: 'una frase lunga', consent: false }, now)).toEqual({
      ok: false,
      errors: { consent: 'Per registrarti devi accettare l’informativa privacy, compresi i dati sulla salute.' },
    })
  })
  it('errori su tutti i campi insieme', () => {
    const result = validateSignup({ email: 'no', password: 'corta', consent: false }, now)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['consent', 'email', 'password'])
  })
  it('valida: email normalizzata e consenso con versione e data', () => {
    expect(validateSignup({ email: ' Utente.Prova@Example.com ', password: 'una frase lunga', consent: true }, now)).toEqual({
      ok: true,
      value: {
        email: 'utente.prova@example.com',
        password: 'una frase lunga',
        consent: { privacy_version: PRIVACY_VERSION, privacy_accepted_at: '2026-10-09T08:00:00.000Z', health_data_consent: true },
      },
    })
  })
})

describe('pulizia dello storage all’uscita (step 18)', () => {
  function fakeStorage(keys: string[]) {
    const items = new Map(keys.map((key) => [key, 'x']))
    return {
      get length() {
        return items.size
      },
      key: (index: number) => [...items.keys()][index] ?? null,
      removeItem: (key: string) => void items.delete(key),
      keys: () => [...items.keys()],
    }
  }
  it('toglie sessione Supabase, contatori OFF e chiavi dell’app; lascia il resto', () => {
    const storage = fakeStorage(['sb-progetto-auth-token', 'off.search', 'off.product', 'caloriesrecord.x', 'altra-app'])
    expect(clearUserStorage(storage).sort()).toEqual(['caloriesrecord.x', 'off.product', 'off.search', 'sb-progetto-auth-token'])
    expect(storage.keys()).toEqual(['altra-app'])
  })
})
