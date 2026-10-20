import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Field } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass, dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useWorkoutActions, useWorkoutPlan } from '../../data/queries'
import { MAX_DAYS, PLAN_NAME_MAX, moveById, validatePlanName, weekdayLabel } from '../../lib/workoutPlans'

/** /palestra/schede/:planId — giorni della scheda; rinomina, duplica, archivia, elimina. */
export function PlanScreen() {
  const { planId } = useParams()
  const plan = useWorkoutPlan(planId)
  const actions = useWorkoutActions()
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (plan.isPending) return <><ScreenHeader title="Scheda" backTo="/palestra/schede" /><div className="px-5 pt-4"><ListSkeleton rows={3} /></div></>
  if (plan.isError) return <><ScreenHeader title="Scheda" backTo="/palestra/schede" /><div className="px-5 pt-4"><ErrorState message={errorMessage(plan.error)} onRetry={() => void plan.refetch()} /></div></>
  if (!plan.data) {
    return (
      <>
        <ScreenHeader title="Scheda" backTo="/palestra/schede" />
        <div className="px-5 pt-4">
          <FormMessage kind="error">Questa scheda non esiste più.</FormMessage>
        </div>
      </>
    )
  }

  const { plan: info, days, items } = plan.data
  const busy = Object.values(actions).some((mutation) => mutation.isPending)
  const error = Object.values(actions).find((mutation) => mutation.isError)?.error

  const move = (dayId: string, direction: 1 | -1) => actions.reorderDays.mutate(moveById(days, dayId, direction).map((day) => day.id))

  return (
    <>
      <ScreenHeader title={info.name} backTo="/palestra/schede" />
      <div className="space-y-3 px-5 pt-4">
        {info.isArchived && <p className="rounded-button border border-line bg-surface p-3 text-[13px] text-ink-2">Scheda archiviata: non compare tra quelle attive.</p>}
        <ul className="space-y-2">
          {days.map((day, index) => {
            const count = items.filter((item) => item.dayId === day.id).length
            return (
              <li key={day.id} className={`${cardClass} flex items-stretch`}>
                <Link to={`/palestra/schede/${info.id}/giorno/${day.id}`} className="flex min-h-16 flex-1 flex-col justify-center px-4 py-3">
                  <span className="text-[17px] font-extrabold leading-snug">{day.name}</span>
                  <span className="text-[13px] text-muted">
                    {day.weekday ? `${weekdayLabel(day.weekday)} · ` : ''}
                    {count === 0 ? 'nessun esercizio' : count === 1 ? '1 esercizio' : `${count} esercizi`}
                  </span>
                </Link>
                <span className="flex flex-col justify-center pr-1">
                  <button type="button" aria-label={`Sposta ${day.name} su`} disabled={busy || index === 0} onClick={() => move(day.id, -1)} className="flex size-11 items-center justify-center text-[18px] disabled:opacity-30">
                    ▲
                  </button>
                  <button type="button" aria-label={`Sposta ${day.name} giù`} disabled={busy || index === days.length - 1} onClick={() => move(day.id, 1)} className="flex size-11 items-center justify-center text-[18px] disabled:opacity-30">
                    ▼
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          disabled={busy || days.length >= MAX_DAYS}
          onClick={() => actions.addDay.mutate({ planId: info.id, name: `Giorno ${days.length + 1}`, position: days.length })}
          className={primaryButtonClass}
        >
          + Aggiungi un giorno
        </button>

        {renaming ? (
          <RenameForm
            initial={info.name}
            busy={busy}
            onCancel={() => setRenaming(false)}
            onSave={(name) => actions.renamePlan.mutate({ id: info.id, name }, { onSuccess: () => setRenaming(false) })}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setRenaming(true)} className={secondaryButtonClass}>
              Rinomina
            </button>
            <button type="button" disabled={busy} onClick={() => actions.duplicatePlan.mutate(info.id, { onSuccess: (id) => navigate(`/palestra/schede/${id}`) })} className={secondaryButtonClass}>
              Duplica scheda
            </button>
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => actions.archivePlan.mutate({ id: info.id, archived: !info.isArchived }, { onSuccess: () => navigate('/palestra/schede') })}
          className={secondaryButtonClass}
        >
          {info.isArchived ? 'Ripristina tra le attive' : 'Archivia la scheda'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            actions.deletePlan.mutate(info.id, { onSuccess: () => navigate('/palestra/schede', { replace: true }) })
          }}
          className={dangerButtonClass}
        >
          {confirmDelete ? 'Tocca ancora per eliminare davvero' : 'Elimina la scheda'}
        </button>
        {error != null && <FormMessage kind="error">{errorMessage(error)}</FormMessage>}
      </div>
    </>
  )
}

function RenameForm({ initial, busy, onSave, onCancel }: { initial: string; busy: boolean; onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string | undefined>()
  return (
    <form
      noValidate
      className={`${cardClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault()
        const result = validatePlanName(name)
        setError(result.ok ? undefined : result.message)
        if (result.ok) onSave(result.value)
      }}
    >
      <Field id="plan-rename" label="Nome della scheda" value={name} onChange={(event) => setName(event.target.value)} error={error} maxLength={PLAN_NAME_MAX} autoComplete="off" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Annulla
        </button>
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          Salva
        </button>
      </div>
    </form>
  )
}
