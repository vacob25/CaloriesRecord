import { describe, expect, it } from 'vitest'

import { computeDayTarget, progress, rescaledMaintenanceKcal, ringStatus, withTrainingType } from './targets'

// Profilo di esempio FITTIZIO (DOMAIN_RULES.md): uomo, 75 kg, 180 cm, 20 anni il giorno considerato.
const profile = {
  sex: 'male' as const,
  birthDate: '2006-01-15',
  heightCm: 180,
  activityFactor: 1.6,
  goal: 'bulk' as const,
  surplusPct: 0.1,
  cutRatePct: 0.005,
  trainingBonusKcal: 200,
  proteinGPerKg: 2,
  fatGPerKg: 1,
}

describe('computeDayTarget — ACCETTAZIONE step 6', () => {
  it('riposo: mantenimento 2848, target 3130, macro 150/75/464', () => {
    expect(computeDayTarget(profile, 75, '2026-10-08', 'rest')).toEqual({
      trainingType: 'rest',
      maintenanceKcal: 2848,
      targetKcal: 3130,
      macros: { protein: 150, fat: 75, carbs: 464, lowCarbs: false },
    })
  })

  it('calcio: target 3330, macro 150/75/514', () => {
    expect(computeDayTarget(profile, 75, '2026-10-08', 'sport_2')).toMatchObject({
      targetKcal: 3330,
      macros: { protein: 150, fat: 75, carbs: 514 },
    })
  })

  it('l’età si calcola al giorno considerato (prima del compleanno: 19 anni → +5 kcal di BMR)', () => {
    expect(computeDayTarget(profile, 75, '2026-01-14').maintenanceKcal).toBe(2856)
  })
})

describe('withTrainingType', () => {
  it('parte dal mantenimento salvato, non dal profilo attuale', () => {
    expect(withTrainingType(2848, profile, 75, 'both').targetKcal).toBe(3330)
    expect(withTrainingType(3000, profile, 75, 'rest').targetKcal).toBe(3300)
  })
})

describe('ringStatus', () => {
  it('kcal restanti', () => {
    expect(ringStatus(1000.4, 3130)).toEqual({ remaining: 2130, over: 0, fraction: 1000 / 3130 })
  })

  it('oltre il target: "oltre di N", mai negativo, anello pieno — ACCETTAZIONE', () => {
    expect(ringStatus(3250, 3130)).toEqual({ remaining: 0, over: 120, fraction: 1 })
  })
})

describe('progress', () => {
  it('tra 0 e 1', () => {
    expect(progress(75, 150)).toBe(0.5)
    expect(progress(200, 150)).toBe(1)
    expect(progress(10, 0)).toBe(0)
  })
})

describe('mantenimento riscalato sul fattore di attività (Parametri)', () => {
  it('stesso BMR, nuovo moltiplicatore: 2848 / 1,6 · 1,8 = 3204', () => {
    expect(rescaledMaintenanceKcal(2848, 1.6, 1.8)).toBeCloseTo(3204, 6)
    expect(rescaledMaintenanceKcal(2848, 1.6, 1.6)).toBe(2848)
  })
})

describe('target per obiettivo (step 19, ADR-066) — profilo di esempio 75 kg, mantenimento 2848', () => {
  it('massa: +10% → 3130 (invariato)', () => {
    expect(computeDayTarget(profile, 75, '2026-10-08').targetKcal).toBe(3130)
  })
  it('mantenimento: nessuno scostamento → 2850', () => {
    expect(computeDayTarget({ ...profile, goal: 'maintain' }, 75, '2026-10-08').targetKcal).toBe(2850)
  })
  it.each([
    [0.005, 2440], // deficit 75 · 0,005 · 7700 / 7 = 412,5 → 2435,5 → 2440
    [0.007, 2270], // 577,5 → 2270,5 → 2270
    [0.01, 2020], //  825 → 2023 → 2020
  ])('cut al %s del peso a settimana → riposo %s kcal', (cutRatePct, expected) => {
    const result = computeDayTarget({ ...profile, goal: 'cut', cutRatePct }, 75, '2026-10-08')
    expect(result.targetKcal).toBe(expected)
    expect(result.maintenanceKcal).toBe(2848)
  })
  it('cut: il bonus allenamento si somma come prima (un solo bonus, anche con due sport)', () => {
    const cut = { ...profile, goal: 'cut' as const, cutRatePct: 0.005 }
    expect(withTrainingType(2848, cut, 75, 'sport_1').targetKcal).toBe(2640) // 2435,5 + 200 = 2635,5 → 2640
    expect(withTrainingType(2848, cut, 75, 'both').targetKcal).toBe(2640)
  })
  it('cut: il deficit segue il peso del giorno (più leggero → deficit più piccolo)', () => {
    expect(withTrainingType(2848, { ...profile, goal: 'cut', cutRatePct: 0.005 }, 60, 'rest').targetKcal).toBe(2520) // 60 · 0,005 · 1100 = 330 → 2518 → 2520
  })
})
