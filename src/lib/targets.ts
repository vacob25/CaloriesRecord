import type { Sex, TrainingType } from './labels'
import { bmr, dayTarget, macros, maintenance, type Macros } from './nutrition'
import { ageOn } from './weight'

/** Parametri del profilo che servono al target (come in `profiles`). */
export interface TargetProfile {
  sex: Sex
  birthDate: string
  heightCm: number
  activityFactor: number
  surplusPct: number
  trainingBonusKcal: number
  proteinGPerKg: number
  fatGPerKg: number
}

export interface DayTargetValues {
  trainingType: TrainingType
  maintenanceKcal: number
  targetKcal: number
  macros: Macros
}

/** Target di un giorno dal profilo di quel momento (si salva in `daily_targets` e non cambia più). */
export function computeDayTarget(
  profile: TargetProfile,
  weightKg: number,
  day: string,
  trainingType: TrainingType = 'rest',
): DayTargetValues {
  const bmrKcal = bmr({ sex: profile.sex, weightKg, heightCm: profile.heightCm, ageYears: ageOn(profile.birthDate, day) })
  const maintenanceKcal = Math.round(maintenance(bmrKcal, profile.activityFactor))
  return withTrainingType(maintenanceKcal, profile, weightKg, trainingType)
}

/**
 * Cambia il tipo di giorno di un target già creato: si riparte dal mantenimento salvato
 * quel giorno (non si ricalcola il BMR), e cambia solo quella riga.
 */
export function withTrainingType(
  maintenanceKcal: number,
  profile: Pick<TargetProfile, 'surplusPct' | 'trainingBonusKcal' | 'proteinGPerKg' | 'fatGPerKg'>,
  weightKg: number,
  trainingType: TrainingType,
): DayTargetValues {
  const targetKcal = dayTarget(maintenanceKcal, profile.surplusPct, trainingType, profile.trainingBonusKcal)
  return {
    trainingType,
    maintenanceKcal,
    targetKcal,
    macros: macros(targetKcal, weightKg, profile.proteinGPerKg, profile.fatGPerKg),
  }
}

/** Stato dell'anello: kcal restanti o "oltre di N", e quanto è pieno (0-1). Mai numeri negativi. */
export function ringStatus(eatenKcal: number, targetKcal: number): { remaining: number; over: number; fraction: number } {
  const eaten = Math.round(eatenKcal)
  const remaining = Math.max(0, targetKcal - eaten)
  const over = Math.max(0, eaten - targetKcal)
  const fraction = targetKcal > 0 ? Math.min(1, eaten / targetKcal) : 0
  return { remaining, over, fraction }
}

/** Avanzamento di una barra macro (0-1). */
export function progress(eaten: number, goal: number): number {
  return goal > 0 ? Math.min(1, Math.max(0, eaten / goal)) : 0
}
