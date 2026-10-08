import { describe, expect, it } from 'vitest'

import { computeDayTarget, progress, ringStatus, withTrainingType } from './targets'

// Profilo di esempio FITTIZIO (DOMAIN_RULES.md): uomo, 75 kg, 180 cm, 20 anni il giorno considerato.
const profile = {
  sex: 'male' as const,
  birthDate: '2006-01-15',
  heightCm: 180,
  activityFactor: 1.6,
  surplusPct: 0.1,
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
    expect(computeDayTarget(profile, 75, '2026-10-08', 'football')).toMatchObject({
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
