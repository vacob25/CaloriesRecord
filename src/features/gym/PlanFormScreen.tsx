import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Field } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { FormMessage } from '../../components/States'
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useWorkoutActions } from '../../data/queries'
import { DAY_NAME_MAX, MAX_DAYS, PLAN_NAME_MAX, defaultDayNames, validateDayName, validatePlanName, weekdayLabel } from '../../lib/workoutPlans'

interface DraftDay {
  name: string
  weekday: number | null
}

/** /palestra/schede/nuova — nome della scheda, quanti giorni e come si chiamano (giorno della settimana facoltativo). */
export function PlanFormScreen() {
  const navigate = useNavigate()
  const { createPlan } = useWorkoutActions()
  const [name, setName] = useState('')
  const [days, setDays] = useState<DraftDay[]>(() => defaultDayNames(3).map((day) => ({ name: day, weekday: null })))
  const [errors, setErrors] = useState<{ name?: string; days: Record<number, string> }>({ days: {} })

  const setCount = (count: number) => {
    const next = Math.min(MAX_DAYS, Math.max(1, count))
    setDays((current) => (next <= current.length ? current.slice(0, next) : [...current, ...defaultDayNames(next).slice(current.length).map((day) => ({ name: day, weekday: null }))]))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const planName = validatePlanName(name)
    const dayResults = days.map((day) => validateDayName(day.name))
    setErrors({
      name: planName.ok ? undefined : planName.message,
      days: Object.fromEntries(dayResults.flatMap((result, index) => (result.ok ? [] : [[index, result.message] as const]))),
    })
    if (!planName.ok || dayResults.some((result) => !result.ok)) return
    createPlan.mutate(
      { name: planName.value, days: days.map((day, index) => ({ name: (dayResults[index] as { ok: true; value: string }).value, weekday: day.weekday })) },
      { onSuccess: (id) => navigate(`/palestra/schede/${id}`, { replace: true }) },
    )
  }

  return (
    <>
      <ScreenHeader title="Nuova scheda" backTo="/palestra/schede" />
      <form onSubmit={submit} noValidate className="space-y-4 px-5 pt-4">
        <Field id="plan-name" label="Nome della scheda" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} maxLength={PLAN_NAME_MAX} autoComplete="off" placeholder="Es. Push Pull Legs" />
        <div className={`${cardClass} flex items-center justify-between p-4`}>
          <span id="days-count" className="text-[15px] font-bold">
            Giorni di allenamento
          </span>
          <span className="flex items-center gap-2" role="group" aria-labelledby="days-count">
            <button type="button" aria-label="Un giorno in meno" disabled={days.length <= 1} onClick={() => setCount(days.length - 1)} className="size-11 rounded-full border border-line bg-surface text-[20px] font-bold disabled:opacity-40">
              −
            </button>
            <span aria-live="polite" className="w-8 text-center text-[18px] font-extrabold tabular-nums">
              {days.length}
            </span>
            <button type="button" aria-label="Un giorno in più" disabled={days.length >= MAX_DAYS} onClick={() => setCount(days.length + 1)} className="size-11 rounded-full border border-line bg-surface text-[20px] font-bold disabled:opacity-40">
              +
            </button>
          </span>
        </div>
        {days.map((day, index) => (
          <fieldset key={index} className={`${cardClass} space-y-3 p-4`}>
            <legend className="px-1 text-[15px] font-extrabold">Giorno {index + 1}</legend>
            <Field
              id={`day-name-${index}`}
              label="Nome"
              value={day.name}
              onChange={(event) => setDays((current) => current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))}
              error={errors.days[index]}
              maxLength={DAY_NAME_MAX}
              autoComplete="off"
            />
            <div>
              <label htmlFor={`day-weekday-${index}`} className="block text-[13px] font-semibold text-ink-2">
                Giorno della settimana (facoltativo)
              </label>
              <select
                id={`day-weekday-${index}`}
                value={day.weekday ?? ''}
                onChange={(event) => setDays((current) => current.map((item, i) => (i === index ? { ...item, weekday: event.target.value === '' ? null : Number(event.target.value) } : item)))}
                className={inputClass}
              >
                <option value="">Nessuno</option>
                {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {weekdayLabel(weekday)}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        ))}
        <button type="submit" disabled={createPlan.isPending} className={primaryButtonClass}>
          {createPlan.isPending ? 'Creazione…' : 'Crea la scheda'}
        </button>
        <button type="button" onClick={() => navigate('/palestra/schede')} className={secondaryButtonClass}>
          Annulla
        </button>
        {createPlan.isError && <FormMessage kind="error">{errorMessage(createPlan.error)}</FormMessage>}
      </form>
    </>
  )
}
