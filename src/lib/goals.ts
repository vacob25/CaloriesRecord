import { GAIN_RATE_WARNING_KG_WEEK, CUT_RATE_MAX_PCT_WEEK, CUT_RATE_MIN_PCT_WEEK, CUT_RATE_STEADY_PCT_WEEK, ENERGY_PER_KG, MAINTAIN_BAND_KG_WEEK, RECAL_BAND_MAX, RECAL_BAND_MIN, TARGET_RATE_MAX_KG_WEEK, TARGET_RATE_MIN_KG_WEEK, ADULT_AGE_YEARS } from './constants'
import { formatFixed, formatNumber, formatSigned, round } from './numbers'
import { dayTarget } from './nutrition'

/** Obiettivo dell'utente (step 19): massa, mantenimento, definizione. */
export const GOALS = ['bulk', 'maintain', 'cut'] as const
export type Goal = (typeof GOALS)[number]

export function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOALS as readonly string[]).includes(value)
}

export const GOAL_LABEL: Record<Goal, string> = {
  bulk: 'Mettere massa',
  maintain: 'Mantenere il peso',
  cut: 'Definizione (cut)',
}

export const GOAL_HINT: Record<Goal, string> = {
  bulk: 'Aumentare i muscoli: mangi un po’ più del tuo mantenimento.',
  maintain: 'Restare dove sei: mangi quanto il tuo mantenimento.',
  cut: 'Perdere grasso tenendo più muscolo possibile: mangi meno del mantenimento, in base al tuo peso.',
}

/** Parametri del profilo che decidono quanto sopra/sotto il mantenimento si mira. */
export interface GoalProfile {
  goal: Goal
  /** Massa: surplus in frazione del mantenimento (0,10 = +10%). Ignorato per gli altri obiettivi. */
  surplusPct: number
  /** Cut: perdita voluta in frazione del peso a settimana (0,005 = 0,5%). Ignorata per gli altri obiettivi. */
  cutRatePct: number
}

/** Deficit giornaliero (kcal) per perdere `ratePct` del peso a settimana: peso · rate · 7700 / 7. */
export function cutDeficitKcal(weightKg: number, ratePct: number): number {
  return (weightKg * ratePct * ENERGY_PER_KG) / 7
}

/**
 * Scostamento dal mantenimento in frazione del mantenimento (positivo = surplus, negativo = deficit).
 * Massa: surplus fisso. Mantenimento: 0. Cut: dipende dal peso (si ricalcola ogni giorno col peso di quel giorno).
 */
export function adjustmentPct(profile: GoalProfile, maintenanceKcal: number, weightKg: number): number {
  switch (profile.goal) {
    case 'bulk':
      return profile.surplusPct
    case 'maintain':
      return 0
    case 'cut':
      return maintenanceKcal > 0 ? -cutDeficitKcal(weightKg, profile.cutRatePct) / maintenanceKcal : 0
  }
}

/** Target di un giorno di riposo (senza bonus allenamento), arrotondato come gli altri target. */
export function restDayTargetKcal(maintenanceKcal: number, profile: GoalProfile, weightKg: number): number {
  return dayTarget(maintenanceKcal, adjustmentPct(profile, maintenanceKcal, weightKg), 'rest', 0)
}

/** Ritmo atteso dal piano in kg/settimana, con segno (giorni di riposo, bonus escluso). */
export function plannedRateKgWeek(profile: GoalProfile, maintenanceKcal: number, weightKg: number): number {
  return (maintenanceKcal * adjustmentPct(profile, maintenanceKcal, weightKg) * 7) / ENERGY_PER_KG
}

/**
 * Banda del peso in cui la ricalibrazione non propone nulla (kg/settimana, con segno).
 * Massa: +0,20/+0,40 (§7). Mantenimento: ±0,10. Cut: perdita tra 0,5% e 1,0% del peso a settimana.
 * 3 decimali, come la pendenza con cui si confronta (ADR-044).
 */
export function rateBandKgWeek(goal: Goal, weightKg: number): { min: number; max: number } {
  switch (goal) {
    case 'bulk':
      return { min: RECAL_BAND_MIN, max: RECAL_BAND_MAX }
    case 'maintain':
      return { min: -MAINTAIN_BAND_KG_WEEK, max: MAINTAIN_BAND_KG_WEEK }
    case 'cut':
      return { min: round(-CUT_RATE_MAX_PCT_WEEK * weightKg, 3), max: round(-CUT_RATE_MIN_PCT_WEEK * weightKg, 3) }
  }
}

/** Il ritmo voluto, scritto per l'utente (Peso e Ricalibrazione). Il massa usa il ritmo di CLAUDE.md (+0,20/+0,35). */
export function describeTargetRate(profile: GoalProfile, weightKg: number | null): string {
  switch (profile.goal) {
    case 'bulk':
      return `${formatSigned(TARGET_RATE_MIN_KG_WEEK, 2)} / ${formatSigned(TARGET_RATE_MAX_KG_WEEK, 2)} kg a settimana`
    case 'maintain':
      return `stabile (±${formatFixed(MAINTAIN_BAND_KG_WEEK, 2)} kg a settimana)`
    case 'cut':
      return weightKg === null
        ? `perdita del ${formatNumber(profile.cutRatePct * 100, 1)}% del peso a settimana`
        : `circa ${formatSigned(-round(weightKg * profile.cutRatePct, 2), 2)} kg a settimana`
  }
}

export interface CutPace {
  pct: number
  label: string
  hint: string
}

/** Tre ritmi del cut, dal più prudente al più deciso (valori e fonti in constants.ts). */
export const CUT_PACES: readonly CutPace[] = [
  { pct: CUT_RATE_MIN_PCT_WEEK, label: 'Graduale', hint: 'Il più prudente: meno fame e più muscolo conservato. Consigliato per cominciare.' },
  { pct: CUT_RATE_STEADY_PCT_WEEK, label: 'Medio', hint: 'Equilibrato: ritmo con cui, negli studi, si conserva la massa magra.' },
  { pct: CUT_RATE_MAX_PCT_WEEK, label: 'Deciso', hint: 'Il limite alto: ha senso solo con parecchio grasso da perdere. Sarà più dura.' },
]

export const DEFAULT_CUT_RATE_PCT = CUT_RATE_MIN_PCT_WEEK

/**
 * Settimane per arrivare al peso obiettivo con un cut al ritmo scelto. Il deficit segue il peso (si ricalcola ogni
 * giorno), quindi la perdita è composta: settimane = ln(obiettivo/peso) / ln(1 − ritmo). È una stima ottimistica:
 * nella realtà la perdita rallenta col tempo (modello dinamico di Hall). Null se l'obiettivo non è sotto il peso.
 */
export function weeksToGoal(weightKg: number, goalWeightKg: number, ratePct: number): number | null {
  if (!(goalWeightKg > 0) || goalWeightKg >= weightKg || !(ratePct > 0) || ratePct >= 1) return null
  return Math.ceil(Math.log(goalWeightKg / weightKg) / Math.log(1 - ratePct))
}

/** Errore se il peso obiettivo non ha senso per un cut (deve essere più basso del peso di oggi). */
export function validateCutGoalWeight(weightKg: number, goalWeightKg: number | null): string | null {
  if (goalWeightKg === null) return null
  return goalWeightKg < weightKg ? null : 'Per la definizione il peso obiettivo deve essere più basso del peso di oggi.'
}

/** Il cut sotto i 18 anni è delicato (crescita, rischio di abitudini scorrette): si avvisa, non si blocca. */
export function cutNeedsMedicalNote(ageYears: number): boolean {
  return ageYears < ADULT_AGE_YEARS
}

/** Target sotto il metabolismo basale: avviso (non blocco), difficile coprire i fabbisogni di base. */
export function isBelowBmr(targetKcal: number, bmrKcal: number): boolean {
  return targetKcal < bmrKcal
}

export type ActivityLevelKey = 'low' | 'light' | 'moderate' | 'high'

export interface ActivityLevel {
  key: ActivityLevelKey
  factor: number
  label: string
  hint: string
}

/**
 * Livello di attività alla registrazione. Moltiplicatori standard del fabbisogno (1,2 / 1,375 / 1,55 / 1,725),
 * l'errore più grande di queste stime (10-15%): la ricalibrazione li corregge con i dati veri dopo 3 settimane.
 */
export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  { key: 'low', factor: 1.2, label: 'Poco attivo', hint: 'Giornata da seduto, quasi nessun allenamento' },
  { key: 'light', factor: 1.375, label: 'Leggero', hint: '1-3 allenamenti a settimana' },
  { key: 'moderate', factor: 1.55, label: 'Medio', hint: '3-5 allenamenti a settimana' },
  { key: 'high', factor: 1.725, label: 'Alto', hint: '6-7 allenamenti a settimana' },
]

export function activityFactorFor(key: ActivityLevelKey): number {
  return ACTIVITY_LEVELS.find((level) => level.key === key)?.factor ?? 1.375
}

/**
 * Avvisi sul piano (non bloccano): ritmo troppo alto per l'obiettivo e target dei giorni di riposo sotto il BMR.
 * `maintenanceKcal` e `weightKg` sono quelli di oggi (già riscalati sul fattore di attività del modulo).
 */
export function planWarnings(profile: GoalProfile, maintenanceKcal: number, weightKg: number, bmrKcal: number): string[] {
  const warnings: string[] = []
  const rate = plannedRateKgWeek(profile, maintenanceKcal, weightKg)
  if (profile.goal === 'bulk' && rate > GAIN_RATE_WARNING_KG_WEEK) {
    warnings.push(
      `Con questi parametri il ritmo stimato è circa +${formatNumber(rate, 2)} kg/settimana, oltre +${formatNumber(GAIN_RATE_WARNING_KG_WEEK, 1)}: l’aumento sarebbe soprattutto grasso.`,
    )
  }
  if (profile.goal === 'cut' && round(-rate, 3) > round(CUT_RATE_MAX_PCT_WEEK * weightKg, 3)) {
    warnings.push(
      `Con questi parametri perderesti circa ${formatNumber(-rate, 2)} kg/settimana, oltre l’${formatNumber(CUT_RATE_MAX_PCT_WEEK * 100)}% del peso: si rischia di perdere muscolo.`,
    )
  }
  if (isBelowBmr(restDayTargetKcal(maintenanceKcal, profile, weightKg), bmrKcal)) {
    warnings.push('Il target dei giorni di riposo è sotto il tuo metabolismo basale: è difficile coprire i fabbisogni di base.')
  }
  return warnings
}
