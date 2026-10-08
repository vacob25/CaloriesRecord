import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Field } from '../../components/Field'
import { FormMessage } from '../../components/States'
import { cardClass, primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useContainers, useDeleteContainer, useUpdateWaterGoal } from '../../data/queries'
import type { Profile } from '../../data/types'
import { formatWater, goalToText, validateWaterGoal } from '../../lib/water'

/** Obiettivo acqua (facoltativo, lo sceglie l'utente: ADR-049) e contenitori personali. */
export function WaterSection({ profile }: { profile: Profile }) {
  const updateGoal = useUpdateWaterGoal()
  const containers = useContainers()
  const remove = useDeleteContainer()
  const [goalText, setGoalText] = useState(goalToText(profile.waterGoalMl))
  const [goalError, setGoalError] = useState<string | undefined>()
  const ref = useRef<HTMLElement>(null)

  // Arrivando da Oggi con #acqua la scheda si porta in vista.
  useEffect(() => {
    if (window.location.hash === '#acqua') ref.current?.scrollIntoView({ block: 'start' })
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateWaterGoal(goalText)
    if (!result.ok) return setGoalError(result.message)
    setGoalError(undefined)
    updateGoal.mutate(result.value)
  }

  return (
    <section ref={ref} id="acqua" aria-labelledby="water-settings-title" className={`${cardClass} mx-5 mt-4 p-5`}>
      <h2 id="water-settings-title" className="mb-4 text-[18px] font-extrabold">
        Acqua
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <Field
          id="water-goal"
          label="Obiettivo giornaliero (facoltativo)"
          hint="Lascia vuoto per non avere un obiettivo. L'app non ne propone uno."
          inputMode="decimal"
          autoComplete="off"
          suffix="L"
          value={goalText}
          onChange={(event) => setGoalText(event.target.value)}
          error={goalError}
        />
        {updateGoal.isError && <FormMessage kind="error">{errorMessage(updateGoal.error)}</FormMessage>}
        <button type="submit" disabled={updateGoal.isPending} className={`${primaryButtonClass} mt-4`}>
          {updateGoal.isPending ? 'Salvataggio…' : 'Salva obiettivo'}
        </button>
        {updateGoal.isSuccess && (
          <p role="status" className="mt-3 text-[13px] font-semibold text-green-dark">
            Salvato.
          </p>
        )}
      </form>

      <h3 className="mt-6 text-[15px] font-bold">I tuoi contenitori</h3>
      {containers.data && containers.data.length === 0 && (
        <p className="mt-1 text-[13px] text-muted">
          Nessuno. In Oggi → Acqua → "Altra quantità" puoi salvarne uno (es. la borraccia).
        </p>
      )}
      {containers.isError && <FormMessage kind="error">{errorMessage(containers.error)}</FormMessage>}
      <ul className="mt-2 divide-y divide-line">
        {(containers.data ?? []).map((container) => (
          <li key={container.id} className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-[15px]">
              {container.name} <span className="text-muted">· {formatWater(container.ml)}</span>
            </span>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate(container.id)}
              aria-label={`Elimina il contenitore ${container.name}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {remove.isError && <FormMessage kind="error">{errorMessage(remove.error)}</FormMessage>}
    </section>
  )
}
