import { describe, expect, it } from 'vitest'

import { validateRecipe } from './recipeValidation'

describe('validateRecipe', () => {
  it('ricetta valida', () => {
    expect(
      validateRecipe({
        name: ' Pasta al ragù ',
        cookedWeightG: '800',
        items: [
          { key: 'a', grams: '200' },
          { key: 'b', grams: '250,5' },
        ],
      }),
    ).toEqual({ ok: true, value: { name: 'Pasta al ragù', cookedWeightG: 800, grams: { a: 200, b: 250.5 } } })
  })

  it('senza nome, senza ingredienti, senza peso cotto', () => {
    const result = validateRecipe({ name: '', cookedWeightG: '', items: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.name).toBeDefined()
      expect(result.errors.items).toBe('Aggiungi almeno un ingrediente.')
      expect(result.errors.cookedWeightG).toBe('Inserisci il peso totale cotto.')
    }
  })

  it('grammi di un ingrediente non validi: errore su quell’ingrediente', () => {
    const result = validateRecipe({ name: 'X', cookedWeightG: '100', items: [{ key: 'a', grams: '0' }, { key: 'b', grams: '5001' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors.itemGrams)).toEqual(['a', 'b'])
  })

  it('peso cotto oltre 5000 g è ammesso (pentola grande), 0 no', () => {
    expect(validateRecipe({ name: 'X', cookedWeightG: '6500', items: [{ key: 'a', grams: '100' }] }).ok).toBe(true)
    expect(validateRecipe({ name: 'X', cookedWeightG: '0', items: [{ key: 'a', grams: '100' }] }).ok).toBe(false)
  })
})

describe('revisione: peso cotto e ml', () => {
  const base = { name: 'Ricetta', items: [{ key: 'a', grams: '100' }] }
  it('peso cotto quasi zero o oltre la colonna: errore nel modulo', () => {
    expect(validateRecipe({ ...base, cookedWeightG: '0,04' })).toMatchObject({ ok: false, errors: { cookedWeightG: 'Il peso cotto deve essere più di 0.' } })
    expect(validateRecipe({ ...base, cookedWeightG: '1000000' })).toMatchObject({ ok: false, errors: { cookedWeightG: 'Al massimo 999999.9 g.' } })
  })
  it('ingrediente in ml: messaggio in ml', () => {
    const result = validateRecipe({ name: 'R', cookedWeightG: '500', items: [{ key: 'a', grams: '0', unit: 'ml' }] })
    expect(result).toMatchObject({ ok: false, errors: { itemGrams: { a: 'I ml devono essere più di 0.' } } })
  })
})
