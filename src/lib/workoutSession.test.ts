import { describe, expect, it } from 'vitest'

import { mergeExercise, type CatalogExercise } from './exercises'
import {
  addSet,
  appendExercise,
  buildSession,
  finishSession,
  formatClock,
  isoWeekday,
  lastKey,
  newExerciseFor,
  parseDoneReps,
  prefillSets,
  removeExercise,
  removeSet,
  restElapsedSeconds,
  sessionElapsedSeconds,
  setExerciseNote,
  setStatus,
  suggestDay,
  summarizeLast,
  summarizeSession,
  toggleSetDone,
  updateSet,
  type LastTime,
  type Session,
} from './workoutSession'
import type { PlanDay, PlanExercise } from './workoutPlans'

let counter = 0
const newId = () => `id${++counter}`
const catalog = (id: string, nameIt: string): CatalogExercise => ({ id, nameIt, nameEn: nameIt, nameNeedsReview: false, equipment: 'dumbbell', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'], category: 'strength', level: 'beginner' })
const item = (over: Partial<PlanExercise> = {}): PlanExercise => ({ id: 'pe1', dayId: 'd1', catalogId: 'c1', userExerciseId: null, position: 0, sets: 3, repsMin: 8, repsMax: 12, weightsKg: [], restSeconds: 90, note: '', ...over })
const day = (id: string, weekday: number | null, position: number): PlanDay => ({ id, planId: 'p', name: id, weekday, position })
const last = (sets: LastTime['sets']): LastTime => ({ date: '2026-10-19', sets })

describe('suggestDay / isoWeekday', () => {
  const days = [day('push', 1, 0), day('pull', null, 1), day('legs', null, 2)]
  it('il giorno con il giorno della settimana di oggi vince', () => {
    expect(suggestDay(days, 1, 'legs')).toBe('push')
  })
  it('altrimenti il successivo all’ultimo fatto, in giro', () => {
    expect(suggestDay(days, 3, 'push')).toBe('pull')
    expect(suggestDay(days, 3, 'legs')).toBe('push')
  })
  it('senza storico il primo; senza giorni niente', () => {
    expect(suggestDay(days, 3, null)).toBe('push')
    expect(suggestDay([], 3, null)).toBeNull()
  })
  it('giorno della settimana ISO di una data locale', () => {
    expect(isoWeekday('2026-10-19')).toBe(1) // lunedì
    expect(isoWeekday('2026-10-25')).toBe(7) // domenica, giorno del cambio d’ora
    expect(isoWeekday('2026-10-24')).toBe(6)
  })
})

describe('prefillSets', () => {
  it('senza ultima volta: pesi della scheda e ripetizioni minime', () => {
    const sets = prefillSets({ sets: 3, repsMin: 8, weightsKg: [60, null] }, undefined, newId)
    expect(sets.map((s) => [s.number, s.weightKg, s.reps, s.kind, s.done])).toEqual([[1, 60, 8, 'normal', false], [2, null, 8, 'normal', false], [3, null, 8, 'normal', false]])
  })
  it('con l’ultima volta: stessa serie, o l’ultima se ora sono di più; riscaldamenti esclusi', () => {
    const sets = prefillSets({ sets: 4, repsMin: 8, weightsKg: [50] }, last([{ number: 1, kind: 'warmup', weightKg: 20, reps: 12 }, { number: 2, kind: 'normal', weightKg: 60, reps: 8 }, { number: 3, kind: 'normal', weightKg: 62.5, reps: 6 }]), newId)
    expect(sets.map((s) => [s.weightKg, s.reps])).toEqual([[60, 8], [62.5, 6], [62.5, 6], [62.5, 6]])
  })
  it('gli id sono diversi tra loro', () => {
    const ids = prefillSets({ sets: 3, repsMin: 8, weightsKg: [] }, undefined, newId).map((s) => s.id)
    expect(new Set(ids).size).toBe(3)
  })
})

describe('summarizeLast', () => {
  it('uguali: 3×8 a 60 kg', () => {
    expect(summarizeLast(last([{ number: 1, kind: 'normal', weightKg: 60, reps: 8 }, { number: 2, kind: 'normal', weightKg: 60, reps: 8 }, { number: 3, kind: 'normal', weightKg: 60, reps: 8 }]))).toBe('3×8 a 60 kg')
  })
  it('diverse: elenco ripetizioni e intervallo di peso', () => {
    expect(summarizeLast(last([{ number: 1, kind: 'normal', weightKg: 60, reps: 8 }, { number: 2, kind: 'drop', weightKg: 62.5, reps: 6 }]))).toBe('2 serie (8/6) a 60–62,5 kg')
  })
  it('senza serie di lavoro: vuoto', () => {
    expect(summarizeLast(undefined)).toBe('')
    expect(summarizeLast(last([{ number: 1, kind: 'warmup', weightKg: 20, reps: 10 }]))).toBe('')
  })
})

describe('buildSession', () => {
  const exercises = [mergeExercise(catalog('c1', 'Panca piana con manubri'), null)]
  const input = { id: 's1', date: '2026-10-20', now: '2026-10-20T16:00:00.000Z', plan: { id: 'p', name: 'Push Pull' }, day: day('d1', 1, 0), exercises, last: new Map([[lastKey({ catalogId: 'c1', userExerciseId: null }), last([{ number: 1, kind: 'normal', weightKg: 60, reps: 8 }])]]) }
  it('copia nomi e istantanea dell’esercizio e precompila dall’ultima volta', () => {
    const s = buildSession({ ...input, items: [item(), item({ id: 'pe2', catalogId: 'sparito' })] }, newId)
    expect(s).toMatchObject({ id: 's1', date: '2026-10-20', endedAt: null, planName: 'Push Pull', dayName: 'd1' })
    expect(s.exercises).toHaveLength(1) // l’esercizio sparito è saltato
    expect(s.exercises[0]).toMatchObject({ name: 'Panca piana con manubri', equipment: 'dumbbell', primaryMuscles: ['chest'], status: 'todo', plannedSets: 3, plannedRepsMin: 8, plannedRepsMax: 12, plannedRestSeconds: 90 })
    expect(s.exercises[0]!.sets.map((x) => x.weightKg)).toEqual([60, 60, 60])
  })
  it('sessione libera: niente scheda e niente esercizi', () => {
    const s = buildSession({ ...input, plan: null, day: null, items: [] }, newId)
    expect(s).toMatchObject({ planId: null, dayId: null, planName: null, exercises: [] })
  })
})

describe('modifiche', () => {
  const base = (): Session => buildSession({ id: 's', date: '2026-10-20', now: '2026-10-20T16:00:00.000Z', plan: null, day: null, items: [item(), item({ id: 'pe2', catalogId: 'c2', sets: 2 })], exercises: [mergeExercise(catalog('c1', 'A'), null), mergeExercise(catalog('c2', 'B'), null)], last: new Map() }, newId)

  it('spuntare una serie la fa "fatta" con l’ora e porta l’esercizio a "fatto"', () => {
    const s = base()
    const setId = s.exercises[0]!.sets[0]!.id
    const next = toggleSetDone(s, setId, '2026-10-20T16:05:00.000Z')
    expect(next.exercises[0]!.sets[0]).toMatchObject({ done: true, completedAt: '2026-10-20T16:05:00.000Z' })
    expect(next.exercises[0]!.status).toBe('done')
    expect(s.exercises[0]!.sets[0]!.done).toBe(false) // l’originale non cambia
    const undone = toggleSetDone(next, setId, '2026-10-20T16:06:00.000Z')
    expect(undone.exercises[0]!.sets[0]).toMatchObject({ done: false, completedAt: null })
    expect(undone.exercises[0]!.status).toBe('done') // togliere la spunta non cambia lo stato
  })
  it('spuntare una serie di un esercizio saltato lo riporta a fatto', () => {
    const s0 = base()
    const skipped = setStatus(s0, s0.exercises[0]!.id, 'skipped')
    expect(skipped.exercises[0]!.status).toBe('skipped')
    expect(toggleSetDone(skipped, skipped.exercises[0]!.sets[0]!.id, '2026-10-20T16:05:00.000Z').exercises[0]!.status).toBe('done')
  })
  it('updateSet cambia solo quella serie', () => {
    const s = base()
    const next = updateSet(s, s.exercises[0]!.sets[1]!.id, { weightKg: 65, reps: 10, kind: 'drop' })
    expect(next.exercises[0]!.sets.map((x) => [x.weightKg, x.reps, x.kind])).toEqual([[null, 8, 'normal'], [65, 10, 'drop'], [null, 8, 'normal']])
  })
  it('addSet copia la serie precedente (un riscaldamento diventa normale) e si ferma a 50', () => {
    let s = updateSet(base(), base().exercises[0]!.sets[0]!.id, {})
    const e = s.exercises[0]!
    s = updateSet(s, e.sets[2]!.id, { weightKg: 70, reps: 5, kind: 'warmup' })
    s = addSet(s, e.id, newId)
    expect(s.exercises[0]!.sets[3]).toMatchObject({ number: 4, kind: 'normal', weightKg: 70, reps: 5, done: false })
    for (let i = 0; i < 60; i += 1) s = addSet(s, e.id, newId)
    expect(s.exercises[0]!.sets).toHaveLength(50)
  })
  it('removeSet rinumera', () => {
    const s = base()
    const next = removeSet(s, s.exercises[0]!.sets[0]!.id)
    expect(next.exercises[0]!.sets.map((x) => x.number)).toEqual([1, 2])
  })
  it('stato, nota, esercizio aggiunto e tolto', () => {
    let s = base()
    s = setStatus(s, s.exercises[1]!.id, 'skipped')
    s = setExerciseNote(s, s.exercises[0]!.id, 'dolore alla spalla')
    expect(s.exercises.map((e) => e.status)).toEqual(['todo', 'skipped'])
    expect(s.exercises[0]!.note).toBe('dolore alla spalla')
    const extra = newExerciseFor(mergeExercise(catalog('c3', 'C'), null), 0, undefined, newId)
    expect(extra.sets).toHaveLength(3)
    s = appendExercise(s, extra)
    expect(s.exercises.map((e) => e.position)).toEqual([0, 1, 2])
    s = removeExercise(s, s.exercises[0]!.id)
    expect(s.exercises.map((e) => [e.name, e.position])).toEqual([['B', 0], ['C', 1]])
  })
  it('un esercizio aggiunto riparte dalle serie dell’ultima volta', () => {
    const e = newExerciseFor(mergeExercise(catalog('c3', 'C'), null), 0, last([{ number: 1, kind: 'warmup', weightKg: 20, reps: 12 }, { number: 2, kind: 'normal', weightKg: 80, reps: 5 }, { number: 3, kind: 'normal', weightKg: 85, reps: 4 }]), newId)
    expect(e.sets.map((x) => [x.weightKg, x.reps])).toEqual([[80, 5], [85, 4]])
  })
  it('finishSession mette la fine una volta sola', () => {
    const s = finishSession(base(), '2026-10-20T17:00:00.000Z')
    expect(finishSession(s, '2026-10-20T18:00:00.000Z').endedAt).toBe('2026-10-20T17:00:00.000Z')
  })
})

describe('timer e riepilogo', () => {
  const s0 = buildSession({ id: 's', date: '2026-10-20', now: '2026-10-20T16:00:00.000Z', plan: null, day: null, items: [item({ sets: 2 })], exercises: [mergeExercise(catalog('c1', 'A'), null)], last: new Map() }, newId)
  it('il recupero parte dall’ultima serie spuntata e non esiste prima', () => {
    expect(restElapsedSeconds(s0, '2026-10-20T16:10:00.000Z')).toBeNull()
    const s1 = toggleSetDone(s0, s0.exercises[0]!.sets[0]!.id, '2026-10-20T16:05:00.000Z')
    expect(restElapsedSeconds(s1, '2026-10-20T16:06:05.000Z')).toBe(65)
    const s2 = toggleSetDone(s1, s1.exercises[0]!.sets[1]!.id, '2026-10-20T16:08:00.000Z')
    expect(restElapsedSeconds(s2, '2026-10-20T16:08:30.000Z')).toBe(30)
    expect(restElapsedSeconds(s2, '2026-10-20T16:00:00.000Z')).toBe(0) // orologio indietro: mai negativo
  })
  it('formatClock', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(-5)).toBe('0:00')
  })
  it('riepilogo: stati, serie di lavoro senza riscaldamenti, saltati e durata', () => {
    let s = buildSession({ id: 's', date: '2026-10-20', now: '2026-10-20T16:00:00.000Z', plan: null, day: null, items: [item({ sets: 2 }), item({ id: 'pe2', catalogId: 'c2', sets: 1 }), item({ id: 'pe3', catalogId: 'c3', sets: 1 })], exercises: [mergeExercise(catalog('c1', 'A'), null), mergeExercise(catalog('c2', 'B'), null), mergeExercise(catalog('c3', 'C'), null)], last: new Map() }, newId)
    s = updateSet(s, s.exercises[0]!.sets[0]!.id, { kind: 'warmup' })
    s = toggleSetDone(s, s.exercises[0]!.sets[0]!.id, '2026-10-20T16:02:00.000Z')
    s = toggleSetDone(s, s.exercises[0]!.sets[1]!.id, '2026-10-20T16:04:00.000Z')
    s = setStatus(s, s.exercises[1]!.id, 'skipped')
    expect(summarizeSession(s, '2026-10-20T16:50:30.000Z')).toEqual({ exercisesDone: 1, exercisesSkipped: 1, exercisesTodo: 1, workSets: 1, warmupSets: 1, skippedNames: ['B'], minutes: 50 })
    expect(summarizeSession(finishSession(s, '2026-10-20T17:30:00.000Z'), '2026-10-21T00:00:00.000Z').minutes).toBe(90)
  })
})

describe('sessionElapsedSeconds', () => {
  it('dall\u2019inizio a adesso, o alla fine se è finita; mai negativo', () => {
    const s = buildSession({ id: 's', date: '2026-10-20', now: '2026-10-20T16:00:00.000Z', plan: null, day: null, items: [], exercises: [], last: new Map() }, newId)
    expect(sessionElapsedSeconds(s, '2026-10-20T16:01:05.900Z')).toBe(65)
    expect(sessionElapsedSeconds(finishSession(s, '2026-10-20T17:00:00.000Z'), '2026-10-21T00:00:00.000Z')).toBe(3600)
    expect(sessionElapsedSeconds(s, '2026-10-20T15:00:00.000Z')).toBe(0)
  })
})

describe('parseDoneReps', () => {
  it('intero 0-200, vuoto = non impostate', () => {
    expect(parseDoneReps('8')).toEqual({ ok: true, value: 8 })
    expect(parseDoneReps('0')).toEqual({ ok: true, value: 0 })
    expect(parseDoneReps(' ')).toEqual({ ok: true, value: null })
    for (const bad of ['201', '-1', '8,5', 'abc', '1000']) expect(parseDoneReps(bad)).toMatchObject({ ok: false })
  })
})
