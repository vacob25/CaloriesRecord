import { describe, expect, it } from 'vitest'

import { defaultGrams, defaultQuantity, entrySnapshot, favoritesFirst, groupByMeal, mealForHour, recentFoods, rescaleEntry, stepGrams } from './meals'

describe('mealForHour', () => {
  it.each([
    [0, 'snack'],
    [4, 'snack'],
    [5, 'breakfast'],
    [9, 'breakfast'],
    [10, 'morning_snack'],
    [11, 'morning_snack'],
    [12, 'lunch'],
    [14, 'lunch'],
    [15, 'snack'],
    [18, 'dinner'],
    [22, 'dinner'],
    [23, 'snack'],
  ] as const)('ore %s → %s', (hour, meal) => {
    expect(mealForHour(hour)).toBe(meal)
  })
})

describe('entrySnapshot', () => {
  it('kcal dall’etichetta (110 kcal/100 g · 200 g = 220), macro arrotondati a 1 decimale', () => {
    expect(entrySnapshot({ kcal: 110, protein: 3.33, carbs: 20.05, fat: 1.11 }, 200)).toEqual({
      kcal: 220,
      protein: 6.7,
      carbs: 40.1,
      fat: 2.2,
    })
  })
})

describe('rescaleEntry', () => {
  it('scala lo snapshot sui nuovi grammi (non rilegge il cibo)', () => {
    expect(rescaleEntry({ grams: 200, kcal: 220, protein: 6.6, carbs: 40, fat: 2.2 }, 150)).toEqual({
      kcal: 165,
      protein: 5,
      carbs: 30,
      fat: 1.7,
    })
  })
})

describe('stepGrams', () => {
  it('passi di 10 g', () => {
    expect(stepGrams(100, 1)).toBe(110)
    expect(stepGrams(100, -1)).toBe(90)
    expect(stepGrams(15, -1)).toBe(5)
  })

  it('mai 0 o meno, mai oltre 5000', () => {
    expect(stepGrams(10, -1)).toBe(10)
    expect(stepGrams(5, -1)).toBe(5)
    expect(stepGrams(4995, 1)).toBe(4995)
  })
})

describe('defaultGrams', () => {
  it('ultimi grammi usati, poi porzione, poi 100', () => {
    expect(defaultGrams(80, 30)).toBe(80)
    expect(defaultGrams(undefined, 30)).toBe(30)
    expect(defaultGrams(undefined, null)).toBe(100)
  })
})

describe('groupByMeal', () => {
  it('cinque pasti in ordine (step 17), con totali; pasto vuoto = zeri', () => {
    const groups = groupByMeal([
      { id: 1, mealType: 'lunch' as const, kcal: 300, protein: 10, carbs: 40, fat: 5 },
      { id: 2, mealType: 'lunch' as const, kcal: 100, protein: 2, carbs: 10, fat: 5 },
      { id: 3, mealType: 'breakfast' as const, kcal: 200, protein: 8, carbs: 30, fat: 4 },
    ])
    expect(Object.keys(groups)).toEqual(['breakfast', 'morning_snack', 'lunch', 'dinner', 'snack'])
    expect(groups.lunch.total).toEqual({ kcal: 400, protein: 12, carbs: 50, fat: 10 })
    expect(groups.lunch.entries.map((e) => e.id)).toEqual([1, 2])
    expect(groups.dinner).toEqual({ entries: [], total: { kcal: 0, protein: 0, carbs: 0, fat: 0 } })
  })
})

describe('recentFoods', () => {
  it('solo i cibi già usati, dal più recente, al massimo `limit`', () => {
    const foods = [
      { name: 'mai', lastUsedAt: null },
      { name: 'ieri', lastUsedAt: '2026-10-07T12:00:00Z' },
      { name: 'oggi', lastUsedAt: '2026-10-08T08:00:00Z' },
      { name: 'settimana scorsa', lastUsedAt: '2026-10-01T08:00:00Z' },
    ]
    expect(recentFoods(foods).map((f) => f.name)).toEqual(['oggi', 'ieri', 'settimana scorsa'])
    expect(recentFoods(foods, 2).map((f) => f.name)).toEqual(['oggi', 'ieri'])
  })
})

describe('defaultQuantity (porzioni, revisione)', () => {
  const eggs = [{ amount: 50 }, { amount: 60 }]
  it('senza storia né porzione abituale: 1 × la prima porzione, selezionata', () => {
    expect(defaultQuantity(undefined, null, eggs)).toEqual({ amount: 50, portionIndex: 0 })
  })
  it('ultima quantità e porzione abituale vengono prima', () => {
    expect(defaultQuantity(100, null, eggs)).toEqual({ amount: 100, portionIndex: null })
    expect(defaultQuantity(undefined, 30, eggs)).toEqual({ amount: 30, portionIndex: null })
    expect(defaultQuantity(undefined, null, [])).toEqual({ amount: 100, portionIndex: null })
  })
})

describe('step 17: recenti e preferiti', () => {
  it('alimenti recenti: al massimo 8', () => {
    const foods = Array.from({ length: 12 }, (_, i) => ({ id: i, lastUsedAt: `2026-10-${String(10 + i).padStart(2, '0')}T08:00:00Z` }))
    expect(recentFoods(foods).map((food) => food.id)).toEqual([11, 10, 9, 8, 7, 6, 5, 4])
  })
  it('preferiti per primi, ordine conservato', () => {
    const items = [{ n: 'a', f: false }, { n: 'b', f: true }, { n: 'c', f: false }, { n: 'd', f: true }]
    expect(favoritesFirst(items, (item) => item.f).map((item) => item.n)).toEqual(['b', 'd', 'a', 'c'])
  })
})
