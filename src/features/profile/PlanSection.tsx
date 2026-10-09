import { useState } from 'react'

import { FormMessage } from '../../components/States'
import { cardClass, primaryButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { errorMessage } from '../../data/dbErrors'
import { useDayTarget, useUpdatePlan } from '../../data/queries'
import type { Profile } from '../../data/types'
import { planWarnings } from '../../lib/goals'
import { validatePlan, type PlanField, type PlanFormInput } from '../../lib/profileValidation'
import { ageOn } from '../../lib/weight'
import { GoalFields } from './GoalFields'
import { SportsFields } from './SportsFields'

/** Obiettivo, ritmo del cut e sport (step 19). Si salva da qui; il target di oggi si ricalcola, i giorni passati no (ADR-039). */
export function PlanSection({ profile }: { profile: Profile }) {
  const today = useToday()
  const update = useUpdatePlan()
  const target = useDayTarget(today)
  const [form, setForm] = useState<PlanFormInput>({
    goal: profile.goal,
    cutRatePct: profile.cutRatePct,
    sports: profile.sports,
    activityLevel: '',
  })
  const [errors, setErrors] = useState<Partial<Record<PlanField, string>>>({})

  const weightKg = target.data?.status === 'ready' ? target.data.weightKg : null
  const maintenanceKcal = target.data?.status === 'ready' ? target.data.target.maintenanceKcal : null
  // Avvisi sul piano scelto (ritmo troppo alto, target sotto il BMR), in tempo reale: non bloccano.
  const warnings =
    form.goal !== '' && weightKg !== null && maintenanceKcal !== null
      ? planWarnings({ goal: form.goal, surplusPct: profile.surplusPct, cutRatePct: form.cutRatePct }, maintenanceKcal, weightKg, maintenanceKcal / profile.activityFactor)
      : []

  function handleSubmit() {
    const result = validatePlan(form, { weightKg, goalWeightKg: profile.goalWeightKg }, false)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    update.mutate({ plan: result.value.plan, today })
  }

  return (
    <section aria-labelledby="plan-title" data-tour="profile-goal" className={`${cardClass} mx-5 mt-4 p-5`}>
      <h2 id="plan-title" className="mb-4 text-[18px] font-extrabold">
        Obiettivo e sport
      </h2>
      <div className="space-y-6">
        <GoalFields
          goal={form.goal}
          cutRatePct={form.cutRatePct}
          onGoalChange={(goal) => setForm({ ...form, goal })}
          onPaceChange={(cutRatePct) => setForm({ ...form, cutRatePct })}
          weightKg={weightKg}
          ageYears={ageOn(profile.birthDate, today)}
          savedGoalWeightKg={profile.goalWeightKg}
          goalError={errors.goal ?? errors.goalWeightKg}
        />
        <SportsFields sports={form.sports} onChange={(sports) => setForm({ ...form, sports })} />
      </div>
      {warnings.map((warning) => (
        <FormMessage key={warning} kind="warning">
          {warning}
        </FormMessage>
      ))}
      {update.isError && <FormMessage kind="error">{errorMessage(update.error)}</FormMessage>}
      <button type="button" onClick={handleSubmit} disabled={update.isPending} className={`${primaryButtonClass} mt-5`}>
        {update.isPending ? 'Salvataggio…' : 'Salva obiettivo e sport'}
      </button>
      {update.isSuccess && (
        <p role="status" className="mt-3 text-[13px] font-semibold text-green-dark">
          Salvato. Vale da oggi; i giorni passati non cambiano.
        </p>
      )}
    </section>
  )
}
