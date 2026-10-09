import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { LoadingScreen } from '../../app/LoadingScreen'
import { ErrorState, FormMessage } from '../../components/States'
import { primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { errorMessage } from '../../data/dbErrors'
import { useCreateProfile, useProfile } from '../../data/queries'
import { DEFAULT_CUT_RATE_PCT } from '../../lib/goals'
import { parseDecimal } from '../../lib/numbers'
import {
  validatePersonal,
  validatePlan,
  type PersonalField,
  type PersonalFormInput,
  type PlanField,
  type PlanFormInput,
} from '../../lib/profileValidation'
import { ageOn } from '../../lib/weight'
import { ActivityFields } from './ActivityFields'
import { GoalFields } from './GoalFields'
import { PersonalFields } from './PersonalFields'
import { SportsFields } from './SportsFields'

const STEPS = ['Dati', 'Obiettivo', 'Allenamento'] as const

/**
 * /benvenuto — prima apertura in 3 passi (step 19): dati personali e peso di oggi, obiettivo (massa,
 * mantenimento, cut con ritmo e previsione), sport e livello di attività. Restano solo nel tuo database.
 */
export function OnboardingScreen() {
  const today = useToday()
  const navigate = useNavigate()
  const profile = useProfile()
  const create = useCreateProfile()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<PersonalFormInput>({ sex: '', birthDate: '', heightCm: '', weightKg: '', goalWeightKg: '' })
  const [plan, setPlan] = useState<PlanFormInput>({ goal: '', cutRatePct: DEFAULT_CUT_RATE_PCT, sports: [], activityLevel: '' })
  const [errors, setErrors] = useState<Partial<Record<PersonalField, string>>>({})
  const [planErrors, setPlanErrors] = useState<Partial<Record<PlanField, string>>>({})

  if (profile.isPending) return <LoadingScreen />
  if (profile.isError) return <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
  if (profile.data) return <Navigate to="/" replace />

  const weightKg = parseDecimal(form.weightKg ?? '')
  const ageYears = /^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) ? ageOn(form.birthDate, today) : null

  function next() {
    if (step === 0) {
      const result = validatePersonal(form, today)
      if (!result.ok) {
        setErrors(result.errors)
        return
      }
      setErrors({})
      setStep(1)
    } else if (step === 1) {
      const personal = validatePersonal(form, today)
      const result = validatePlan(plan, { weightKg: personal.ok ? personal.value.weightKg : null, goalWeightKg: personal.ok ? personal.value.goalWeightKg : null }, false)
      if (!result.ok) {
        setPlanErrors(result.errors)
        return
      }
      // Il peso obiettivo scritto in questo passo ha già superato i limiti (30-250 kg) con validatePersonal.
      if (!personal.ok) {
        setErrors(personal.errors)
        setPlanErrors({ goalWeightKg: personal.errors.goalWeightKg })
        return
      }
      setPlanErrors({})
      setStep(2)
    }
  }

  function submit() {
    const personal = validatePersonal(form, today)
    if (!personal.ok) {
      setErrors(personal.errors)
      setStep(0)
      return
    }
    const result = validatePlan(plan, { weightKg: personal.value.weightKg, goalWeightKg: personal.value.goalWeightKg }, true)
    if (!result.ok) {
      setPlanErrors(result.errors)
      if (result.errors.goal || result.errors.goalWeightKg) setStep(1)
      return
    }
    setErrors({})
    setPlanErrors({})
    create.mutate(
      { values: personal.value, plan: result.value.plan, activityFactor: result.value.activityFactor ?? 1.375, today },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">Benvenuto</h1>
      <p className="mt-1 text-[13px] font-semibold text-green-dark" aria-live="polite">
        Passo {step + 1} di {STEPS.length} · {STEPS[step]}
      </p>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {STEPS.map((name, index) => (
          <span key={name} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-green' : 'bg-line'}`} />
        ))}
      </div>

      {step === 0 && (
        <>
          <p className="mt-4 text-[15px] text-ink-2">
            Servono pochi dati per calcolare il tuo obiettivo di calorie. Restano solo nel tuo database e puoi cambiarli dal Profilo.
          </p>
          <div className="mt-6">
            <PersonalFields form={form} errors={errors} onChange={setForm} askWeight askGoalWeight={false} />
          </div>
        </>
      )}

      {step === 1 && (
        <div className="mt-6">
          <GoalFields
            goal={plan.goal}
            cutRatePct={plan.cutRatePct}
            onGoalChange={(goal) => setPlan({ ...plan, goal })}
            onPaceChange={(cutRatePct) => setPlan({ ...plan, cutRatePct })}
            weightKg={weightKg}
            ageYears={ageYears}
            goalWeight={{
              value: form.goalWeightKg,
              onChange: (value) => setForm({ ...form, goalWeightKg: value }),
              error: planErrors.goalWeightKg ?? errors.goalWeightKg,
            }}
            goalError={planErrors.goal}
          />
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-6">
          <SportsFields sports={plan.sports} onChange={(sports) => setPlan({ ...plan, sports })} />
          <ActivityFields value={plan.activityLevel} onChange={(activityLevel) => setPlan({ ...plan, activityLevel })} error={planErrors.activityLevel} />
        </div>
      )}

      {create.isError && <FormMessage kind="error">{errorMessage(create.error)}</FormMessage>}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} className={secondaryButtonClass}>
            Indietro
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className={primaryButtonClass}>
            Avanti
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={create.isPending} className={primaryButtonClass}>
            {create.isPending ? 'Salvataggio…' : 'Inizia'}
          </button>
        )}
      </div>
    </main>
  )
}
