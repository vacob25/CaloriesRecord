import { describe, expect, it } from 'vitest'

import { EQUIPMENT_KEYS, EQUIPMENT_LABEL, MUSCLE_KEYS, MUSCLE_LABEL } from '../../src/lib/exercises'
// @ts-expect-error: modulo .mjs senza tipi (è uno script, non fa parte dell'app)
import { EQUIPMENT, applyOverride, excludeReason, mapEquipment, mapMuscles, MUSCLE_MAP, MUSCLES, translateName } from './lib.mjs'

describe('vocabolari uguali tra script e app', () => {
  it('muscoli e attrezzi coincidono (chiavi ed etichette)', () => {
    expect(Object.keys(MUSCLES)).toEqual(MUSCLE_KEYS)
    expect(MUSCLES).toEqual(MUSCLE_LABEL)
    expect(Object.keys(EQUIPMENT)).toEqual(EQUIPMENT_KEYS)
    expect(EQUIPMENT).toEqual(EQUIPMENT_LABEL)
  })
})

describe('mapMuscles', () => {
  it('ogni valore della fonte ha una regola esplicita', () => {
    expect(Object.keys(MUSCLE_MAP)).toHaveLength(17)
    expect(mapMuscles(['middle back', 'lower back', 'abdominals'])).toEqual(['upper_back', 'lower_back', 'abdominals'])
  })
  it('un valore sconosciuto ferma l’importazione', () => {
    expect(() => mapMuscles(['elbows'])).toThrow(/sconosciuto/)
  })
})

describe('excludeReason e mapEquipment', () => {
  it('scarta stretching, cardio, strongman e foam roll; tiene il resto', () => {
    expect(excludeReason({ category: 'stretching', equipment: 'body only' })).toMatch(/stretching/)
    expect(excludeReason({ category: 'cardio' })).toMatch(/cardio/)
    expect(excludeReason({ category: 'strongman' })).toMatch(/strongman/)
    expect(excludeReason({ category: 'strength', equipment: 'foam roll' })).toMatch(/foam/)
    expect(excludeReason({ category: 'strength', equipment: 'barbell' })).toBeNull()
    expect(excludeReason({ category: 'plyometrics', equipment: 'body only' })).toBeNull()
  })
  it('attrezzi diretti e dedotti dal nome', () => {
    expect(mapEquipment({ name: 'Curl', equipment: 'e-z curl bar' })).toEqual({ key: 'ez_bar', inferred: false })
    expect(mapEquipment({ name: 'Plate Twist', equipment: 'other' })).toEqual({ key: 'plate', inferred: true })
    expect(mapEquipment({ name: 'Muscle Up', equipment: 'other' })).toEqual({ key: 'bodyweight', inferred: true })
    expect(mapEquipment({ name: 'Inverted Row', equipment: null })).toEqual({ key: 'bodyweight', inferred: true })
    expect(mapEquipment({ name: 'Boh', equipment: 'other' })).toEqual({ key: 'other', inferred: true })
  })
})

describe('translateName', () => {
  const it_ = (name: string) => translateName(name).it
  it('attrezzo in coda, posizione dopo il nome, termini di palestra in inglese', () => {
    expect(it_('Dumbbell Bench Press')).toBe('Panca piana con manubri')
    expect(it_('Incline Dumbbell Press')).toBe('Press su panca inclinata con manubri')
    expect(it_('Barbell Incline Bench Press - Medium Grip')).toBe('Panca inclinata presa media con bilanciere')
    expect(it_('Standing Dumbbell Calf Raise')).toBe('Calf raise in piedi con manubri')
    expect(it_('Smith Machine Bent Over Row')).toBe('Rematore da busto flesso al Multipower')
    expect(it_('Dumbbell One-Arm Shoulder Press')).toBe('Shoulder press a un braccio con manubri')
    expect(it_('Lat Pulldown')).toBe('Lat machine')
    expect(it_('Wide-Grip Lat Pulldown')).toBe('Lat machine presa larga')
  })
  it('un curl non ripete i bicipiti', () => {
    expect(it_('Dumbbell Bicep Curl')).toBe('Curl con manubri')
  })
  it('nomi con parole sconosciute restano riconoscibili e vanno "da rivedere"', () => {
    const r = translateName('Spell Caster')
    expect(r).toMatchObject({ it: 'Spell Caster', review: true, unknown: ['spell', 'caster'] })
    expect(translateName('Dumbbell Bench Press').review).toBe(false)
  })
  it('non inventa: nome vuoto o solo articoli torna com’era e va da rivedere', () => {
    expect(translateName('The').review).toBe(true)
    expect(translateName('The').it).toBe('The')
  })
})

describe('applyOverride', () => {
  const row = { primary: ['hamstrings'], secondary: ['calves', 'glutes', 'quadriceps'], equipment: 'barbell' }
  it('nuovo principale: il vecchio principale e i secondari restano secondari, senza doppioni', () => {
    const out = applyOverride(row, { primary: 'glutes', secondaryFirst: ['hamstrings', 'quadriceps', 'traps'] })
    expect(out.primary).toEqual(['glutes'])
    expect(out.secondary).toEqual(['hamstrings', 'quadriceps', 'traps', 'calves'])
    expect(out.equipment).toBe('barbell')
  })
  it('solo attrezzo: i muscoli non cambiano', () => {
    expect(applyOverride(row, { equipment: 'ez_bar' })).toEqual({ ...row, equipment: 'ez_bar' })
  })
  it('senza correzione restituisce la riga com\u2019è', () => {
    expect(applyOverride(row, undefined)).toBe(row)
  })
})
