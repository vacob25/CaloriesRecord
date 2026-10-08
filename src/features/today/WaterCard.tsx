import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState } from '../../components/States'
import { WaterIcon } from '../../components/WaterIcon'
import { cardClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useAddWater, useContainers, useDeleteWater, useProfile, useWater } from '../../data/queries'
import { DEFAULT_CONTAINERS, formatWater, waterProgress, waterTotal, type Container } from '../../lib/water'
import { WaterSheet } from './WaterSheet'

/** Acqua del giorno (step 15): un tocco per contenitore, quantità libera, annulla l'ultima aggiunta. */
export function WaterCard({ date }: { date: string }) {
  const water = useWater(date)
  const containers = useContainers()
  const profile = useProfile()
  const add = useAddWater(date)
  const remove = useDeleteWater()
  const [custom, setCustom] = useState(false)

  const entries = water.data ?? []
  const total = waterTotal(entries)
  const goal = profile.data?.waterGoalMl ?? null
  const progress = waterProgress(total, goal)
  const last = entries.at(-1)
  const all: Container[] = [
    ...DEFAULT_CONTAINERS,
    ...(containers.data ?? []).map((container) => ({ ...container, icon: 'flask' as const })),
  ]
  const busy = add.isPending || remove.isPending

  return (
    <section aria-labelledby="water-title" className={`${cardClass} mx-5 mt-4 px-5 py-4`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="water-title" className="text-[18px] font-extrabold">
          Acqua
        </h2>
        <p className="text-[15px] tabular-nums text-ink-2" aria-live="polite">
          <span className="text-[18px] font-extrabold text-ink">{formatWater(total)}</span>
          {goal !== null && <> di {formatWater(goal)}</>}
        </p>
      </div>
      {progress ? (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-blue" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {progress.remainingMl > 0 ? `Mancano ${formatWater(progress.remainingMl)}` : 'Obiettivo raggiunto'}
          </p>
        </>
      ) : (
        profile.isSuccess && (
          <Link to="/profilo#acqua" className="mt-1 flex min-h-11 items-center text-[13px] font-semibold text-green-dark">
            Imposta un obiettivo d'acqua (facoltativo)
          </Link>
        )
      )}

      {water.isError && <ErrorState message={errorMessage(water.error)} onRetry={() => void water.refetch()} />}
      {(add.isError || remove.isError) && <ErrorState message={errorMessage(add.error ?? remove.error)} />}

      <ul className="mt-3 grid grid-cols-3 gap-2">
        {all.map((container) => (
          <li key={container.id ?? container.name}>
            <button
              type="button"
              disabled={busy || !water.isSuccess}
              onClick={() => add.mutate(container.ml)}
              className="flex min-h-20 w-full flex-col items-center justify-center gap-0.5 rounded-button border border-line bg-bg px-1 py-2 text-blue disabled:opacity-60"
            >
              <span className="sr-only">Aggiungi </span>
              <WaterIcon icon={container.icon} />
              <span className="w-full truncate text-center text-[13px] font-semibold text-ink">{container.name}</span>
              <span className="text-[13px] tabular-nums text-muted">{formatWater(container.ml)}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={busy || !water.isSuccess}
            onClick={() => setCustom(true)}
            className="flex min-h-20 w-full flex-col items-center justify-center gap-0.5 rounded-button border border-dashed border-line px-1 py-2 text-green-dark disabled:opacity-60"
          >
            <WaterIcon icon="plus" />
            <span className="text-[13px] font-semibold">Altra quantità</span>
          </button>
        </li>
      </ul>

      {last && (
        <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-muted">
          <span>Ultima aggiunta: {formatWater(last.ml)}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => remove.mutate(last.id)}
            aria-label={`Annulla l'ultima aggiunta d'acqua (${formatWater(last.ml)})`}
            className="min-h-11 px-2 text-[15px] font-semibold text-green-dark disabled:opacity-60"
          >
            Annulla
          </button>
        </div>
      )}

      {custom && (
        <WaterSheet
          date={date}
          existingNames={all.map((container) => container.name)}
          onClose={() => setCustom(false)}
        />
      )}
    </section>
  )
}
