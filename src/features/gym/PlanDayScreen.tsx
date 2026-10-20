import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Field } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useExercises, useWorkoutActions, useWorkoutPlan } from '../../data/queries'
import type { Exercise } from '../../lib/exercises'
import { DAY_NAME_MAX, DEFAULT_REPS, DEFAULT_SETS, MAX_EXERCISES_PER_DAY, moveById, resolveExercise, validateDayName, weekdayLabel, type PlanDay } from '../../lib/workoutPlans'
import { ExercisePicker } from './ExercisePicker'
import { PlanExerciseCard } from './PlanExerciseCard'
import { viewOf } from './planViews'

/** /palestra/schede/:planId/giorno/:dayId — gli esercizi del giorno; si aggiungono dal selettore per gruppo muscolare. */
export function PlanDayScreen() {
  const { planId, dayId } = useParams()
  const plan = useWorkoutPlan(planId)
  const exercises = useExercises()
  const actions = useWorkoutActions()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const back = `/palestra/schede/${planId ?? ''}`

  if (plan.isPending || exercises.isPending) return <><ScreenHeader title="Giorno" backTo={back} /><div className="px-5 pt-4"><ListSkeleton rows={3} /></div></>
  if (plan.isError || exercises.isError) {
    return <><ScreenHeader title="Giorno" backTo={back} /><div className="px-5 pt-4"><ErrorState message={errorMessage(plan.error ?? exercises.error)} onRetry={() => { void plan.refetch(); exercises.refetch() }} /></div></>
  }
  const day = plan.data?.days.find((candidate) => candidate.id === dayId)
  if (!plan.data || !day) {
    return <><ScreenHeader title="Giorno" backTo={back} /><div className="px-5 pt-4"><FormMessage kind="error">Questo giorno non esiste più.</FormMessage></div></>
  }

  const all = exercises.data ?? []
  const items = plan.data.items.filter((item) => item.dayId === day.id)
  const busy = Object.values(actions).some((mutation) => mutation.isPending)
  const error = Object.values(actions).find((mutation) => mutation.isError)?.error

  const usageOf = (exercise: Exercise) =>
    items.filter((item) => resolveExercise(item, [exercise]) !== undefined).length

  function addExercise(exercise: Exercise) {
    if (items.length >= MAX_EXERCISES_PER_DAY) return
    // Un esercizio del catalogo si salva col suo id di catalogo (anche se rinominato: la scheda lo segue); uno tuo col suo id.
    const values = { dayId: day!.id, catalogId: exercise.catalogId, userExerciseId: exercise.catalogId ? null : exercise.userExerciseId, position: items.length, sets: DEFAULT_SETS, repsMin: DEFAULT_REPS }
    actions.addExercise.mutate(values, { onSuccess: () => setLastAdded(exercise.name) })
  }

  return (
    <>
      <ScreenHeader title={day.name} backTo={back} />
      <div className="space-y-3 px-5 pt-4">
        <DaySettings key={`${day.name}|${day.weekday ?? ''}`} day={day} busy={busy} onSave={(patch) => actions.updateDay.mutate({ id: day.id, patch })} />

        {items.length === 0 && <EmptyState text="Nessun esercizio in questo giorno. Aggiungine dal selettore: sono divisi per gruppo muscolare." />}
        <ul className="space-y-3">
          {items.map((item, index) => (
            <PlanExerciseCard
              key={item.id}
              item={item}
              view={viewOf(item, all)}
              index={index}
              count={items.length}
              busy={busy}
              onUpdate={(patch) => actions.updateExercise.mutate({ id: item.id, patch })}
              onMove={(direction) => actions.reorderExercises.mutate(moveById(items, item.id, direction).map((candidate) => candidate.id))}
              onRemove={() => actions.removeExercise.mutate(item.id)}
            />
          ))}
        </ul>

        <button type="button" disabled={busy || items.length >= MAX_EXERCISES_PER_DAY} onClick={() => { setLastAdded(null); setPicking(true) }} className={primaryButtonClass}>
          + Aggiungi esercizio
        </button>
        <button type="button" disabled={busy} onClick={() => actions.duplicateDay.mutate(day.id, { onSuccess: (id) => navigate(`${back}/giorno/${id}`) })} className={secondaryButtonClass}>
          Duplica il giorno
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            actions.deleteDay.mutate(day.id, { onSuccess: () => navigate(back, { replace: true }) })
          }}
          className={dangerButtonClass}
        >
          {confirmDelete ? 'Tocca ancora per eliminare davvero' : 'Elimina il giorno'}
        </button>
        {error != null && <FormMessage kind="error">{errorMessage(error)}</FormMessage>}
      </div>
      {picking && <ExercisePicker exercises={all} usageOf={usageOf} onAdd={addExercise} onClose={() => setPicking(false)} lastAdded={lastAdded} />}
    </>
  )
}

function DaySettings({ day, busy, onSave }: { day: PlanDay; busy: boolean; onSave: (patch: { name?: string; weekday?: number | null }) => void }) {
  const [name, setName] = useState(day.name)
  const [weekday, setWeekday] = useState<number | null>(day.weekday)
  const [error, setError] = useState<string | undefined>()
  const changed = name !== day.name || weekday !== day.weekday
  return (
    <form
      noValidate
      className={`${cardClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault()
        const result = validateDayName(name)
        setError(result.ok ? undefined : result.message)
        if (result.ok) onSave({ name: result.value, weekday })
      }}
    >
      <Field id="day-name" label="Nome del giorno" value={name} onChange={(event) => setName(event.target.value)} error={error} maxLength={DAY_NAME_MAX} autoComplete="off" />
      <div>
        <label htmlFor="day-weekday" className="block text-[13px] font-semibold text-ink-2">
          Giorno della settimana (facoltativo)
        </label>
        <select id="day-weekday" value={weekday ?? ''} onChange={(event) => setWeekday(event.target.value === '' ? null : Number(event.target.value))} className={inputClass}>
          <option value="">Nessuno</option>
          {[1, 2, 3, 4, 5, 6, 7].map((value) => (
            <option key={value} value={value}>
              {weekdayLabel(value)}
            </option>
          ))}
        </select>
      </div>
      {changed && (
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          Salva nome e giorno
        </button>
      )}
    </form>
  )
}
