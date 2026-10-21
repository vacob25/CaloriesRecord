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
  addSet,
  effectiveReps,
  parseRepsCount,
  removeSet,
  setRepsAt,
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
  it('effectiveReps: una per serie, dove manca vale repsMin', () => {
    expect(effectiveReps({ sets: 3, repsMin: 10, repsPerSet: [] })).toEqual([10, 10, 10])
    expect(effectiveReps({ sets: 3, repsMin: 8, repsPerSet: [12, null] })).toEqual([12, 8, 8])
    expect(effectiveReps({ sets: 2, repsMin: 8, repsPerSet: [12, 10, 9] })).toEqual([12, 10])
  })
  it('parseRepsCount: solo interi da 1 a 100', () => {
    expect(parseRepsCount(' 12 ')).toEqual({ ok: true, value: 12 })
    for (const bad of ['', '0', '101', '8-12', '1,5', 'abc']) expect(parseRepsCount(bad).ok).toBe(false)
  })
  it('setRepsAt tiene repsMin/repsMax allineati al minimo e al massimo', () => {
    const base = { sets: 3, repsMin: 10, repsPerSet: [10, 10, 10], weightsKg: [60] }
    expect(setRepsAt(base, 0, 12)).toEqual({ sets: 3, repsPerSet: [12, 10, 10], repsMin: 10, repsMax: 12, weightsKg: [60] })
    expect(setRepsAt({ ...base, repsPerSet: [12, 10, 10] }, 0, 10)).toMatchObject({ repsMin: 10, repsMax: null })
    expect(setRepsAt(base, 7, 5).repsPerSet).toEqual([10, 10, 10]) // serie che non esiste
  })
  it('addSet copia ripetizioni e peso dell’ultima serie, fino a 20', () => {
    expect(addSet({ sets: 2, repsMin: 8, repsPerSet: [10, 8], weightsKg: [60, 62.5] })).toEqual({ sets: 3, repsPerSet: [10, 8, 8], repsMin: 8, repsMax: 10, weightsKg: [60, 62.5, 62.5] })
    expect(addSet({ sets: 1, repsMin: 10, repsPerSet: [], weightsKg: [] })).toMatchObject({ sets: 2, repsPerSet: [10, 10], weightsKg: [] })
    expect(addSet({ sets: 20, repsMin: 10, repsPerSet: [], weightsKg: [] }).sets).toBe(20)
  })
  it('removeSet toglie proprio quella serie (ripetizioni e peso) e ne lascia almeno una', () => {
    expect(removeSet({ sets: 3, repsMin: 8, repsPerSet: [12, 10, 8], weightsKg: [60, 62.5, 65] }, 1)).toEqual({ sets: 2, repsPerSet: [12, 8], repsMin: 8, repsMax: 12, weightsKg: [60, 65] })
    expect(removeSet({ sets: 3, repsMin: 8, repsPerSet: [8, 8, 8], weightsKg: [60, null, null] }, 0).weightsKg).toEqual([])
    expect(removeSet({ sets: 1, repsMin: 8, repsPerSet: [8], weightsKg: [60] }, 0).sets).toBe(1)
  })
  it('setWeightAt riempie con null e accorcia in coda', () => {
    expect(setWeightAt([], 1, 60, 3)).toEqual([null, 60])
    expect(setWeightAt([null, 60], 1, null, 3)).toEqual([])
    expect(setWeightAt([60, 60], 0, 65, 3)).toEqual([65, 60])
    expect(setWeightAt([60], 5, 70, 3)).toEqual([60]) // serie 6 di 3: non esiste
  })
  it('describeSets: 3×10 se uguali, elenco se cambiano; con il peso (uguale o a intervallo)', () => {
    expect(describeSets({ sets: 3, repsMin: 10, repsPerSet: [], weightsKg: [] })).toBe('3×10')
    expect(describeSets({ sets: 3, repsMin: 8, repsPerSet: [8, 8, 8], weightsKg: [60, 60, 60] })).toBe('3×8 · 60 kg')
    expect(describeSets({ sets: 3, repsMin: 8, repsPerSet: [12, 10, 8], weightsKg: [60, null, 62.5] })).toBe('12/10/8 · 60–62,5 kg')
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
