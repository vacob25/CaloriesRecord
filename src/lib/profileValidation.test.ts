import { describe, expect, it } from 'vitest'

import { validateParams, validatePersonal, validateWeight } from './profileValidation'

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
