import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useToday } from '../../components/useToday'
import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { newId } from '../../data/ids'
import { useActiveSession, useExercises, useRecentSessions, useWorkoutPlan, useWorkoutPlans } from '../../data/queries'
import { fetchLastTimes, insertSession } from '../../data/workoutSessions'
import type { PlanDay } from '../../lib/workoutPlans'
import { weekdayLabel } from '../../lib/workoutPlans'
import { buildSession, isoWeekday, suggestDay, type Session } from '../../lib/workoutSession'

/** /palestra/allenamento/nuovo — scegli scheda e giorno (consigliato quello di oggi o il prossimo) oppure una sessione libera. */
export function StartSessionScreen() {
  const navigate = useNavigate()
  const today = useToday()
  const plans = useWorkoutPlans()
  const exercises = useExercises()
  const active = useActiveSession()
  const recent = useRecentSessions()
  const [planId, setPlanId] = useState<string | null>(null)
  const plan = useWorkoutPlan(planId ?? undefined)

  const start = useMutation({
    mutationFn: async ({ day }: { day: PlanDay | null }) => {
      const detail = day ? plan.data : null
      const items = day && detail ? detail.items.filter((item) => item.dayId === day.id) : []
      const last = await fetchLastTimes(items)
      const session: Session = buildSession(
        { id: newId(), date: today, now: new Date().toISOString(), plan: detail ? { id: detail.plan.id, name: detail.plan.name } : null, day, items, exercises: exercises.data ?? [], last },
        newId,
      )
      await insertSession(session)
      return session.id
    },
    onSuccess: (id) => navigate(`/palestra/allenamento/${id}`, { replace: true }),
  })

  if (plans.isPending || active.isPending || exercises.isPending) return <><ScreenHeader title="Inizia allenamento" backTo="/palestra" /><div className="px-5 pt-4"><ListSkeleton rows={3} /></div></>
  if (plans.isError || active.isError || exercises.isError) {
    return <><ScreenHeader title="Inizia allenamento" backTo="/palestra" /><div className="px-5 pt-4"><ErrorState message={errorMessage(plans.error ?? active.error ?? exercises.error)} onRetry={() => { void plans.refetch(); void active.refetch(); exercises.refetch() }} /></div></>
  }

  if (active.data) {
    return (
      <>
        <ScreenHeader title="Inizia allenamento" backTo="/palestra" />
        <div className="space-y-3 px-5 pt-4">
          <div className={`${cardClass} space-y-3 p-4`}>
            <p className="text-[15px]">Hai già un allenamento in corso{active.data.dayName ? `: ${active.data.dayName}` : ''}. Terminalo (o eliminalo) prima di iniziarne un altro.</p>
            <Link to={`/palestra/allenamento/${active.data.id}`} className={`${primaryButtonClass} flex items-center justify-center`}>
              Riprendi allenamento
            </Link>
          </div>
        </div>
      </>
    )
  }

  const activePlans = (plans.data ?? []).filter((item) => !item.isArchived)
  const days = plan.data?.days ?? []
  const lastDayId = recent.data?.find((session) => session.planId === planId)?.dayId ?? null
  const suggested = suggestDay(days, isoWeekday(today), lastDayId)

  return (
    <>
      <ScreenHeader title="Inizia allenamento" backTo="/palestra" />
      <div className="space-y-3 px-5 pt-4">
        {!planId && (
          <>
            <p className="text-[15px] text-ink-2">Scegli la scheda.</p>
            {activePlans.length === 0 && <EmptyState text="Non hai ancora una scheda. Creane una, oppure fai una sessione libera." />}
            <ul className="space-y-2">
              {activePlans.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setPlanId(item.id)} className={`${cardClass} flex min-h-16 w-full items-center justify-between px-4 py-3 text-left`}>
                    <span>
                      <span className="block text-[17px] font-extrabold">{item.name}</span>
                      <span className="block text-[13px] text-muted">{item.dayCount === 1 ? '1 giorno' : `${item.dayCount} giorni`}</span>
                    </span>
                    <span aria-hidden="true" className="text-[20px] text-muted">›</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" disabled={start.isPending} onClick={() => start.mutate({ day: null })} className={secondaryButtonClass}>
              Sessione libera (senza scheda)
            </button>
          </>
        )}
        {planId && (
          <>
            <p className="text-[15px] text-ink-2">Scegli il giorno. Il consigliato è solo un suggerimento.</p>
            {plan.isPending && <ListSkeleton rows={3} />}
            {plan.isError && <ErrorState message={errorMessage(plan.error)} onRetry={() => void plan.refetch()} />}
            <ul className="space-y-2">
              {days.map((day) => {
                const count = plan.data?.items.filter((item) => item.dayId === day.id).length ?? 0
                return (
                  <li key={day.id}>
                    <button type="button" disabled={start.isPending} onClick={() => start.mutate({ day })} className={`${cardClass} flex min-h-16 w-full items-center justify-between px-4 py-3 text-left ${suggested === day.id ? 'border-2 border-green' : ''}`}>
                      <span>
                        <span className="block text-[17px] font-extrabold">{day.name}</span>
                        <span className="block text-[13px] text-muted">
                          {day.weekday ? `${weekdayLabel(day.weekday)} · ` : ''}
                          {count === 1 ? '1 esercizio' : `${count} esercizi`}
                        </span>
                      </span>
                      {suggested === day.id && <span className="rounded-full bg-green px-2 py-0.5 text-[12px] font-bold text-surface">Consigliato</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button type="button" onClick={() => setPlanId(null)} className={secondaryButtonClass}>
              Cambia scheda
            </button>
          </>
        )}
        {start.isPending && <p role="status" className="text-[13px] text-muted">Preparo l’allenamento…</p>}
        {start.isError && <FormMessage kind="error">{errorMessage(start.error)}</FormMessage>}
      </div>
    </>
  )
}
