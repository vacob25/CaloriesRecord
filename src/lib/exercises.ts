import { normalizeText } from './search'

// Libreria esercizi (Fase 3, ADR-089). Qui solo logica pura: unire catalogo e copia personale, cercare, filtrare, validare.

export const MUSCLE_LABEL = {
  chest: 'Petto',
  lats: 'Dorsali',
  upper_back: 'Parte alta della schiena',
  lower_back: 'Lombari',
  traps: 'Trapezi',
  shoulders: 'Spalle',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  abdominals: 'Addominali',
  glutes: 'Glutei',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  calves: 'Polpacci',
  adductors: 'Adduttori',
  abductors: 'Abduttori',
  neck: 'Collo',
} as const

export const EQUIPMENT_LABEL = {
  barbell: 'Bilanciere',
  ez_bar: 'Bilanciere EZ',
  dumbbell: 'Manubri',
  cable: 'Cavi',
  machine: 'Macchina',
  kettlebell: 'Kettlebell',
  bodyweight: 'Corpo libero',
  bands: 'Elastici',
  ball: 'Palla',
  plate: 'Disco',
  other: 'Altro',
} as const

export type MuscleKey = keyof typeof MUSCLE_LABEL
export type EquipmentKey = keyof typeof EQUIPMENT_LABEL

export const MUSCLE_KEYS = Object.keys(MUSCLE_LABEL) as MuscleKey[]
export const EQUIPMENT_KEYS = Object.keys(EQUIPMENT_LABEL) as EquipmentKey[]

export const EXERCISE_NAME_MAX = 80
export const EXERCISE_NOTES_MAX = 2000

/** Riga del catalogo globale (sola lettura). */
export interface CatalogExercise {
  id: string
  nameIt: string
  nameEn: string
  nameNeedsReview: boolean
  equipment: EquipmentKey
  primaryMuscles: MuscleKey[]
  secondaryMuscles: MuscleKey[]
  category: string
  level: string
}

/** Riga personale: un esercizio creato dall'utente (catalogId null) o la copia personale di uno del catalogo (campi null = come nel catalogo). */
export interface UserExercise {
  id: string
  catalogId: string | null
  name: string | null
  equipment: EquipmentKey | null
  primaryMuscles: MuscleKey[] | null
  secondaryMuscles: MuscleKey[] | null
  notes: string | null
  isHidden: boolean
}

/** Esercizio come lo vede l'app: catalogo + modifiche personali già unite. */
export interface Exercise {
  /** Chiave di navigazione: `c:<id catalogo>` se non c'è copia personale, `u:<id personale>` altrimenti. */
  key: string
  name: string
  /** Nome originale del catalogo (per "Ripristina"); null per un esercizio creato dall'utente. */
  catalogName: string | null
  /** Valori del catalogo (null per un esercizio creato dall'utente): servono a salvare solo ciò che l'utente ha davvero cambiato. */
  original: { equipment: EquipmentKey; primaryMuscles: MuscleKey[]; secondaryMuscles: MuscleKey[] } | null
  /** Nome inglese originale del catalogo: serve alla ricerca (in palestra molti termini si dicono in inglese). */
  nameEn: string | null
  nameNeedsReview: boolean
  equipment: EquipmentKey
  primaryMuscles: MuscleKey[]
  secondaryMuscles: MuscleKey[]
  notes: string
  isHidden: boolean
  isCustom: boolean
  /** true se almeno un campo (o la nota) è stato cambiato rispetto al catalogo. */
  isEdited: boolean
  catalogId: string | null
  userExerciseId: string | null
}

export const catalogKey = (id: string) => `c:${id}`
export const userKey = (id: string) => `u:${id}`

export function mergeExercise(catalog: CatalogExercise | null, personal: UserExercise | null): Exercise {
  if (catalog === null && personal === null) throw new Error('mergeExercise: serve almeno uno dei due')
  if (catalog === null) {
    // Esercizio creato dall'utente (il database garantisce nome, attrezzo e muscoli primari).
    const p = personal!
    return {
      key: userKey(p.id),
      name: p.name ?? '',
      catalogName: null,
      original: null,
      nameEn: null,
      nameNeedsReview: false,
      equipment: p.equipment ?? 'other',
      primaryMuscles: p.primaryMuscles ?? [],
      secondaryMuscles: p.secondaryMuscles ?? [],
      notes: p.notes ?? '',
      isHidden: p.isHidden,
      isCustom: true,
      isEdited: false,
      catalogId: null,
      userExerciseId: p.id,
    }
  }
  const edited =
    personal !== null &&
    (personal.name !== null || personal.equipment !== null || personal.primaryMuscles !== null || personal.secondaryMuscles !== null)
  return {
    key: personal ? userKey(personal.id) : catalogKey(catalog.id),
    name: personal?.name ?? catalog.nameIt,
    catalogName: catalog.nameIt,
    original: { equipment: catalog.equipment, primaryMuscles: catalog.primaryMuscles, secondaryMuscles: catalog.secondaryMuscles },
    nameEn: catalog.nameEn,
    // Se l'utente ha scelto lui il nome, non è più "da rivedere".
    nameNeedsReview: catalog.nameNeedsReview && personal?.name == null,
    equipment: personal?.equipment ?? catalog.equipment,
    primaryMuscles: personal?.primaryMuscles ?? catalog.primaryMuscles,
    secondaryMuscles: personal?.secondaryMuscles ?? catalog.secondaryMuscles,
    notes: personal?.notes ?? '',
    isHidden: personal?.isHidden ?? false,
    isCustom: false,
    isEdited: edited || (personal?.notes ?? '') !== '',
    catalogId: catalog.id,
    userExerciseId: personal?.id ?? null,
  }
}

/** Tutti gli esercizi dell'utente: catalogo unito alle sue copie, più quelli che ha creato. Ordinati per nome. */
export function buildExerciseList(catalog: readonly CatalogExercise[], personal: readonly UserExercise[]): Exercise[] {
  const byCatalog = new Map(personal.filter((p) => p.catalogId !== null).map((p) => [p.catalogId!, p]))
  const merged = catalog.map((item) => mergeExercise(item, byCatalog.get(item.id) ?? null))
  const custom = personal.filter((p) => p.catalogId === null).map((p) => mergeExercise(null, p))
  return [...merged, ...custom].sort((a, b) => a.name.localeCompare(b.name, 'it'))
}

export interface ExerciseFilter {
  query: string
  muscle: MuscleKey | null
  equipment: EquipmentKey | null
  showHidden: boolean
}

/** Cerca per nome (italiano o inglese originale) e filtra per gruppo muscolare (primario o secondario) e attrezzo. */
export function filterExercises(list: readonly Exercise[], filter: ExerciseFilter): Exercise[] {
  const words = normalizeText(filter.query).split(' ').filter(Boolean)
  return list.filter((exercise) => {
    if (exercise.isHidden && !filter.showHidden) return false
    if (filter.muscle && !exercise.primaryMuscles.includes(filter.muscle) && !exercise.secondaryMuscles.includes(filter.muscle)) return false
    if (filter.equipment && exercise.equipment !== filter.equipment) return false
    if (words.length === 0) return true
    const haystack = normalizeText(`${exercise.name} ${exercise.catalogName ?? ''} ${exercise.nameEn ?? ''}`)
    return words.every((word) => haystack.includes(word))
  })
}

export type NameResult = { ok: true; value: string } | { ok: false; message: string }

/** Nome valido: non vuoto, al massimo 80 caratteri, e diverso da un altro esercizio visibile (ignorando maiuscole e accenti). */
export function validateExerciseName(input: string, list: readonly Exercise[], ignoreKey?: string): NameResult {
  const value = input.trim().replace(/\s+/g, ' ')
  if (value === '') return { ok: false, message: 'Scrivi il nome dell’esercizio.' }
  if (value.length > EXERCISE_NAME_MAX) return { ok: false, message: `Al massimo ${EXERCISE_NAME_MAX} caratteri.` }
  const clash = list.some((exercise) => exercise.key !== ignoreKey && normalizeText(exercise.name) === normalizeText(value))
  if (clash) return { ok: false, message: 'Hai già un esercizio con questo nome.' }
  return { ok: true, value }
}

export type MusclesResult = { ok: true } | { ok: false; message: string }

export function validateMuscles(primary: readonly MuscleKey[]): MusclesResult {
  return primary.length === 0 ? { ok: false, message: 'Scegli almeno un gruppo muscolare principale.' } : { ok: true }
}

export function muscleLabels(keys: readonly MuscleKey[]): string {
  return keys.map((key) => MUSCLE_LABEL[key]).join(', ')
}

/** Percorso della scheda di un esercizio. */
export const exercisePath = (key: string) => `/palestra/esercizi/${encodeURIComponent(key)}`

const sameList = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((item, index) => item === b[index])

/**
 * Cosa salvare dopo una modifica: per un esercizio del catalogo solo i campi diversi dall'originale (gli altri tornano a
 * `null` = "come nel catalogo", così un aggiornamento del catalogo li raggiunge ancora); per un esercizio tuo, tutto.
 */
export function editPatch(
  exercise: Pick<Exercise, 'catalogName' | 'original'>,
  values: { name: string; equipment: EquipmentKey; primaryMuscles: MuscleKey[]; secondaryMuscles: MuscleKey[] },
): { name: string | null; equipment: EquipmentKey | null; primaryMuscles: MuscleKey[] | null; secondaryMuscles: MuscleKey[] | null } {
  const { original } = exercise
  if (original === null) return values
  return {
    name: values.name === exercise.catalogName ? null : values.name,
    equipment: values.equipment === original.equipment ? null : values.equipment,
    primaryMuscles: sameList(values.primaryMuscles, original.primaryMuscles) ? null : values.primaryMuscles,
    secondaryMuscles: sameList(values.secondaryMuscles, original.secondaryMuscles) ? null : values.secondaryMuscles,
  }
}
