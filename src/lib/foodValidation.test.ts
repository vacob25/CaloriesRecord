import { describe, expect, it } from 'vitest'

import { validateFood, validateGrams, type FoodFormInput } from './foodValidation'

const base: FoodFormInput = {
  name: 'Riso',
  brand: '',
  barcode: '',
  basis: '100g',
  servingG: '',
  kcal: '350',
  protein: '7',
  carbs: '78',
  fat: '0,6',
}

describe('validateGrams (TESTING.md)', () => {
  it.each(['0', '-5', '5001', '', 'abc'])('"%s" → errore', (input) => {
    expect(validateGrams(input).ok).toBe(false)
  })

  it.each([
    ['150', 150],
    ['5000', 5000],
    ['12,25', 12.3],
  ])('"%s" → %s', (input, expected) => {
    expect(validateGrams(input)).toEqual({ ok: true, value: expected })
  })
})

describe('validateFood', () => {
  it('cibo valido: valori per 100 g, campi vuoti → null, nessun avviso', () => {
    const result = validateFood(base)
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Riso',
        brand: null,
        barcode: null,
        servingG: null,
        per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 },
      },
      warnings: [],
    })
  })

  it('nome vuoto e numeri mancanti: un errore per campo', () => {
    const result = validateFood({ ...base, name: '  ', kcal: '', fat: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.name).toBe('Inserisci il nome.')
      expect(result.errors.kcal).toBe('Inserisci le kcal.')
      expect(result.errors.fat).toBe('Inserisci i grassi.')
    }
  })

  it('valori negativi rifiutati', () => {
    const result = validateFood({ ...base, protein: '-1' })
    expect(result.ok).toBe(false)
  })

  it('P 60 + C 60 + G 10 per 100 g (> 100) → errore (TESTING.md)', () => {
    const result = validateFood({ ...base, kcal: '570', protein: '60', carbs: '60', fat: '10' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.macroSum).toContain('superano 100 g')
  })

  it('somma 101 g accettata (tolleranza 1%), 101,5 no', () => {
    expect(validateFood({ ...base, kcal: '404', protein: '50', carbs: '51', fat: '0' }).ok).toBe(true)
    expect(validateFood({ ...base, kcal: '406', protein: '50', carbs: '51,5', fat: '0' }).ok).toBe(false)
  })

  it('kcal oltre 900 o macro oltre 100 → errore', () => {
    expect(validateFood({ ...base, kcal: '901', protein: '0', carbs: '0', fat: '100' }).ok).toBe(false)
    expect(validateFood({ ...base, protein: '101', carbs: '0', fat: '0', kcal: '404' }).ok).toBe(false)
  })

  it('olio: 884 kcal e 100 g di grassi è valido', () => {
    expect(validateFood({ ...base, kcal: '884', protein: '0', carbs: '0', fat: '100' })).toMatchObject({
      ok: true,
      warnings: [],
    })
  })

  it('kcal dichiarate 400 ma macro che ne danno 800 → avviso, non errore (TESTING.md)', () => {
    // 4·10 + 4·10 + 9·80 = 800, somma macro 100 g (valida)
    const result = validateFood({ ...base, kcal: '400', protein: '10', carbs: '10', fat: '80' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.warnings[0]).toContain('Valori incoerenti')
  })

  it('differenza entro il 20%: nessun avviso', () => {
    // 4·7 + 4·78 + 9·0,6 = 345,4 contro 350 dichiarate
    const result = validateFood(base)
    expect(result.ok && result.warnings).toEqual([])
  })

  it('valori per porzione convertiti a 100 g', () => {
    const result = validateFood({ ...base, basis: 'serving', servingG: '30', kcal: '120', protein: '3', carbs: '21', fat: '2,4' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.servingG).toBe(30)
      expect(result.value.per100g).toEqual({ kcal: 400, protein: 10, carbs: 70, fat: 8 })
    }
  })

  it('per porzione senza grammi → errore sulla porzione', () => {
    const result = validateFood({ ...base, basis: 'serving', servingG: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.servingG).toBe('Inserisci i grammi della porzione.')
  })

  it('i limiti valgono dopo la conversione: 30 g con 60 g di proteine → oltre 100 g/100 g', () => {
    const result = validateFood({ ...base, basis: 'serving', servingG: '30', kcal: '240', protein: '60', carbs: '0', fat: '0' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.protein).toContain('convertito a 100 g')
  })

  it('porzione facoltativa con valori per 100 g: se scritta viene salvata', () => {
    const result = validateFood({ ...base, servingG: '80' })
    expect(result.ok && result.value.servingG).toBe(80)
  })

  it('marca e barcode vengono ripuliti dagli spazi', () => {
    const result = validateFood({ ...base, brand: '  Marca  ', barcode: ' 8001234567890 ' })
    expect(result.ok && result.value.brand).toBe('Marca')
    expect(result.ok && result.value.barcode).toBe('8001234567890')
  })
})
