import { describe, expect, it } from 'vitest'

import { readPrivacyContact, readSupabaseEnv } from './env'

// Valori finti: nessuna chiave reale nel repo.
const URL_OK = 'https://progetto-finto.supabase.co'
const KEY_OK = 'sb_publishable_chiave_finta'

describe('readSupabaseEnv', () => {
  it('accetta url https e chiave publishable', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK })).toEqual({
      ok: true,
      url: URL_OK,
      publishableKey: KEY_OK,
    })
  })

  it('segnala entrambe le variabili mancanti', () => {
    const result = readSupabaseEnv({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toHaveLength(2)
  })

  it('tratta come mancante una variabile vuota', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).ok).toBe(false)
  })

  it('rifiuta un url non https', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: 'http://progetto-finto.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK })
        .ok,
    ).toBe(false)
  })

  it('accetta la barra finale', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: `${URL_OK}/`, VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).ok).toBe(true)
  })

  it('rifiuta l’URL dell’API dati (…/rest/v1): produrrebbe …/rest/v1/auth/v1 e un 404', () => {
    const result = readSupabaseEnv({ VITE_SUPABASE_URL: `${URL_OK}/rest/v1`, VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems.join(' ')).toContain('senza /rest/v1')
  })

  it('rifiuta una secret key e non la ripete nel messaggio', () => {
    const result = readSupabaseEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_finta' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.problems.join(' ')).toContain('secret key')
      expect(result.problems.join(' ')).not.toContain('sb_secret_finta')
    }
  })

  it('rifiuta una chiave di altro tipo', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'chiave-qualsiasi' }).ok).toBe(
      false,
    )
  })
})

describe('contatto privacy (step 18)', () => {
  it('facoltativo: vuoto o assente = null', () => {
    expect(readPrivacyContact({})).toBeNull()
    expect(readPrivacyContact({ VITE_PRIVACY_CONTACT: '   ' })).toBeNull()
    expect(readPrivacyContact({ VITE_PRIVACY_CONTACT: ' contatto@example.com ' })).toBe('contatto@example.com')
  })
})
