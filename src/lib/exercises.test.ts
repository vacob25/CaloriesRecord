import { describe, expect, it } from 'vitest'

import {
  buildExerciseList,
  catalogKey,
  editPatch,
  EQUIPMENT_KEYS,
  filterExercises,
  mergeExercise,
  MUSCLE_KEYS,
  userKey,
  validateExerciseName,
  validateMuscles,
  type CatalogExercise,
  type UserExercise,
} from './exercises'

const catalog = (over: Partial<CatalogExercise> = {}): CatalogExercise => ({
  id: 'c1',
  nameIt: 'Panca piana con manubri',
  nameEn: 'Dumbbell Bench Press',
  nameNeedsReview: false,
  equipment: 'dumbbell',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps', 'shoulders'],
  category: 'strength',
  level: 'beginner',
  ...over,
})
const personal = (over: Partial<UserExercise> = {}): UserExercise => ({
  id: 'p1',
  catalogId: 'c1',
  name: null,
  equipment: null,
  primaryMuscles: null,
  secondaryMuscles: null,
  notes: null,
  isHidden: false,
  ...over,
})

describe('mergeExercise', () => {
  it('senza copia personale usa il catalogo', () => {
    const e = mergeExercise(catalog(), null)
    expect(e).toMatchObject({ key: catalogKey('c1'), name: 'Panca piana con manubri', isCustom: false, isEdited: false, isHidden: false, notes: '' })
    expect(e.userExerciseId).toBeNull()
  })

  it('i campi nulli della copia personale valgono "come nel catalogo"', () => {
    const e = mergeExercise(catalog(), personal({ notes: 'Spalle indietro' }))
    expect(e.key).toBe(userKey('p1'))
    expect(e.name).toBe('Panca piana con manubri')
    expect(e.primaryMuscles).toEqual(['chest'])
    expect(e.notes).toBe('Spalle indietro')
    expect(e.isEdited).toBe(true) // c'è una nota
  })

  it('i campi cambiati dall’utente vincono e tengono il nome originale per "Ripristina"', () => {
    const e = mergeExercise(catalog(), personal({ name: 'Panca con manubri (mia)', equipment: 'machine', primaryMuscles: ['triceps'] }))
    expect(e).toMatchObject({ name: 'Panca con manubri (mia)', catalogName: 'Panca piana con manubri', equipment: 'machine', isEdited: true })
    expect(e.primaryMuscles).toEqual(['triceps'])
    expect(e.secondaryMuscles).toEqual(['triceps', 'shoulders']) // non toccato
  })

  it('solo nascondere non conta come modifica', () => {
    const e = mergeExercise(catalog(), personal({ isHidden: true }))
    expect(e.isHidden).toBe(true)
    expect(e.isEdited).toBe(false)
  })

  it('"da rivedere" sparisce quando l’utente sceglie il nome', () => {
    expect(mergeExercise(catalog({ nameNeedsReview: true }), null).nameNeedsReview).toBe(true)
    expect(mergeExercise(catalog({ nameNeedsReview: true }), personal({ notes: 'x' })).nameNeedsReview).toBe(true)
    expect(mergeExercise(catalog({ nameNeedsReview: true }), personal({ name: 'Mio nome' })).nameNeedsReview).toBe(false)
  })

  it('un esercizio creato dall’utente non ha catalogo', () => {
    const e = mergeExercise(null, personal({ catalogId: null, name: 'Mio esercizio', equipment: 'cable', primaryMuscles: ['lats'] }))
    expect(e).toMatchObject({ isCustom: true, catalogName: null, name: 'Mio esercizio', equipment: 'cable', catalogId: null })
  })

  it('senza né catalogo né copia dà errore', () => {
    expect(() => mergeExercise(null, null)).toThrow()
  })
})

describe('buildExerciseList', () => {
  it('unisce catalogo e copie, aggiunge i propri esercizi e ordina per nome', () => {
    const list = buildExerciseList(
      [catalog({ id: 'c1', nameIt: 'Squat' }), catalog({ id: 'c2', nameIt: 'Affondi' })],
      [personal({ catalogId: 'c1', name: 'Zeta squat' }), personal({ id: 'p2', catalogId: null, name: 'Bis', equipment: 'other', primaryMuscles: ['abs' as never] })],
    )
    expect(list.map((e) => e.name)).toEqual(['Affondi', 'Bis', 'Zeta squat'])
  })
})

describe('filterExercises', () => {
  const list = buildExerciseList(
    [
      catalog({ id: 'a', nameIt: 'Curl con manubri', nameEn: 'Dumbbell Curl', equipment: 'dumbbell', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'] }),
      catalog({ id: 'b', nameIt: 'Lat machine', nameEn: 'Lat Pulldown', equipment: 'cable', primaryMuscles: ['lats'], secondaryMuscles: ['biceps'] }),
      catalog({ id: 'c', nameIt: 'Panca piana', nameEn: 'Bench Press', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [] }),
    ],
    [personal({ catalogId: 'c', isHidden: true })],
  )
  const none = { query: '', muscle: null, equipment: null, showHidden: false } as const

  it('nasconde gli esercizi nascosti, salvo richiesta', () => {
    expect(filterExercises(list, none).map((e) => e.name)).toEqual(['Curl con manubri', 'Lat machine'])
    expect(filterExercises(list, { ...none, showHidden: true })).toHaveLength(3)
  })

  it('cerca ignorando maiuscole e accenti, anche col nome inglese originale', () => {
    expect(filterExercises(list, { ...none, query: 'CURL' }).map((e) => e.name)).toEqual(['Curl con manubri'])
    expect(filterExercises(list, { ...none, query: 'lat pull' }).map((e) => e.name)).toEqual(['Lat machine'])
    expect(filterExercises(list, { ...none, query: 'curl manubri' })).toHaveLength(1)
    expect(filterExercises(list, { ...none, query: 'xyz' })).toHaveLength(0)
  })

  it('filtra per gruppo (primario o secondario) e per attrezzo', () => {
    expect(filterExercises(list, { ...none, muscle: 'biceps' }).map((e) => e.name)).toEqual(['Curl con manubri', 'Lat machine'])
    expect(filterExercises(list, { ...none, muscle: 'lats', equipment: 'cable' }).map((e) => e.name)).toEqual(['Lat machine'])
    expect(filterExercises(list, { ...none, equipment: 'barbell' })).toHaveLength(0) // Panca piana è nascosta
  })
})

describe('validateExerciseName', () => {
  const list = buildExerciseList([catalog({ id: 'a', nameIt: 'Curl con manubri' })], [])
  it('rifiuta vuoto, troppo lungo e doppioni (ignorando accenti e maiuscole)', () => {
    expect(validateExerciseName('   ', list)).toMatchObject({ ok: false })
    expect(validateExerciseName('x'.repeat(81), list)).toMatchObject({ ok: false })
    expect(validateExerciseName('  CURL  con   manubri ', list)).toMatchObject({ ok: false })
  })
  it('accetta un nome nuovo ripulito e lo stesso nome dell’esercizio che si sta modificando', () => {
    expect(validateExerciseName('  Curl   inclinato ', list)).toEqual({ ok: true, value: 'Curl inclinato' })
    expect(validateExerciseName('Curl con manubri', list, list[0]!.key)).toEqual({ ok: true, value: 'Curl con manubri' })
  })
})

describe('validateMuscles e vocabolari', () => {
  it('serve almeno un muscolo primario', () => {
    expect(validateMuscles([])).toMatchObject({ ok: false })
    expect(validateMuscles(['chest'])).toEqual({ ok: true })
  })
  it('17 muscoli e 11 attrezzi, come nel database', () => {
    expect(MUSCLE_KEYS).toHaveLength(17)
    expect(EQUIPMENT_KEYS).toHaveLength(11)
  })
})

describe('editPatch', () => {
  const base = mergeExercise(catalog(), null)
  const values = { name: 'Panca piana con manubri', equipment: 'dumbbell' as const, primaryMuscles: ['chest' as const], secondaryMuscles: ['triceps' as const, 'shoulders' as const] }

  it('salva solo i campi diversi dal catalogo', () => {
    expect(editPatch(base, values)).toEqual({ name: null, equipment: null, primaryMuscles: null, secondaryMuscles: null })
    expect(editPatch(base, { ...values, name: 'Mia panca' })).toEqual({ name: 'Mia panca', equipment: null, primaryMuscles: null, secondaryMuscles: null })
    expect(editPatch(base, { ...values, equipment: 'machine', primaryMuscles: ['chest', 'triceps'] })).toMatchObject({
      equipment: 'machine',
      primaryMuscles: ['chest', 'triceps'],
      secondaryMuscles: null,
    })
  })

  it('per un esercizio creato dall’utente salva tutto', () => {
    const custom = mergeExercise(null, personal({ catalogId: null, name: 'Mio', equipment: 'cable', primaryMuscles: ['lats'] }))
    expect(editPatch(custom, { ...values, name: 'Mio 2' })).toEqual({ ...values, name: 'Mio 2' })
  })
})
