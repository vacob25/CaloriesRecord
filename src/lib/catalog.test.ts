import { describe, expect, it } from 'vitest'

import { catalogToFood, parseCatalog } from './catalog'

// Voci FITTIZIE solo per provare le regole: i valori veri arrivano dal catalogo con fonte (ADR-050).
const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'alimento-di-prova',
  name: 'Alimento di prova',
  category: 'Uova',
  unit: 'g',
  kcal: 100,
  protein: 10,
  carbs: 5,
  fat: 4.5,
  portions: [{ name: '1 pezzo', amount: 50 }],
  source: 'fonte di prova',
  portionsSource: 'indicativo',
  notes: '',
  ...overrides,
})

describe('catalogo (step 16)', () => {
  it('voce valida: tenuta così com’è', () => {
    const result = parseCatalog({ version: 1, items: [item()] })
    expect(result.errors).toEqual([])
    expect(result.items).toHaveLength(1)
  })

  it('regole §9: macro oltre 100 g, kcal oltre 900', () => {
    const result = parseCatalog({
      version: 1,
      items: [item({ id: 'a', name: 'A', protein: 60, carbs: 50, fat: 0, kcal: 440 }), item({ id: 'b', name: 'B', kcal: 901, fat: 100, protein: 0, carbs: 0 })],
    })
    expect(result.items).toEqual([])
    expect(result.errors[0]).toContain('macro oltre 100 g in totale')
    expect(result.errors[1]).toContain('kcal oltre 900')
  })

  it('kcal incoerenti: scartate senza nota, tenute con la spiegazione', () => {
    const incoherent = { kcal: 200 } // i macro danno 100,5 kcal
    expect(parseCatalog({ version: 1, items: [item(incoherent)] }).errors[0]).toContain('senza spiegazione')
    expect(parseCatalog({ version: 1, items: [item({ ...incoherent, notes: 'contiene alcol' })] }).items).toHaveLength(1)
  })

  it('struttura: categoria fuori elenco, numeri come stringhe, campi in più, fonte vuota', () => {
    const result = parseCatalog({
      version: 1,
      items: [item({ category: 'Snack' }), item({ id: 'x', name: 'X', kcal: '100' }), item({ id: 'y', name: 'Y', extra: 1 }), item({ id: 'z', name: 'Z', source: '' })],
    })
    expect(result.items).toEqual([])
    expect(result.errors).toHaveLength(4)
  })

  it('più parti: id e nomi ripetuti scartati, parte malformata segnalata', () => {
    const result = parseCatalog({ version: 1, items: [item()] }, { version: 1, items: [item({ name: 'Altro nome' }), item({ id: 'altro-id' })] }, { items: [] })
    expect(result.items).toHaveLength(1)
    expect(result.errors).toEqual([
      expect.stringContaining('id ripetuto'),
      expect.stringContaining('nome ripetuto'),
      expect.stringContaining('Parte 3: formato non valido'),
    ])
  })

  it('conversione in cibo: unità, valori per 100, porzioni', () => {
    const parsed = parseCatalog({ version: 1, items: [item({ unit: 'ml', category: 'Bevande' })] }).items[0]
    expect(parsed && catalogToFood(parsed)).toEqual({
      values: { name: 'Alimento di prova', brand: null, barcode: null, unit: 'ml', servingG: null, per100g: { kcal: 100, protein: 10, carbs: 5, fat: 4.5 } },
      portions: [{ name: '1 pezzo', amount: 50 }],
    })
  })
})
