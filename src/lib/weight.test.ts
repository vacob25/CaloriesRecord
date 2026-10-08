import { describe, expect, it } from 'vitest'

import { addDays } from './dates'
import { ageOn, lastLogOnOrBefore, movingAverage7, needsJumpConfirmation, slopeKgPerWeek, weightForDay } from './weight'

const day0 = '2026-10-01'
const series = (values: number[], start = day0) => values.map((kg, i) => ({ date: addDays(start, i), kg }))

describe('movingAverage7 (TESTING.md)', () => {
  it('[75,0; 75,2; 75,1; 75,4; 75,3; 75,5; 75,6] → 75,3', () => {
    const logs = series([75.0, 75.2, 75.1, 75.4, 75.3, 75.5, 75.6])
    expect(movingAverage7(logs, '2026-10-07')).toBeCloseTo(75.3, 2)
  })

  it('solo 3 pesate nella finestra → null', () => {
    expect(movingAverage7(series([75, 75.2, 75.1]), '2026-10-07')).toBeNull()
  })

  it('le pesate più vecchie di 7 giorni non contano', () => {
    const logs = [...series([90, 90, 90]), ...series([75, 75, 75, 75], '2026-10-10')]
    expect(movingAverage7(logs, '2026-10-13')).toBeCloseTo(75, 2)
  })
})

describe('slopeKgPerWeek (TESTING.md)', () => {
  it('28 giorni, peso = 75 + 0,25/7 · giorno → 0,25', () => {
    const logs = Array.from({ length: 28 }, (_, i) => ({ date: addDays(day0, i), kg: 75 + (0.25 / 7) * i }))
    expect(slopeKgPerWeek(logs, addDays(day0, 27))).toBeCloseTo(0.25, 2)
  })

  it('meno di 10 pesate in 28 giorni → null', () => {
    const logs = Array.from({ length: 9 }, (_, i) => ({ date: addDays(day0, i * 3), kg: 75 }))
    expect(slopeKgPerWeek(logs, addDays(day0, 27))).toBeNull()
  })

  it('giorni mancanti sparsi ma ≥ 10 pesate: usa le date reali, non l’indice', () => {
    const days = [0, 1, 4, 6, 9, 13, 15, 20, 24, 27]
    const logs = days.map((d) => ({ date: addDays(day0, d), kg: 75 + (0.5 / 7) * d }))
    expect(slopeKgPerWeek(logs, addDays(day0, 27))).toBeCloseTo(0.5, 2)
  })
})

describe('weightForDay', () => {
  it('media mobile se ci sono ≥ 4 pesate, altrimenti l’ultima pesata', () => {
    expect(weightForDay(series([75, 76, 77, 78]), '2026-10-04')).toBeCloseTo(76.5, 2)
    expect(weightForDay(series([75, 76]), '2026-10-04')).toBe(76)
    expect(weightForDay([], '2026-10-04')).toBeNull()
  })

  it('non usa pesate future', () => {
    expect(lastLogOnOrBefore(series([75, 76, 77]), '2026-10-02')?.kg).toBe(76)
  })
})

describe('needsJumpConfirmation (§9)', () => {
  const logs = [{ date: '2026-10-07', kg: 75 }]
  it('salto > 2 kg dal giorno prima → conferma', () => {
    expect(needsJumpConfirmation(logs, '2026-10-08', 77.1)).toBe(true)
    expect(needsJumpConfirmation(logs, '2026-10-08', 72.9)).toBe(true)
  })
  it('entro 2 kg o senza pesata il giorno prima → nessuna conferma', () => {
    expect(needsJumpConfirmation(logs, '2026-10-08', 77)).toBe(false)
    expect(needsJumpConfirmation(logs, '2026-10-09', 80)).toBe(false)
  })
})

describe('ageOn', () => {
  it('anni compiuti, compleanno incluso', () => {
    expect(ageOn('2006-10-08', '2026-10-07')).toBe(19)
    expect(ageOn('2006-10-08', '2026-10-08')).toBe(20)
    expect(ageOn('2004-02-29', '2026-03-01')).toBe(22)
  })
})
