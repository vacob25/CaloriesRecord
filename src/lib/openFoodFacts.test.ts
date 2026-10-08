import { describe, expect, it } from 'vitest'

import fixture from './__fixtures__/off-product.json'
import { convertOffProduct, isPlausibleBarcode, parseProductResponse, parseSearchResponse } from './openFoodFacts'

// Fixture con dati INVENTATI nella forma della risposta v3 (schemi ufficiali, ADR-041).
describe('parseProductResponse', () => {
  it('prodotto trovato', () => {
    expect(parseProductResponse(200, fixture)).toEqual({ found: true, product: fixture.product })
  })

  it('404, status "failure" o corpo strano → non trovato', () => {
    expect(parseProductResponse(404, {})).toEqual({ found: false })
    expect(parseProductResponse(200, { status: 'failure', result: { id: 'product_not_found' } })).toEqual({ found: false })
    expect(parseProductResponse(200, 'html di errore')).toEqual({ found: false })
  })
})

describe('convertOffProduct', () => {
  it('fixture completa → valori per 100 g, nome italiano, prima marca, porzione in g; campi nuovi ignorati', () => {
    expect(convertOffProduct(fixture.product)).toEqual({
      kind: 'complete',
      values: {
        name: 'Fiocchi d’avena di prova'.replace('’', "'"),
        brand: 'Marca Inventata',
        barcode: '0000000000017',
        unit: 'g',
        servingG: 40,
        per100g: { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 },
      },
      warnings: [],
    })
  })

  it('macro mancanti → incompleto con modulo precompilato, MAI zeri silenziosi', () => {
    const result = convertOffProduct({ code: '8000000000001', product_name: 'Senza tabella', nutriments: { 'energy-kcal_100g': 120 } })
    expect(result.kind).toBe('incomplete')
    if (result.kind === 'incomplete') {
      expect(result.missing).toEqual(['proteine', 'carboidrati', 'grassi'])
      expect(result.form).toMatchObject({ name: 'Senza tabella', barcode: '8000000000001', kcal: '120', protein: '', fat: '' })
    }
  })

  it('niente nutriments né nome → incompleto, codice dal barcode scansionato', () => {
    const result = convertOffProduct({}, '8000000000002')
    expect(result).toMatchObject({ kind: 'incomplete', missing: ['nome', 'kcal', 'proteine', 'carboidrati', 'grassi'] })
    if (result.kind === 'incomplete') expect(result.form.barcode).toBe('8000000000002')
  })

  it('valori assurdi (macro > 100 g) → incompleto da controllare, non salvato', () => {
    const result = convertOffProduct({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': 500, proteins_100g: 80, carbohydrates_100g: 80, fat_100g: 5 } })
    expect(result).toMatchObject({ kind: 'incomplete', missing: ['valori non validi (controlla l’etichetta)'] })
  })

  it('porzione in ml ignorata (solo grammi in v1); valori non numerici ignorati', () => {
    const result = convertOffProduct({
      code: '2',
      product_name: 'Bevanda',
      serving_quantity: 250,
      serving_quantity_unit: 'ml',
      nutriments: { 'energy-kcal_100g': 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 'n/d' },
    })
    expect(result.kind).toBe('incomplete')
    if (result.kind === 'incomplete') expect(result.form.servingG).toBe('')
  })
})

describe('parseSearchResponse', () => {
  it('converte i risultati e scarta quelli senza codice o nome', () => {
    const hits = parseSearchResponse({
      hits: [fixture.product, { product_name: 'Senza codice' }, { code: '123', nutriments: {} }, 'spazzatura'],
      count: 4,
    })
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ code: '0000000000017', brand: 'Marca Inventata', kcal: 372, conversion: { kind: 'complete' } })
  })

  it('corpo inatteso → nessun risultato', () => {
    expect(parseSearchResponse(null)).toEqual([])
    expect(parseSearchResponse({ hits: 'no' })).toEqual([])
  })
})

describe('isPlausibleBarcode', () => {
  it.each(['12345678', '8001234567890', '00012345678905'])('%s valido', (code) => expect(isPlausibleBarcode(code)).toBe(true))
  it.each(['1234567', '123456789012345', '80012345678a0', ''])('%s non valido', (code) => expect(isPlausibleBarcode(code)).toBe(false))
})
