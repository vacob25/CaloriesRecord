import { describe, expect, it } from 'vitest'

import { validateParams, validatePersonal, validatePlan, validateWeight } from './profileValidation'

const today = '2026-10-08'
const personal = { sex: 'male' as const, birthDate: '2006-01-15', heightCm: '180', weightKg: '75', goalWeightKg: '' }

describe('validateWeight (TESTING.md)', () => {
  it.each(['29,9', '250,1', '', 'x'])('"%s" → errore', (input) => {
    expect(validateWeight(input).ok).toBe(false)
  })
  it('75,25 → 75,3', () => {
    expect(validateWeight('75,25')).toEqual({ ok: true, value: 75.3 })
  })
})

describe('validatePersonal (§10)', () => {
  it('dati validi', () => {
    expect(validatePersonal(personal, today)).toEqual({
      ok: true,
      value: { sex: 'male', birthDate: '2006-01-15', heightCm: 180, weightKg: 75, goalWeightKg: null },
    })
  })

  it('sesso mancante, altezza fuori limite, peso obiettivo fuori limite', () => {
    const result = validatePersonal({ ...personal, sex: '', heightCm: '99', goalWeightKg: '300' }, today)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['goalWeightKg', 'heightCm', 'sex'])
  })

  it('età fuori 14-100 o data futura', () => {
    expect(validatePersonal({ ...personal, birthDate: '2013-01-01' }, today).ok).toBe(false)
    expect(validatePersonal({ ...personal, birthDate: '1925-01-01' }, today).ok).toBe(false)
    expect(validatePersonal({ ...personal, birthDate: '2027-01-01' }, today).ok).toBe(false)
    expect(validatePersonal({ ...personal, birthDate: '2012-10-08' }, today).ok).toBe(true)
  })

  it('peso non richiesto fuori dalla prima apertura', () => {
    const { weightKg: _ignored, ...withoutWeight } = personal
    expect(validatePersonal(withoutWeight, today)).toMatchObject({ ok: true, value: { weightKg: null } })
  })
})

describe('validateParams', () => {
  const params = { activityFactor: '1,6', surplusPct: '10', trainingBonusKcal: '200', proteinGPerKg: '2', fatGPerKg: '1' }

  it('valori di default; il surplus in % diventa frazione', () => {
    expect(validateParams(params)).toEqual({
      ok: true,
      value: { activityFactor: 1.6, surplusPct: 0.1, trainingBonusKcal: 200, proteinGPerKg: 2, fatGPerKg: 1 },
      warnings: [],
    })
  })

  it('surplus oltre il 20%: avviso, non errore (§2)', () => {
    const result = validateParams({ ...params, surplusPct: '25' })
    expect(result.ok && result.warnings.length).toBe(1)
  })

  it('fattore 0, negativi, bonus non intero → errori', () => {
    const result = validateParams({ ...params, activityFactor: '0', fatGPerKg: '-1', trainingBonusKcal: '150,5' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['activityFactor', 'fatGPerKg', 'trainingBonusKcal'])
  })
})

describe('validatePlan (step 19)', () => {
  const base = { goal: 'bulk' as const, cutRatePct: 0.005, sports: ['Palestra'], activityLevel: 'light' as const }
  it('massa con livello di attività: fattore 1,375, sport puliti', () => {
    expect(validatePlan({ ...base, sports: ['  palestra '] }, { weightKg: 75, goalWeightKg: null }, true)).toEqual({
      ok: true,
      value: { plan: { goal: 'bulk', cutRatePct: 0.005, sports: ['Palestra'] }, activityFactor: 1.375 },
    })
  })
  it('obiettivo e livello di attività obbligatori al Benvenuto, non nel Profilo', () => {
    const result = validatePlan({ ...base, goal: '', activityLevel: '' }, { weightKg: 75, goalWeightKg: null }, true)
    expect(result).toEqual({ ok: false, errors: { goal: 'Scegli il tuo obiettivo.', activityLevel: 'Scegli quanto sei attivo: serve a stimare il tuo metabolismo.' } })
    expect(validatePlan({ ...base, activityLevel: '' }, { weightKg: 75, goalWeightKg: null }, false)).toMatchObject({ ok: true, value: { activityFactor: null } })
  })
  it('cut: serve un peso obiettivo più basso di quello di oggi', () => {
    const cut = { ...base, goal: 'cut' as const }
    expect(validatePlan(cut, { weightKg: 75, goalWeightKg: null }, true)).toMatchObject({ ok: false, errors: { goalWeightKg: expect.stringContaining('scrivi il peso') } })
    expect(validatePlan(cut, { weightKg: 75, goalWeightKg: 80 }, true)).toMatchObject({ ok: false, errors: { goalWeightKg: expect.stringContaining('più basso') } })
    expect(validatePlan(cut, { weightKg: 75, goalWeightKg: 70 }, true)).toMatchObject({ ok: true })
  })
  it('ritmo del cut fuori dai tre ammessi: si torna al graduale', () => {
    const result = validatePlan({ ...base, goal: 'cut', cutRatePct: 0.5 }, { weightKg: 75, goalWeightKg: 70 }, true)
    expect(result).toMatchObject({ ok: true, value: { plan: { cutRatePct: 0.005 } } })
  })
})
