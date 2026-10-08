import { describe, expect, it } from 'vitest'

import { readSupabaseEnv } from './env'

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
