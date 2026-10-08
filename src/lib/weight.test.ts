import { describe, expect, it } from 'vitest'

import { addDays } from './dates'
import {
  ageOn,
  averageChange,
  daysSinceLastWeight,
  distanceToGoal,
  lastLogOnOrBefore,
  movingAverage7,
  needsJumpConfirmation,
  needsWeightReminder,
  recentWeightSummary,
  slopeKgPerWeek,
  weightForDay,
  weightSeries,
} from './weight'

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

describe('weightSeries', () => {
  it('un elemento per giorno; media solo con ≥ 4 pesate (ACCETTAZIONE: altrimenti solo punti)', () => {
    const logs = series([75, 75.2, 75.4])
    const points = weightSeries(logs, '2026-10-01', '2026-10-04')
    expect(points.map((p) => p.kg)).toEqual([75, 75.2, 75.4, null])
    expect(points.every((p) => p.average === null)).toBe(true)
    const more = weightSeries(series([75, 75.2, 75.4, 75.6]), '2026-10-01', '2026-10-04')
    expect(more[3]?.average).toBeCloseTo(75.3, 2)
  })
})

describe('averageChange', () => {
  it('differenza tra prima e ultima media', () => {
    const points = weightSeries(series([75, 75, 75, 75, 75.4, 75.8, 76.2, 76.6]), '2026-10-01', '2026-10-08')
    const change = averageChange(points)
    // media dal 4° giorno (75,00) all'8° (giorni 2-8: 529 / 7 = 75,57): +0,57 kg in 4 giorni
    expect(change?.days).toBe(4)
    expect(change?.kg).toBeCloseTo(0.57, 2)
  })

  it('senza almeno due medie → null', () => {
    expect(averageChange(weightSeries(series([75, 76]), '2026-10-01', '2026-10-02'))).toBeNull()
  })
})

describe('distanceToGoal', () => {
  it('direzione e kg mancanti', () => {
    expect(distanceToGoal(75, 80)).toEqual({ kg: 5, direction: 'up' })
    expect(distanceToGoal(82, 80)).toEqual({ kg: 2, direction: 'down' })
    expect(distanceToGoal(80.02, 80)).toEqual({ kg: 0, direction: 'reached' })
  })
})

describe('promemoria del peso (step 13, ADR-047)', () => {
  const today = '2026-10-20'
  it('nessuna pesata → promemoria', () => {
    expect(daysSinceLastWeight([], today)).toBeNull()
    expect(needsWeightReminder([], today)).toBe(true)
  })

  it('ultima pesata 4 giorni fa → niente; 5 o 6 giorni fa → promemoria', () => {
    expect(needsWeightReminder([{ date: '2026-10-16', kg: 75 }], today)).toBe(false)
    expect(daysSinceLastWeight([{ date: '2026-10-15', kg: 75 }], today)).toBe(5)
    expect(needsWeightReminder([{ date: '2026-10-15', kg: 75 }], today)).toBe(true)
    expect(needsWeightReminder([{ date: '2026-10-14', kg: 75 }], today)).toBe(true)
  })

  it('pesata di oggi → niente promemoria (attraversa anche il cambio d’ora del 25/10)', () => {
    expect(needsWeightReminder([{ date: today, kg: 75 }], today)).toBe(false)
    expect(daysSinceLastWeight([{ date: '2026-10-24', kg: 75 }], '2026-10-27')).toBe(3)
  })
})

describe('recentWeightSummary (ACCETTAZIONE step 13: calcolo a mano)', () => {
  it('ultimi 5 giorni contro i 5 prima', () => {
    // 11-15/10: 75,0 e 75,2 → media 75,1; 16-20/10: 75,4, 75,6, 75,8 → media 75,6; variazione +0,5
    const logs = [
      { date: '2026-10-11', kg: 75.0 },
      { date: '2026-10-14', kg: 75.2 },
      { date: '2026-10-16', kg: 75.4 },
      { date: '2026-10-18', kg: 75.6 },
      { date: '2026-10-20', kg: 75.8 },
    ]
    const summary = recentWeightSummary(logs, '2026-10-20')
    expect(summary.count).toBe(3)
    expect(summary.average).toBeCloseTo(75.6, 6)
    expect(summary.change).toBeCloseTo(0.5, 6)
  })

  it('senza pesate nei 5 giorni prima → variazione null', () => {
    expect(recentWeightSummary([{ date: '2026-10-20', kg: 75 }], '2026-10-20')).toEqual({ count: 1, average: 75, change: null })
  })
})
