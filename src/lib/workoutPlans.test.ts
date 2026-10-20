import { describe, expect, it } from 'vitest'

import { mergeExercise, type CatalogExercise, type Exercise, type UserExercise } from './exercises'
import {
  defaultDayNames,
  describeSets,
  formatReps,
  formatRest,
  groupByMuscle,
  moveById,
  parseReps,
  parseRest,
  parseWeight,
  resolveExercise,
  setWeightAt,
  validateDayName,
  validatePlanName,
  weekdayLabel,
  withSets,
} from './workoutPlans'

describe('nomi', () => {
  it('scheda e giorno: ripuliti, non vuoti, con un massimo', () => {
    expect(validatePlanName('  Push   Pull  ')).toEqual({ ok: true, value: 'Push Pull' })
    expect(validatePlanName('   ')).toMatchObject({ ok: false })
    expect(validatePlanName('x'.repeat(81))).toMatchObject({ ok: false })
    expect(validateDayName('x'.repeat(40))).toEqual({ ok: true, value: 'x'.repeat(40) })
    expect(validateDayName('x'.repeat(41))).toMatchObject({ ok: false })
  })
  it('nomi di partenza e giorni della settimana', () => {
    expect(defaultDayNames(3)).toEqual(['Giorno 1', 'Giorno 2', 'Giorno 3'])
    expect(weekdayLabel(1)).toBe('Lunedì')
    expect(weekdayLabel(7)).toBe('Domenica')
  })
})

describe('parseReps', () => {
  it('un numero o un intervallo', () => {
    expect(parseReps('10')).toEqual({ ok: true, min: 10, max: null })
    expect(parseReps('8-12')).toEqual({ ok: true, min: 8, max: 12 })
    expect(parseReps(' 8 – 12 ')).toEqual({ ok: true, min: 8, max: 12 })
    expect(parseReps('10-10')).toEqual({ ok: true, min: 10, max: null })
  })
  it('rifiuta il resto', () => {
    for (const bad of ['', 'abc', '0', '101', '12-8', '8-', '-8', '8-12-15', '1,5']) expect(parseReps(bad)).toMatchObject({ ok: false })
  })
  it('formatta con il trattino lungo', () => {
    expect(formatReps(10, null)).toBe('10')
    expect(formatReps(8, 12)).toBe('8–12')
  })
})

describe('parseWeight', () => {
  it('virgola o punto, un decimale, vuoto = non impostato', () => {
    expect(parseWeight('62,5')).toEqual({ ok: true, value: 62.5 })
    expect(parseWeight('62.54')).toEqual({ ok: true, value: 62.5 })
    expect(parseWeight('0')).toEqual({ ok: true, value: 0 })
    expect(parseWeight('')).toEqual({ ok: true, value: null })
  })
  it('rifiuta negativi, troppo grandi e testo', () => {
    for (const bad of ['-1', '1001', 'abc']) expect(parseWeight(bad)).toMatchObject({ ok: false })
  })
})

describe('recupero', () => {
  it('secondi o mm:ss, vuoto = nessuno', () => {
    expect(parseRest('90')).toEqual({ ok: true, value: 90 })
    expect(parseRest('1:30')).toEqual({ ok: true, value: 90 })
    expect(parseRest('')).toEqual({ ok: true, value: null })
    expect(formatRest(90)).toBe('1:30')
    expect(formatRest(5)).toBe('0:05')
    expect(formatRest(null)).toBe('')
  })
  it('fuori dai limiti o in un formato strano è rifiutato', () => {
    for (const bad of ['4', '1801', '1:75', 'abc', '1:3', '-5']) expect(parseRest(bad)).toMatchObject({ ok: false })
  })
})

describe('serie e pesi', () => {
  it('withSets tiene il numero dentro 1-20 e toglie i pesi delle serie tolte', () => {
    expect(withSets({ weightsKg: [60, 62.5, 65] }, 2)).toEqual({ sets: 2, weightsKg: [60, 62.5] })
    expect(withSets({ weightsKg: [] }, 0).sets).toBe(1)
    expect(withSets({ weightsKg: [] }, 99).sets).toBe(20)
    expect(withSets({ weightsKg: [60] }, 5)).toEqual({ sets: 5, weightsKg: [60] })
    expect(withSets({ weightsKg: [60, null, 62] }, 2)).toEqual({ sets: 2, weightsKg: [60] }) // niente null in coda
  })
  it('setWeightAt riempie con null e accorcia in coda', () => {
    expect(setWeightAt([], 1, 60, 3)).toEqual([null, 60])
    expect(setWeightAt([null, 60], 1, null, 3)).toEqual([])
    expect(setWeightAt([60, 60], 0, 65, 3)).toEqual([65, 60])
    expect(setWeightAt([60], 5, 70, 3)).toEqual([60]) // serie 6 di 3: non esiste
  })
  it('describeSets: solo serie×ripetizioni, o con il peso (uguale o a intervallo)', () => {
    expect(describeSets({ sets: 3, repsMin: 10, repsMax: null, weightsKg: [] })).toBe('3×10')
    expect(describeSets({ sets: 3, repsMin: 8, repsMax: 12, weightsKg: [60, 60, 60] })).toBe('3×8–12 · 60 kg')
    expect(describeSets({ sets: 3, repsMin: 8, repsMax: null, weightsKg: [60, null, 62.5] })).toBe('3×8 · 60–62,5 kg')
  })
})

describe('moveById', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('sposta di un posto e non esce dai bordi', () => {
    expect(moveById(list, 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(moveById(list, 'b', 1).map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(moveById(list, 'a', -1).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(moveById(list, 'c', 1).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(moveById(list, 'zz', 1)).toHaveLength(3)
  })
})

const catalog = (id: string, over: Partial<CatalogExercise> = {}): CatalogExercise => ({
  id,
  nameIt: id,
  nameEn: id,
  nameNeedsReview: false,
  equipment: 'dumbbell',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  category: 'strength',
  level: 'beginner',
  ...over,
})
const own = (id: string, over: Partial<UserExercise> = {}): UserExercise => ({
  id,
  catalogId: null,
  name: id,
  equipment: 'cable',
  primaryMuscles: ['lats'],
  secondaryMuscles: null,
  notes: null,
  isHidden: false,
  ...over,
})

describe('groupByMuscle e resolveExercise', () => {
  const list: Exercise[] = [
    mergeExercise(catalog('c1'), null),
    mergeExercise(catalog('c2', { primaryMuscles: ['quadriceps', 'glutes'] }), null),
    mergeExercise(catalog('c3'), null),
    mergeExercise(null, own('u1')),
  ]
  it('ogni esercizio sta sotto il suo primo gruppo principale, nell’ordine del vocabolario', () => {
    const groups = groupByMuscle(list)
    expect(groups.map((g) => g.muscle)).toEqual(['chest', 'lats', 'quadriceps'])
    expect(groups[0]!.exercises.map((e) => e.name)).toEqual(['c1', 'c3'])
    expect(groups.flatMap((g) => g.exercises)).toHaveLength(4) // nessun doppione
  })
  it('trova l’esercizio effettivo di una riga di scheda, anche se è stato rinominato', () => {
    const renamed: Exercise[] = [mergeExercise(catalog('c1'), { id: 'p1', catalogId: 'c1', name: 'Nome mio', equipment: null, primaryMuscles: null, secondaryMuscles: null, notes: null, isHidden: false })]
    expect(resolveExercise({ catalogId: 'c1', userExerciseId: null }, renamed)?.name).toBe('Nome mio')
    expect(resolveExercise({ catalogId: null, userExerciseId: 'u1' }, list)?.name).toBe('u1')
    expect(resolveExercise({ catalogId: 'zz', userExerciseId: null }, list)).toBeUndefined()
  })
})
