import type { EquipmentKey, Exercise, MuscleKey } from '../../lib/exercises'
import { resolveExercise, type PlanExercise } from '../../lib/workoutPlans'

/** Come si mostra un esercizio di una scheda: i dati dell'esercizio "effettivo" (catalogo + modifiche), o un segnaposto se non c'è più. */
export interface PlanExerciseView {
  name: string
  equipment: EquipmentKey
  primaryMuscles: MuscleKey[]
  available: boolean
}

export function viewOf(item: PlanExercise, exercises: readonly Exercise[]): PlanExerciseView {
  const exercise = resolveExercise(item, exercises)
  return exercise
    ? { name: exercise.name, equipment: exercise.equipment, primaryMuscles: exercise.primaryMuscles, available: true }
    : { name: 'Esercizio non disponibile', equipment: 'other', primaryMuscles: [], available: false }
}
