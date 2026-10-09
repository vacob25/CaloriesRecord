import { describe, expect, it } from 'vitest'

import {
  activityFactorFor,
  adjustmentPct,
  ACTIVITY_LEVELS,
  CUT_PACES,
  cutDeficitKcal,
  cutNeedsMedicalNote,
  describeTargetRate,
  isBelowBmr,
  isGoal,
  planWarnings,
  plannedRateKgWeek,
  rateBandKgWeek,
  restDayTargetKcal,
  validateCutGoalWeight,
  weeksToGoal,
  type GoalProfile,
} from './goals'

// Profilo FITTIZIO di esempio: 75 kg, mantenimento 2848, BMR 1780.
const bulk: GoalProfile = { goal: 'bulk', surplusPct: 0.1, cutRatePct: 0.005 }
const maintain: GoalProfile = { ...bulk, goal: 'maintain' }
const cut: GoalProfile = { ...bulk, goal: 'cut' }

describe('cut: deficit dal ritmo in % del peso (step 19)', () => {
  it('75 kg · 0,5% a settimana · 7700 / 7 = 412,5 kcal al giorno', () => {
    expect(cutDeficitKcal(75, 0.005)).toBe(412.5)
    expect(cutDeficitKcal(75, 0.007)).toBe(577.5)
    expect(cutDeficitKcal(75, 0.01)).toBe(825)
  })
  it('scostamento dal mantenimento: massa +10%, mantenimento 0, cut negativo', () => {
    expect(adjustmentPct(bulk, 2848, 75)).toBe(0.1)
    expect(adjustmentPct(maintain, 2848, 75)).toBe(0)
    expect(adjustmentPct(cut, 2848, 75)).toBeCloseTo(-412.5 / 2848, 10)
  })
  it('target dei giorni di riposo: 3130 / 2850 / 2440', () => {
    expect(restDayTargetKcal(2848, bulk, 75)).toBe(3130)
    expect(restDayTargetKcal(2848, maintain, 75)).toBe(2850)
    expect(restDayTargetKcal(2848, cut, 75)).toBe(2440)
  })
  it('ritmo atteso dal piano: +0,26 massa, 0 mantenimento, −0,375 cut (0,5% di 75 kg)', () => {
    expect(plannedRateKgWeek(bulk, 2848, 75)).toBeCloseTo(0.2589, 4)
    expect(plannedRateKgWeek(maintain, 2848, 75)).toBe(0)
    expect(plannedRateKgWeek(cut, 2848, 75)).toBeCloseTo(-0.375, 6)
  })
  it('mai un deficit con maintenance 0', () => {
    expect(adjustmentPct(cut, 0, 75)).toBe(0)
  })
})

describe('bande del peso per obiettivo (ricalibrazione)', () => {
  it('massa +0,20/+0,40, mantenimento ±0,10, cut tra −1% e −0,5% del peso', () => {
    expect(rateBandKgWeek('bulk', 75)).toEqual({ min: 0.2, max: 0.4 })
    expect(rateBandKgWeek('maintain', 75)).toEqual({ min: -0.1, max: 0.1 })
    expect(rateBandKgWeek('cut', 75)).toEqual({ min: -0.75, max: -0.375 })
    expect(rateBandKgWeek('cut', 100)).toEqual({ min: -1, max: -0.5 })
  })
  it('il ritmo voluto è dentro la banda del cut per ogni ritmo scelto', () => {
    for (const pace of CUT_PACES) {
      const planned = plannedRateKgWeek({ ...cut, cutRatePct: pace.pct }, 2848, 75)
      const band = rateBandKgWeek('cut', 75)
      expect(round3(planned)).toBeGreaterThanOrEqual(band.min)
      expect(round3(planned)).toBeLessThanOrEqual(band.max)
    }
  })
})
const round3 = (n: number) => Math.round(n * 1000) / 1000

describe('testi del ritmo voluto', () => {
  it('massa, mantenimento, cut', () => {
    expect(describeTargetRate(bulk, 75)).toBe('+0,20 / +0,35 kg a settimana')
    expect(describeTargetRate(maintain, 75)).toBe('stabile (±0,10 kg a settimana)')
    expect(describeTargetRate(cut, 75)).toBe('circa -0,38 kg a settimana')
    expect(describeTargetRate(cut, null)).toBe('perdita del 0,5% del peso a settimana')
  })
})

describe('previsione del cut', () => {
  it('75 → 70 kg: 14 settimane al 0,5%, 7 all’1%', () => {
    expect(weeksToGoal(75, 70, 0.005)).toBe(14)
    expect(weeksToGoal(75, 70, 0.01)).toBe(7)
  })
  it('nessuna previsione se l’obiettivo non è sotto il peso', () => {
    expect(weeksToGoal(75, 75, 0.005)).toBeNull()
    expect(weeksToGoal(75, 80, 0.005)).toBeNull()
    expect(weeksToGoal(75, 70, 0)).toBeNull()
  })
  it('peso obiettivo del cut: deve essere più basso', () => {
    expect(validateCutGoalWeight(75, 70)).toBeNull()
    expect(validateCutGoalWeight(75, null)).toBeNull()
    expect(validateCutGoalWeight(75, 75)).toContain('più basso')
    expect(validateCutGoalWeight(75, 80)).toContain('più basso')
  })
})

describe('avvisi di sicurezza (non bloccano)', () => {
  it('cut sotto i 18 anni: nota medica', () => {
    expect(cutNeedsMedicalNote(17)).toBe(true)
    expect(cutNeedsMedicalNote(18)).toBe(false)
  })
  it('target sotto il BMR', () => {
    expect(isBelowBmr(1700, 1780)).toBe(true)
    expect(isBelowBmr(1780, 1780)).toBe(false)
  })
  it('piano normale: nessun avviso', () => {
    expect(planWarnings(bulk, 2848, 75, 1780)).toEqual([])
    expect(planWarnings(cut, 2848, 75, 1780)).toEqual([])
    expect(planWarnings(cut, 2848, 75, 1780).length).toBe(0)
  })
  it('massa oltre +0,5 kg/settimana: avviso grasso', () => {
    // mantenimento 3204 · 20% · 7 / 7700 = 0,5825
    const warnings = planWarnings({ ...bulk, surplusPct: 0.2 }, 3204, 75, 1780)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('+0,58')
  })
  it('cut esattamente all’1% non avvisa, sopra sì', () => {
    expect(planWarnings({ ...cut, cutRatePct: 0.01 }, 2848, 75, 1780)).toEqual([])
    expect(planWarnings({ ...cut, cutRatePct: 0.015 }, 2848, 75, 1780)[0]).toContain('perderesti circa 1,13')
  })
  it('cut con target sotto il BMR: avviso', () => {
    const warnings = planWarnings(cut, 1800, 75, 1780)
    expect(warnings.some((warning) => warning.includes('metabolismo basale'))).toBe(true)
  })
})

describe('obiettivo e attività', () => {
  it('riconosce gli obiettivi', () => {
    expect(isGoal('cut')).toBe(true)
    expect(isGoal('dimagrire')).toBe(false)
    expect(isGoal(undefined)).toBe(false)
  })
  it('livelli di attività: 1,2 / 1,375 / 1,55 / 1,725, in ordine crescente', () => {
    expect(ACTIVITY_LEVELS.map((level) => level.factor)).toEqual([1.2, 1.375, 1.55, 1.725])
    expect(activityFactorFor('moderate')).toBe(1.55)
  })
  it('tre ritmi del cut: 0,5% / 0,7% / 1%', () => {
    expect(CUT_PACES.map((pace) => pace.pct)).toEqual([0.005, 0.007, 0.01])
  })
})
