import { describe, expect, it } from 'vitest'

import { DataError, describeDbError, isSessionExpiredCode, OFFLINE_DATA_MESSAGE, SESSION_EXPIRED_MESSAGE, throwIfError } from './dbErrors'

describe('describeDbError', () => {
  it('barcode duplicato', () => {
    expect(
      describeDbError({ code: '23505', message: 'duplicate key value violates unique constraint "foods_user_barcode_key"' }),
    ).toBe('Hai già un cibo con questo codice a barre.')
  })

  it('cibo usato in una ricetta', () => {
    expect(
      describeDbError({
        code: '23503',
        message: 'update or delete on table "foods" violates foreign key constraint "recipe_items_ingredient_fkey"',
      }),
    ).toContain('usato in una ricetta')
  })

  it('messaggi della funzione save_recipe passano così come sono', () => {
    expect(describeDbError({ code: '23514', message: 'Una ricetta non può contenere un’altra ricetta' })).toBe(
      'Una ricetta non può contenere un’altra ricetta',
    )
  })

  it('migrazione mancante: dice cosa fare', () => {
    expect(describeDbError({ code: 'PGRST202', message: 'Could not find the function public.save_recipe' })).toContain(
      'migrazioni',
    )
    expect(describeDbError({ code: 'PGRST205' })).toContain('migrazione 001')
  })

  it('rete assente o fetch fallito', () => {
    expect(describeDbError({ code: '23505' }, false)).toBe(OFFLINE_DATA_MESSAGE)
    expect(describeDbError({ name: 'TypeError', message: 'Load failed' })).toBe(OFFLINE_DATA_MESSAGE)
    expect(describeDbError({ message: 'TypeError: Failed to fetch' })).toBe(OFFLINE_DATA_MESSAGE)
  })

  it('sconosciuto: messaggio generico con il dettaglio', () => {
    expect(describeDbError({ code: 'XX000', message: 'boom' })).toBe(
      'Qualcosa è andato storto. Riprova tra poco. (Dettaglio: XX000, boom)',
    )
  })

  it('token scaduto: messaggio chiaro, non il dettaglio tecnico', () => {
    expect(describeDbError({ code: 'PGRST303', message: 'JWT expired' })).toBe(SESSION_EXPIRED_MESSAGE)
    expect(describeDbError({ code: 'PGRST301', message: 'JWT invalid' })).toBe(SESSION_EXPIRED_MESSAGE)
  })
})

describe('sessione scaduta', () => {
  it('riconosce solo i codici del token', () => {
    expect(isSessionExpiredCode('PGRST303')).toBe(true)
    expect(isSessionExpiredCode('PGRST301')).toBe(true)
    expect(isSessionExpiredCode('42501')).toBe(false)
    expect(isSessionExpiredCode(undefined)).toBe(false)
  })

  it('throwIfError conserva il codice per chi deve rinnovare la sessione', () => {
    try {
      throwIfError({ code: 'PGRST303', message: 'JWT expired' })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(DataError)
      expect((error as DataError).code).toBe('PGRST303')
      expect((error as DataError).message).toBe(SESSION_EXPIRED_MESSAGE)
    }
  })
})
