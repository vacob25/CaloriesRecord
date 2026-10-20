import type { CatalogExercise, EquipmentKey, MuscleKey, UserExercise } from '../lib/exercises'
import { throwIfError } from './dbErrors'
import { getSupabase } from './supabase'

// Libreria esercizi (Fase 3, ADR-089): catalogo globale (sola lettura) e copie/esercizi personali (RLS: solo propri).

interface CatalogRow {
  id: string
  name_it: string
  name_en: string
  name_needs_review: boolean
  equipment: EquipmentKey
  primary_muscles: MuscleKey[]
  secondary_muscles: MuscleKey[]
  category: string
  level: string
}

interface UserRow {
  id: string
  catalog_id: string | null
  name: string | null
  equipment: EquipmentKey | null
  primary_muscles: MuscleKey[] | null
  secondary_muscles: MuscleKey[] | null
  notes: string | null
  is_hidden: boolean
}

/** PostgREST restituisce al massimo 1000 righe per richiesta: il catalogo ne ha circa 720. Se un giorno supera 1000 servirà la paginazione. */
const CATALOG_LIMIT = 1000

export async function listCatalog(): Promise<CatalogExercise[]> {
  const { data, error } = await getSupabase()
    .from('exercise_catalog')
    .select('id, name_it, name_en, name_needs_review, equipment, primary_muscles, secondary_muscles, category, level')
    .order('name_it')
    .limit(CATALOG_LIMIT)
  throwIfError(error)
  return ((data ?? []) as CatalogRow[]).map((row) => ({
    id: row.id,
    nameIt: row.name_it,
    nameEn: row.name_en,
    nameNeedsReview: row.name_needs_review,
    equipment: row.equipment,
    primaryMuscles: row.primary_muscles,
    secondaryMuscles: row.secondary_muscles,
    category: row.category,
    level: row.level,
  }))
}

const USER_COLUMNS = 'id, catalog_id, name, equipment, primary_muscles, secondary_muscles, notes, is_hidden'

const toUser = (row: UserRow): UserExercise => ({
  id: row.id,
  catalogId: row.catalog_id,
  name: row.name,
  equipment: row.equipment,
  primaryMuscles: row.primary_muscles,
  secondaryMuscles: row.secondary_muscles,
  notes: row.notes,
  isHidden: row.is_hidden,
})

export async function listUserExercises(): Promise<UserExercise[]> {
  const { data, error } = await getSupabase().from('user_exercises').select(USER_COLUMNS).limit(CATALOG_LIMIT)
  throwIfError(error)
  return ((data ?? []) as UserRow[]).map(toUser)
}

/** Campi modificabili. `undefined` = non toccare; `null` = torna al valore del catalogo. */
export interface ExercisePatch {
  name?: string | null
  equipment?: EquipmentKey | null
  primaryMuscles?: MuscleKey[] | null
  secondaryMuscles?: MuscleKey[] | null
  notes?: string | null
  isHidden?: boolean
}

function toColumns(patch: ExercisePatch): Record<string, unknown> {
  const columns: Record<string, unknown> = {}
  if (patch.name !== undefined) columns.name = patch.name
  if (patch.equipment !== undefined) columns.equipment = patch.equipment
  if (patch.primaryMuscles !== undefined) columns.primary_muscles = patch.primaryMuscles
  if (patch.secondaryMuscles !== undefined) columns.secondary_muscles = patch.secondaryMuscles
  if (patch.notes !== undefined) columns.notes = patch.notes === null || patch.notes.trim() === '' ? null : patch.notes
  if (patch.isHidden !== undefined) columns.is_hidden = patch.isHidden
  return columns
}

/** Cambia un esercizio: se ha già una riga personale la aggiorna, altrimenti crea la copia personale (opzione B, ADR-089). */
export async function saveExercise(target: { userExerciseId: string | null; catalogId: string | null }, patch: ExercisePatch): Promise<void> {
  const columns = toColumns(patch)
  if (target.userExerciseId) {
    const { error } = await getSupabase().from('user_exercises').update(columns).eq('id', target.userExerciseId)
    throwIfError(error)
    return
  }
  if (!target.catalogId) throw new Error('saveExercise: serve una riga personale o un esercizio del catalogo')
  const { error } = await getSupabase().from('user_exercises').insert({ catalog_id: target.catalogId, ...columns })
  throwIfError(error)
}

export interface CustomExerciseValues {
  name: string
  equipment: EquipmentKey
  primaryMuscles: MuscleKey[]
  secondaryMuscles: MuscleKey[]
}

/** Esercizio nuovo, creato dall'utente. Restituisce l'id della riga. */
export async function createCustomExercise(values: CustomExerciseValues): Promise<string> {
  const { data, error } = await getSupabase()
    .from('user_exercises')
    .insert({
      name: values.name,
      equipment: values.equipment,
      primary_muscles: values.primaryMuscles,
      secondary_muscles: values.secondaryMuscles,
    })
    .select('id')
    .single()
  throwIfError(error)
  return (data as { id: string }).id
}

export async function deleteUserExercise(id: string): Promise<void> {
  const { error } = await getSupabase().from('user_exercises').delete().eq('id', id)
  throwIfError(error)
}
