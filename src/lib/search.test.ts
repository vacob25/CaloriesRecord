import { describe, expect, it } from 'vitest'

import { filterByQuery, normalizeText } from './search'

const foods = [
  { name: 'Caffè latte', brand: null },
  { name: 'Pasta integrale', brand: 'Marca A' },
  { name: 'Pasta al ragù', brand: null },
  { name: 'Latte intero', brand: 'Marca B' },
]

describe('normalizeText', () => {
  it('toglie accenti, maiuscole e spazi doppi', () => {
    expect(normalizeText('  Caffè   LATTE ')).toBe('caffe latte')
  })
})

describe('filterByQuery', () => {
  it('ricerca vuota → tutti', () => {
    expect(filterByQuery(foods, '  ')).toHaveLength(4)
  })

  it('senza accenti trova "ragù"', () => {
    expect(filterByQuery(foods, 'ragu').map((f) => f.name)).toEqual(['Pasta al ragù'])
  })

  it('tutte le parole devono comparire, anche nella marca', () => {
    expect(filterByQuery(foods, 'pasta marca').map((f) => f.name)).toEqual(['Pasta integrale'])
  })

  it('mantiene l’ordine originale', () => {
    expect(filterByQuery(foods, 'latte').map((f) => f.name)).toEqual(['Caffè latte', 'Latte intero'])
  })
})
