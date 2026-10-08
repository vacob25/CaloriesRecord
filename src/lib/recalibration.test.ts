import { describe, expect, it } from 'vitest'

import { addDays } from './dates'
import { acceptedActivityFactor, evaluateRecalibration, isRegisteredDay, type RecalDay } from './recalibration'

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
  surplusPct: 0.1,
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
