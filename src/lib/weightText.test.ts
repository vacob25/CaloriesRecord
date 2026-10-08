import { describe, expect, it } from 'vitest'

import { addDays } from './dates'
import { weightSeries } from './weight'
import { weightSummary } from './weightText'

const start = '2026-09-01'
const logs = (values: number[]) => values.map((kg, i) => ({ date: addDays(start, i), kg }))

describe('weightSummary', () => {
  it('salita in settimane', () => {
    const values = Array.from({ length: 28 }, (_, i) => 75 + (0.6 / 21) * i)
    const points = weightSeries(logs(values), start, addDays(start, 27))
    expect(weightSummary(points)).toBe('Media in salita di 0,6 kg in 3 settimane.')
  })

  it('pochi dati: lo dice', () => {
    expect(weightSummary(weightSeries(logs([75, 75.1]), start, addDays(start, 6)))).toBe(
      '2 pesate nel periodo: servono almeno 4 pesate in 7 giorni per la media.',
    )
    expect(weightSummary(weightSeries([], start, addDays(start, 6)))).toBe('Nessuna pesata nel periodo.')
  })
})
