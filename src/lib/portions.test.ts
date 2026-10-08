import { describe, expect, it } from 'vitest'

import { formatCount, formatQuantity, parsePortions, portionAmount, stepCount, validatePortionRows } from './portions'

describe('parsePortions', () => {
  it('tiene solo le porzioni valide (dato sporco dal database → ignorato)', () => {
    expect(
      parsePortions([
        { name: ' 1 uovo medio ', amount: 50 },
        { name: '', amount: 10 },
        { name: 'x', amount: -1 },
        'spazzatura',
        { name: '1 cucchiaio', amount: 10.04 },
      ]),
    ).toEqual([
      { name: '1 uovo medio', amount: 50 },
      { name: '1 cucchiaio', amount: 10 },
    ])
    expect(parsePortions(null)).toEqual([])
  })
})

describe('portionAmount (ACCETTAZIONE step 14)', () => {
  it('2 uova medie da 50 g = 100 g; ½ banana da 120 g = 60 g', () => {
    expect(portionAmount({ name: '1 uovo medio', amount: 50 }, 2)).toBe(100)
    expect(portionAmount({ name: '1 banana', amount: 120 }, 0.5)).toBe(60)
  })
})

describe('stepCount', () => {
  it('passi di ½, mai sotto ½', () => {
    expect(stepCount(1, 1)).toBe(1.5)
    expect(stepCount(1, -1)).toBe(0.5)
    expect(stepCount(0.5, -1)).toBe(0.5)
  })
})

describe('formattazione', () => {
  it('quantità con unità e numero di porzioni', () => {
    expect(formatQuantity(200, 'ml')).toBe('200 ml')
    expect(formatQuantity(12.5, 'g')).toBe('12,5 g')
    expect([0.5, 1, 1.5, 2].map(formatCount)).toEqual(['½', '1', '1½', '2'])
  })
})

describe('validatePortionRows', () => {
  it('righe valide, righe vuote ignorate, virgola decimale', () => {
    expect(
      validatePortionRows([
        { key: 'a', name: '1 cucchiaio', amount: '10' },
        { key: 'b', name: '', amount: '' },
        { key: 'c', name: '1 cucchiaino', amount: '4,5' },
      ]),
    ).toEqual({ ok: true, value: [{ name: '1 cucchiaio', amount: 10 }, { name: '1 cucchiaino', amount: 4.5 }] })
  })

  it('nome mancante, quantità mancante o troppo grande → errore sulla riga', () => {
    const result = validatePortionRows([
      { key: 'a', name: '', amount: '10' },
      { key: 'b', name: 'Fetta', amount: '' },
      { key: 'c', name: 'Pentola', amount: '6000' },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['a', 'b', 'c'])
  })
})
