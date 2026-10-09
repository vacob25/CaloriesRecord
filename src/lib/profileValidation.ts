import {
  AGE_MAX_YEARS,
  AGE_MIN_YEARS,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  SURPLUS_WARNING_PCT,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from './constants'
import type { Sex } from './labels'
import { activityFactorFor, CUT_PACES, isGoal, validateCutGoalWeight, type ActivityLevelKey, type Goal } from './goals'
import { parseDecimal, round } from './numbers'
import { parseSports } from './sports'
import { ageOn } from './weight'

type Result<T> = { ok: true; value: T } | { ok: false; message: string }

/** Peso 30-250 kg (§9), un decimale. */
export function validateWeight(input: string): Result<number> {
  const value = parseDecimal(input)
  if (value === null) return { ok: false, message: 'Inserisci il peso in kg.' }
  if (value < WEIGHT_MIN_KG || value > WEIGHT_MAX_KG) {
    return { ok: false, message: `Il peso deve essere tra ${WEIGHT_MIN_KG} e ${WEIGHT_MAX_KG} kg.` }
  }
  return { ok: true, value: round(value, 1) }
}

export interface PersonalFormInput {
  sex: Sex | ''
  birthDate: string
  heightCm: string
  /** Solo alla prima apertura: il peso di oggi (ADR-037). */
  weightKg?: string
  goalWeightKg: string
}

export interface PersonalValues {
  sex: Sex
  birthDate: string
  heightCm: number
  weightKg: number | null
  goalWeightKg: number | null
}

export type PersonalField = keyof PersonalFormInput

/** Dati personali (DOMAIN_RULES §10): altezza 100-250 cm, età 14-100 anni, pesi 30-250 kg. */
export function validatePersonal(
  input: PersonalFormInput,
  today: string,
): { ok: true; value: PersonalValues } | { ok: false; errors: Partial<Record<PersonalField, string>> } {
  const errors: Partial<Record<PersonalField, string>> = {}

  if (input.sex !== 'male' && input.sex !== 'female') errors.sex = 'Scegli il sesso (serve solo alla formula).'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    errors.birthDate = 'Inserisci la data di nascita.'
  } else {
    const age = ageOn(input.birthDate, today)
    if (input.birthDate > today) errors.birthDate = 'La data di nascita è nel futuro.'
    else if (age < AGE_MIN_YEARS || age > AGE_MAX_YEARS) {
      errors.birthDate = `L’età deve essere tra ${AGE_MIN_YEARS} e ${AGE_MAX_YEARS} anni.`
    }
  }

  const height = parseDecimal(input.heightCm)
  if (height === null) errors.heightCm = 'Inserisci l’altezza in cm.'
  else if (height < HEIGHT_MIN_CM || height > HEIGHT_MAX_CM) {
    errors.heightCm = `L’altezza deve essere tra ${HEIGHT_MIN_CM} e ${HEIGHT_MAX_CM} cm.`
  }

  let weightKg: number | null = null
  if (input.weightKg !== undefined) {
    const weight = validateWeight(input.weightKg)
    if (weight.ok) weightKg = weight.value
    else errors.weightKg = weight.message
  }

  let goalWeightKg: number | null = null
  if (input.goalWeightKg.trim() !== '') {
    const goal = validateWeight(input.goalWeightKg)
    if (goal.ok) goalWeightKg = goal.value
    else errors.goalWeightKg = goal.message
  }

  if (Object.keys(errors).length > 0 || height === null || (input.sex !== 'male' && input.sex !== 'female')) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    value: { sex: input.sex, birthDate: input.birthDate, heightCm: round(height, 1), weightKg, goalWeightKg },
  }
}

export interface ParamsFormInput {
  activityFactor: string
  /** In percentuale: "10" = +10%. */
  surplusPct: string
  trainingBonusKcal: string
  proteinGPerKg: string
  fatGPerKg: string
}

export interface ParamsValues {
  activityFactor: number
  surplusPct: number
  trainingBonusKcal: number
  proteinGPerKg: number
  fatGPerKg: number
}

export type ParamsField = keyof ParamsFormInput

/**
 * Parametri del profilo. DOMAIN_RULES non fissa limiti (§10): solo > 0 per il fattore,
 * ≥ 0 per gli altri, e i massimi delle colonne del database. Avviso se il surplus supera il 20%.
 */
export function validateParams(
  input: ParamsFormInput,
):
  | { ok: true; value: ParamsValues; warnings: string[] }
  | { ok: false; errors: Partial<Record<ParamsField, string>> } {
  const errors: Partial<Record<ParamsField, string>> = {}
  const read = (field: ParamsField, label: string, min: number, max: number, exclusiveMin = false) => {
    const value = parseDecimal(input[field])
    if (value === null) errors[field] = `Inserisci ${label}.`
    else if (exclusiveMin ? value <= min : value < min) errors[field] = exclusiveMin ? 'Deve essere più di 0.' : 'Non può essere negativo.'
    else if (value > max) errors[field] = `Al massimo ${String(max).replace('.', ',')}.`
    return value ?? 0
  }
  const activityFactor = read('activityFactor', 'il fattore di attività', 0, 9.999, true)
  const surplus = read('surplusPct', 'il surplus', 0, 999)
  const bonus = read('trainingBonusKcal', 'il bonus allenamento', 0, 5000)
  const protein = read('proteinGPerKg', 'le proteine per kg', 0, 9.99)
  const fat = read('fatGPerKg', 'i grassi per kg', 0, 9.99)
  if (!errors.trainingBonusKcal && !Number.isInteger(bonus)) errors.trainingBonusKcal = 'Scrivi un numero intero di kcal.'
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const surplusPct = round(surplus / 100, 3)
  const warnings =
    surplusPct > SURPLUS_WARNING_PCT
      ? ['Surplus oltre il 20%: in un bulk così l’aumento è soprattutto grasso. Va bene solo se è una scelta consapevole.']
      : []
  return {
    ok: true,
    value: {
      activityFactor: round(activityFactor, 3),
      surplusPct,
      trainingBonusKcal: bonus,
      proteinGPerKg: round(protein, 2),
      fatGPerKg: round(fat, 2),
    },
    warnings,
  }
}

// ─── Obiettivo, sport e attività (step 19) ──────────────────────────────────

/** Ciò che si salva nel profilo per obiettivo e sport (Benvenuto e Profilo). */
export interface PlanValues {
  goal: Goal
  cutRatePct: number
  sports: string[]
}

export interface PlanFormInput {
  goal: Goal | ''
  cutRatePct: number
  sports: string[]
  /** Solo al Benvenuto: livello di attività da cui si ricava il fattore (null altrove). */
  activityLevel: ActivityLevelKey | ''
}

export type PlanField = 'goal' | 'activityLevel' | 'goalWeightKg'

/**
 * Valida obiettivo, ritmo del cut, sport e (al Benvenuto) livello di attività.
 * Il cut richiede un peso obiettivo più basso del peso di oggi: senza, non c'è un punto d'arrivo.
 */
export function validatePlan(
  input: PlanFormInput,
  context: { weightKg: number | null; goalWeightKg: number | null },
  requireActivity: boolean,
): { ok: true; value: { plan: PlanValues; activityFactor: number | null } } | { ok: false; errors: Partial<Record<PlanField, string>> } {
  const errors: Partial<Record<PlanField, string>> = {}
  if (!isGoal(input.goal)) errors.goal = 'Scegli il tuo obiettivo.'
  if (requireActivity && input.activityLevel === '') errors.activityLevel = 'Scegli quanto sei attivo: serve a stimare il tuo metabolismo.'
  if (input.goal === 'cut') {
    if (context.goalWeightKg === null) errors.goalWeightKg = 'Per la definizione scrivi il peso che vuoi raggiungere.'
    else if (context.weightKg !== null) {
      const message = validateCutGoalWeight(context.weightKg, context.goalWeightKg)
      if (message) errors.goalWeightKg = message
    }
  }
  if (Object.keys(errors).length > 0 || !isGoal(input.goal)) return { ok: false, errors }

  const validPace = CUT_PACES.some((pace) => pace.pct === input.cutRatePct)
  return {
    ok: true,
    value: {
      plan: { goal: input.goal, cutRatePct: validPace ? input.cutRatePct : CUT_PACES[0]!.pct, sports: parseSports(input.sports) },
      activityFactor: input.activityLevel === '' ? null : activityFactorFor(input.activityLevel),
    },
  }
}
