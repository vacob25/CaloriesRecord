import { describe, expect, it } from 'vitest'

import { addDays } from './dates'
import { dayStatus, periodStats, type StatsEntry } from './stats'

const entry = (date: string, kcal: number, extra: Partial<StatsEntry> = {}): StatsEntry => ({
  entryDate: date,
  mealType: 'lunch',
  foodId: 'f1',
  foodName: 'Pasta',
  kcal,
  protein: 10,
  carbs: 50,
  fat: 5,
  ...extra,
})

describe('dayStatus (§5)', () => {
  it('soglie −5% / +10%', () => {
    expect(dayStatus(2973.5, 1, 3130)).toBe('respected') // 0,95 · 3130
    expect(dayStatus(2973, 1, 3130)).toBe('under')
    expect(dayStatus(3443, 1, 3130)).toBe('respected') // 1,10 · 3130
    expect(dayStatus(3444, 1, 3130)).toBe('over')
  })

  it('giorno con 0 voci → non registrato, anche se il target c’è (TESTING.md)', () => {
    expect(dayStatus(0, 0, 3130)).toBe('unregistered')
  })
})

describe('periodStats', () => {
  const start = '2026-10-05' // lunedì
  const end = '2026-10-11'
  const targets = new Map(Array.from({ length: 7 }, (_, i) => [addDays(start, i), 3000]))

  it('7 giorni: 5 dentro −5/+10%, 1 sotto, 1 non registrato → rispettati 5 su 6 (TESTING.md)', () => {
    const entries = [
      entry('2026-10-05', 3000),
      entry('2026-10-06', 2900),
      entry('2026-10-07', 3100),
      entry('2026-10-08', 3200),
      entry('2026-10-09', 3300),
      entry('2026-10-10', 2000), // sotto
      // 11/10: nessuna voce
    ]
    const stats = periodStats(start, end, entries, targets, [])
    expect(stats.respected).toEqual({ count: 5, of: 6 })
    expect(stats.registeredDays).toBe(6)
    // Media dei soli 6 giorni registrati: 17500 / 6
    expect(stats.averageKcal).toBeCloseTo(17500 / 6, 2)
    expect(stats.days.find((d) => d.date === '2026-10-11')?.status).toBe('unregistered')
  })

  it('giorno con 0 voci escluso da media e conteggi; periodo vuoto → null, nessuna divisione per zero', () => {
    const empty = periodStats(start, end, [], targets, [])
    expect(empty).toMatchObject({ registeredDays: 0, averageKcal: null, averageMacros: null, respected: { count: 0, of: 0 }, topFoods: [] })
  })

  it('cibo cancellato (food_id null) raggruppato per food_name; conteggio per voci, non grammi (TESTING.md)', () => {
    const entries = [
      entry('2026-10-05', 100, { foodId: null, foodName: 'Biscotti' }),
      entry('2026-10-06', 100, { foodId: null, foodName: 'Biscotti' }),
      entry('2026-10-06', 999, { foodId: 'f2', foodName: 'Riso' }),
      entry('2026-10-07', 50, { foodId: 'f1', foodName: 'Pasta' }),
    ]
    expect(periodStats(start, end, entries, targets, []).topFoods).toEqual([
      { name: 'Biscotti', count: 2 },
      { name: 'Pasta', count: 1 },
      { name: 'Riso', count: 1 },
    ])
  })

  it('distribuzione per pasto = kcal del pasto / totale; macro medie sui giorni registrati', () => {
    const entries = [entry('2026-10-05', 300, { mealType: 'breakfast' }), entry('2026-10-05', 700, { mealType: 'dinner' })]
    const stats = periodStats(start, end, entries, targets, [])
    expect(stats.mealShare).toEqual({ breakfast: 0.3, lunch: 0, dinner: 0.7, snack: 0 })
    expect(stats.averageMacros).toEqual({ protein: 20, carbs: 100, fat: 10 })
  })

  it('giorno registrato senza target: conta nella media ma non nel rapporto dei rispettati', () => {
    const stats = periodStats(start, end, [entry('2026-10-05', 3000)], new Map(), [])
    expect(stats.registeredDays).toBe(1)
    expect(stats.respected).toEqual({ count: 0, of: 0 })
  })

  it('peso: variazione della media mobile tra inizio e fine periodo, in kg/settimana', () => {
    // 75 kg costanti fino all'inizio, poi +0,1 kg al giorno
    const weights = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-09-28', i), kg: i < 7 ? 75 : 75 + 0.1 * (i - 6) }))
    const stats = periodStats(start, end, [], targets, weights)
    // media al 5/10 (finestra 29/9-5/10: sei volte 75 e 75,1) = 75,0143;
    // media all'11/10 (5/10-11/10: 75,1 … 75,7) = 75,4 → +0,3857 in 6 giorni → 0,45 kg/sett.
    expect(stats.weightKgPerWeek).toBeCloseTo(((75.4 - (6 * 75 + 75.1) / 7) / 6) * 7, 6)
    expect(stats.weightKgPerWeek).toBeCloseTo(0.45, 3)
  })

  it('peso senza media a inizio o fine periodo → null', () => {
    expect(periodStats(start, end, [], targets, [{ date: '2026-10-11', kg: 75 }]).weightKgPerWeek).toBeNull()
  })
})
