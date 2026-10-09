import { describe, expect, it } from 'vitest'

import {
  bmr,
  dayTarget,
  kcalFromMacros,
  macros,
  maintenance,
  kcalOf,
  nutrientsFor,
  per100gFromServing,
  recipePer100g,
  sumNutrients,
  totalGrams,
} from './nutrition'

describe('kcalOf', () => {
  it('110 kcal/100 g, 200 g → 220 (TESTING.md)', () => {
    expect(kcalOf({ kcal: 110 }, 200)).toBeCloseTo(220, 2)
  })
})

describe('nutrientsFor', () => {
  it('scala tutti i valori sui grammi', () => {
    const result = nutrientsFor({ kcal: 350, protein: 12, carbs: 70, fat: 1.5 }, 80)
    expect(result.kcal).toBeCloseTo(280, 2)
    expect(result.protein).toBeCloseTo(9.6, 2)
    expect(result.carbs).toBeCloseTo(56, 2)
    expect(result.fat).toBeCloseTo(1.2, 2)
  })
})

describe('sumNutrients', () => {
  it('somma; lista vuota → zeri', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
    expect(
      sumNutrients([
        { kcal: 100, protein: 1, carbs: 2, fat: 3 },
        { kcal: 50, protein: 4, carbs: 5, fat: 6 },
      ]),
    ).toEqual({ kcal: 150, protein: 5, carbs: 7, fat: 9 })
  })
})

describe('kcalFromMacros', () => {
  it('fattori 4/4/9', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 })).toBe(165)
  })
})

describe('per100gFromServing', () => {
  it('porzione da 30 g con 120 kcal → 400 kcal/100 g', () => {
    const result = per100gFromServing({ kcal: 120, protein: 3, carbs: 21, fat: 2.4 }, 30)
    expect(result.kcal).toBeCloseTo(400, 2)
    expect(result.protein).toBeCloseTo(10, 2)
    expect(result.carbs).toBeCloseTo(70, 2)
    expect(result.fat).toBeCloseTo(8, 2)
  })
})

describe('recipePer100g', () => {
  // "Pasta al ragù" (criterio di accettazione dello step 4), valori inventati:
  //   pasta 350 kcal, P 12, C 72, F 1,5 · 200 g → 700 kcal, P 24, C 144, F 3
  //   ragù  120 kcal, P 8,  C 6,  F 7   · 250 g → 300 kcal, P 20, C 15,  F 17,5
  //   olio  884 kcal, P 0,  C 0,  F 100 · 10 g  →  88,4 kcal, P 0, C 0,  F 10
  //   totale 1088,4 kcal, P 44, C 159, F 30,5; peso cotto 800 g
  //   per 100 g = totale / 8 → 136,05 kcal, P 5,5, C 19,875 → 19,88, F 3,8125 → 3,81
  const pastaAlRagu = [
    { per100g: { kcal: 350, protein: 12, carbs: 72, fat: 1.5 }, grams: 200 },
    { per100g: { kcal: 120, protein: 8, carbs: 6, fat: 7 }, grams: 250 },
    { per100g: { kcal: 884, protein: 0, carbs: 0, fat: 100 }, grams: 10 },
  ]

  it('Pasta al ragù: torna con il calcolo a mano', () => {
    expect(recipePer100g(pastaAlRagu, 800)).toEqual({ kcal: 136.05, protein: 5.5, carbs: 19.88, fat: 3.81 })
  })

  it('peso cotto uguale al crudo: i valori sono la media pesata', () => {
    const result = recipePer100g(pastaAlRagu, totalGrams(pastaAlRagu))
    expect(result.kcal).toBeCloseTo((1088.4 / 460) * 100, 1)
  })

  it('totalGrams somma i grammi crudi', () => {
    expect(totalGrams(pastaAlRagu)).toBe(460)
  })
})

// Profilo di esempio FITTIZIO di DOMAIN_RULES.md: uomo, 75 kg, 180 cm, 20 anni.
describe('bmr (TESTING.md)', () => {
  it('uomo 75 kg, 180 cm, 20 anni → 1780', () => {
    expect(bmr({ sex: 'male', weightKg: 75, heightCm: 180, ageYears: 20 })).toBeCloseTo(1780, 2)
  })

  it('donna 60 kg, 165 cm, 30 anni → 1320,25', () => {
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 165, ageYears: 30 })).toBeCloseTo(1320.25, 2)
  })
})

describe('maintenance', () => {
  it('1780 · 1,6 → 2848', () => {
    expect(maintenance(1780, 1.6)).toBeCloseTo(2848, 2)
  })
})

describe('dayTarget (TESTING.md)', () => {
  it.each([
    ['rest', 3130],
    ['sport_2', 3330],
    ['sport_1', 3330],
    ['both', 3330],
  ] as const)('2848, +10%%, %s, bonus 200 → %s (il bonus non si somma)', (type, expected) => {
    expect(dayTarget(2848, 0.1, type, 200)).toBe(expected)
  })
})

describe('macros (TESTING.md)', () => {
  it.each([
    [3130, { protein: 150, fat: 75, carbs: 464, lowCarbs: false }],
    [3330, { protein: 150, fat: 75, carbs: 514, lowCarbs: false }],
    [2000, { protein: 150, fat: 75, carbs: 181, lowCarbs: true }],
  ])('%s kcal, 75 kg, 2,0/1,0 g/kg → %o', (target, expected) => {
    const result = macros(target, 75, 2, 1)
    expect(result).toEqual(expected)
    // Coerenza: le kcal dei macro tornano al target entro ±5 kcal.
    expect(Math.abs(4 * result.protein + 4 * result.carbs + 9 * result.fat - target)).toBeLessThanOrEqual(5)
  })
})
