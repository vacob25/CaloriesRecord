import { describe, expect, it } from 'vitest'

import { addDays } from './dates'
import {
  acceptedActivityFactor,
  evaluateRecalibration,
  isRegisteredDay,
  proposalWithinLimits,
  weeklyRowAction,
  type RecalDay,
} from './recalibration'

// Contesto comune di TESTING.md: 28 giorni, ≥ 80% registrati, ≥ 10 pesate, mantenimento 2848, surplus 0,10, intake 3200.
const today = '2026-11-05'
const firstDay = addDays(today, -28)
const days = (kcal = 3200, count = 28): RecalDay[] =>
  Array.from({ length: count }, (_, i) => ({ date: addDays(firstDay, i), kcal, target: 3130 }))
const weightsWithSlope = (perWeek: number, every = 1) =>
  Array.from({ length: 28 }, (_, i) => i)
    .filter((i) => i % every === 0)
    .map((i) => ({ date: addDays(firstDay, i), kg: 75 + (perWeek / 7) * i }))
const input = (perWeek: number) => ({
  today,
  firstUseDate: firstDay,
  days: days(),
  weights: weightsWithSlope(perWeek),
  currentMaintenanceKcal: 2848,
  goalProfile: { goal: 'bulk' as const, surplusPct: 0.1, cutRatePct: 0.005 },
  weightKg: 75,
})

describe('evaluateRecalibration (TESTING.md)', () => {
  it('+0,25 kg/sett. → mantenimento stimato 2925, nessuna proposta (in banda)', () => {
    const result = evaluateRecalibration(input(0.25))
    expect(result.status).toBe('inBand')
    if (result.status !== 'notEnoughData') expect(result.estimatedMaintenanceKcal).toBeCloseTo(2925, 0)
  })

  it('+0,10 → stimato 3090, proposto 2990 (tetto +5%: 2990,4), target riposo 3290', () => {
    const result = evaluateRecalibration(input(0.1))
    expect(result).toMatchObject({ status: 'proposal', proposedMaintenanceKcal: 2990, proposedRestTargetKcal: 3290, fatWarning: false })
    if (result.status !== 'notEnoughData') expect(result.estimatedMaintenanceKcal).toBeCloseTo(3090, 0)
  })

  it('+0,60 → stimato 2540, proposto 2710 (tetto −5%: 2705,6), target riposo 2980, avviso grasso', () => {
    const result = evaluateRecalibration(input(0.6))
    expect(result).toMatchObject({ status: 'proposal', proposedMaintenanceKcal: 2710, proposedRestTargetKcal: 2980, fatWarning: true })
    if (result.status !== 'notEnoughData') expect(result.estimatedMaintenanceKcal).toBeCloseTo(2540, 0)
  })

  it('bordi della banda: +0,20 e +0,40 → nessuna proposta', () => {
    expect(evaluateRecalibration(input(0.2)).status).toBe('inBand')
    expect(evaluateRecalibration(input(0.4)).status).toBe('inBand')
  })

  it('peso fermo con target e registrazione costanti → la proposta ALZA il mantenimento (entro +5%)', () => {
    expect(evaluateRecalibration(input(0))).toMatchObject({ status: 'proposal', proposedMaintenanceKcal: 2990 })
  })

  it('meno di 21 giorni di uso → none, "servono più dati"', () => {
    const result = evaluateRecalibration({ ...input(0.1), firstUseDate: addDays(today, -20) })
    expect(result.status).toBe('notEnoughData')
    if (result.status === 'notEnoughData') expect(result.reasons[0]).toContain('21 giorni')
  })

  it('21 giorni di uso, tutti registrati, ≥ 10 pesate → si calcola (finestra tagliata all’inizio dell’uso, ADR-044)', () => {
    const start = addDays(today, -21)
    const result = evaluateRecalibration({
      ...input(0.1),
      firstUseDate: start,
      weights: Array.from({ length: 21 }, (_, i) => ({ date: addDays(start, i), kg: 75 + (0.1 / 7) * i })),
    })
    expect(result).toMatchObject({ status: 'proposal', windowDays: 21 })
  })

  it('meno dell’80% di giorni registrati → none', () => {
    const someForgotten = days().map((day, i) => (i < 6 ? { ...day, kcal: 0 } : day)) // 22 su 28 = 78,6%
    const result = evaluateRecalibration({ ...input(0.1), days: someForgotten })
    expect(result.status).toBe('notEnoughData')
    if (result.status === 'notEnoughData') expect(result.reasons.join(' ')).toContain('22 su 28')
  })

  it('meno di 10 pesate → none', () => {
    const result = evaluateRecalibration({ ...input(0.1), weights: weightsWithSlope(0.1, 3) }) // 10 pesate: ok
    expect(result.status).toBe('proposal')
    const few = evaluateRecalibration({ ...input(0.1), weights: weightsWithSlope(0.1, 4) }) // 7 pesate
    expect(few.status).toBe('notEnoughData')
  })

  it('un giorno con kcal < 50% del target non conta come registrato (e non entra nella media)', () => {
    expect(isRegisteredDay({ date: today, kcal: 1564, target: 3130 })).toBe(false)
    expect(isRegisteredDay({ date: today, kcal: 1565, target: 3130 })).toBe(true)
    expect(isRegisteredDay({ date: today, kcal: 3000, target: null })).toBe(false)
    const mixed = days().map((day, i) => (i < 5 ? { ...day, kcal: 1000 } : day)) // 23 su 28 registrati
    const result = evaluateRecalibration({ ...input(0.25), days: mixed })
    if (result.status !== 'notEnoughData') expect(result.averageIntakeKcal).toBe(3200)
    else throw new Error('atteso calcolo')
  })
})

describe('acceptedActivityFactor', () => {
  it('accettare imposta activity_factor = proposto / BMR attuale (3 decimali)', () => {
    expect(acceptedActivityFactor(2990, 1780)).toBe(1.68)
    expect(acceptedActivityFactor(2710, 1780)).toBe(1.522)
  })
})

describe('bande per obiettivo (step 19, ADR-066)', () => {
  // Stesso contesto, ma si mangia meno: 28 giorni a 2440 kcal (target del cut 0,5%: 2440).
  const withGoal = (perWeek: number, goalProfile: { goal: 'bulk' | 'maintain' | 'cut'; surplusPct: number; cutRatePct: number }, kcal = 3200) => ({
    ...input(perWeek),
    days: days(kcal),
    goalProfile,
  })
  const cut = { goal: 'cut' as const, surplusPct: 0.1, cutRatePct: 0.005 }
  const maintain = { goal: 'maintain' as const, surplusPct: 0.1, cutRatePct: 0.005 }

  it('cut: −0,50 kg/sett. è in banda (−0,75/−0,375), mantenimento stimato 2990', () => {
    const result = evaluateRecalibration(withGoal(-0.5, cut, 2440))
    expect(result).toMatchObject({ status: 'inBand', fatWarning: false, fastLossWarning: false })
    if (result.status !== 'notEnoughData') expect(result.estimatedMaintenanceKcal).toBeCloseTo(2990, 0)
  })

  it('cut troppo lento: −0,10 → stimato 2550, proposto 2710 (tetto −5%: 2705,6), target riposo cut 2300', () => {
    const result = evaluateRecalibration(withGoal(-0.1, cut, 2440))
    expect(result).toMatchObject({ status: 'proposal', proposedMaintenanceKcal: 2710, proposedRestTargetKcal: 2300, fastLossWarning: false })
    if (result.status !== 'notEnoughData') expect(result.estimatedMaintenanceKcal).toBeCloseTo(2550, 0)
  })

  it('cut troppo veloce: −0,90 (oltre l’1% del peso) → avviso muscolo, il mantenimento sale al massimo +5%: 2990', () => {
    const result = evaluateRecalibration(withGoal(-0.9, cut, 2440))
    expect(result).toMatchObject({ status: 'proposal', proposedMaintenanceKcal: 2990, proposedRestTargetKcal: 2580, fastLossWarning: true, fatWarning: false })
  })

  it('cut: il +0,25 del massa NON è in banda (si ingrassa durante un cut)', () => {
    expect(evaluateRecalibration(withGoal(0.25, cut, 2440)).status).toBe('proposal')
  })

  it('mantenimento: stabile è in banda; +0,30 propone di abbassare, senza avviso grasso del massa', () => {
    expect(evaluateRecalibration(withGoal(0.05, maintain, 2850)).status).toBe('inBand')
    const result = evaluateRecalibration(withGoal(0.3, maintain, 2850))
    expect(result).toMatchObject({ status: 'proposal', fatWarning: false, fastLossWarning: false })
  })

  it('la banda del cut segue il peso: a 100 kg −0,50 è il limite lento, −0,40 è fuori', () => {
    const heavy = (perWeek: number) => ({ ...withGoal(perWeek, cut, 2440), weightKg: 100 })
    expect(evaluateRecalibration(heavy(-0.5)).status).toBe('inBand')
    expect(evaluateRecalibration(heavy(-0.4)).status).toBe('proposal')
  })
})

describe('proposalWithinLimits (§7, ±5% e multipli di 10)', () => {
  it('2843: il tetto +5% è 2985,15, la proposta scende a 2980 (non 2990, che lo supera)', () => {
    expect(proposalWithinLimits(3500, 2843 * 0.95, 2843 * 1.05)).toBe(2980)
  })

  it('2843: il pavimento −5% è 2700,85, la proposta sale a 2710 (non 2700, che lo supera)', () => {
    expect(proposalWithinLimits(2000, 2843 * 0.95, 2843 * 1.05)).toBe(2710)
  })

  it('dentro i limiti si arrotonda normalmente al multiplo di 10 più vicino', () => {
    expect(proposalWithinLimits(2924, 2705.6, 2990.4)).toBe(2920)
    expect(proposalWithinLimits(2925, 2705.6, 2990.4)).toBe(2930)
  })

  it('una stima che arrotondata supererebbe il tetto resta dentro (2985,1 → 2980 con tetto 2985,15)', () => {
    expect(proposalWithinLimits(2985.1, 2700.85, 2985.15)).toBe(2980)
  })

  it('con 2848 i valori storici non cambiano: 2990 e 2710', () => {
    expect(proposalWithinLimits(9999, 2848 * 0.95, 2848 * 1.05)).toBe(2990)
    expect(proposalWithinLimits(0, 2848 * 0.95, 2848 * 1.05)).toBe(2710)
  })
})

describe('weeklyRowAction (una sola proposta a settimana)', () => {
  it('nessuna riga: si crea', () => {
    expect(weeklyRowAction(null, 'proposal')).toBe('create')
    expect(weeklyRowAction(null, 'inBand')).toBe('create')
    expect(weeklyRowAction(null, 'notEnoughData')).toBe('create')
  })

  it('riga "nessuna" di lunedì e ora c’è una proposta: la riga diventa in attesa (resta una sola)', () => {
    expect(weeklyRowAction('none', 'proposal')).toBe('promote')
  })

  it('riga "nessuna" senza proposta: non si tocca', () => {
    expect(weeklyRowAction('none', 'inBand')).toBe('keep')
    expect(weeklyRowAction('none', 'notEnoughData')).toBe('keep')
  })

  it('riga in attesa, accettata o rifiutata: mai riscritta', () => {
    for (const status of ['pending', 'accepted', 'rejected'] as const) {
      expect(weeklyRowAction(status, 'proposal')).toBe('keep')
      expect(weeklyRowAction(status, 'inBand')).toBe('keep')
    }
  })
})

describe('soglie esatte della finestra (§7)', () => {
  // Finestra di 25 giorni di uso: 20 su 25 sono esattamente l'80%.
  const window25 = (registered: number) => {
    const start = addDays(today, -25)
    return {
      ...input(0.1),
      firstUseDate: start,
      days: Array.from({ length: 25 }, (_, i) => ({ date: addDays(start, i), kcal: i < registered ? 3200 : 0, target: 3130 })),
      weights: Array.from({ length: 25 }, (_, i) => ({ date: addDays(start, i), kg: 75 + (0.1 / 7) * i })),
    }
  }

  it('80% dei giorni registrati: 20 su 25 bastano, 19 su 25 (76%) no', () => {
    expect(evaluateRecalibration(window25(20)).status).toBe('proposal')
    expect(evaluateRecalibration(window25(19)).status).toBe('notEnoughData')
  })

  it('10 pesate bastano, 9 no', () => {
    const ten = weightsWithSlope(0.1, 3)
    expect(ten).toHaveLength(10)
    expect(evaluateRecalibration({ ...input(0.1), weights: ten }).status).toBe('proposal')
    expect(evaluateRecalibration({ ...input(0.1), weights: ten.slice(0, 9) }).status).toBe('notEnoughData')
  })

  it('21 giorni di uso bastano, 20 no', () => {
    const start = (n: number) => addDays(today, -n)
    const forDays = (n: number) => ({
      ...input(0.1),
      firstUseDate: start(n),
      days: Array.from({ length: n }, (_, i) => ({ date: addDays(start(n), i), kcal: 3200, target: 3130 })),
      weights: Array.from({ length: n }, (_, i) => ({ date: addDays(start(n), i), kg: 75 + (0.1 / 7) * i })),
    })
    expect(evaluateRecalibration(forDays(21)).status).toBe('proposal')
    expect(evaluateRecalibration(forDays(20)).status).toBe('notEnoughData')
  })
})
