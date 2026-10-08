import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState } from '../../components/States'
import { WaterIcon } from '../../components/WaterIcon'
import { cardClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useAddWater, useContainers, useDeleteWater, useProfile, useWater } from '../../data/queries'
import { countFor, DEFAULT_CONTAINERS, formatWater, freeTotal, lastFor, waterProgress, waterTotal, type Container } from '../../lib/water'
import { WaterSheet } from './WaterSheet'

const stepButton =
  'flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-bg text-[22px] font-bold text-ink disabled:opacity-40'

/** Acqua del giorno (step 15, contatori dallo step 17): per ogni contenitore "− N +", più le quantità libere. */
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
  const all: Container[] = [
    ...DEFAULT_CONTAINERS,
    ...(containers.data ?? []).map((container) => ({ key: container.id, name: container.name, ml: container.ml, icon: 'flask' as const })),
  ]
  const busy = add.isPending || remove.isPending || !water.isSuccess
  const free = freeTotal(entries)
  const lastFree = lastFor(entries, null)

  function increase(container: Container) {
    remove.reset()
    add.mutate({ ml: container.ml, container: container.key })
  }

  function decrease(key: string | null) {
    const last = lastFor(entries, key)
    if (!last) return
    add.reset()
    remove.mutate(last.id)
  }

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

      <ul className="mt-2 divide-y divide-line">
        {all.map((container) => {
          const count = countFor(entries, container.key)
          return (
            <li key={container.key} className="flex min-h-14 items-center gap-3 py-1">
              <span className="text-blue">
                <WaterIcon icon={container.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{container.name}</span>
                <span className="block text-[13px] tabular-nums text-muted">{formatWater(container.ml)}</span>
              </span>
              <button
                type="button"
                disabled={busy || count === 0}
                onClick={() => decrease(container.key)}
                aria-label={`Togli ${container.name}`}
                className={stepButton}
              >
                −
              </button>
              <span className="w-7 text-center text-[18px] font-extrabold tabular-nums">
                {count}
                <span className="sr-only"> {container.name.toLowerCase()} oggi</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => increase(container)}
                aria-label={`Aggiungi ${container.name}`}
                className={stepButton}
              >
                +
              </button>
            </li>
          )
        })}
        <li className="flex min-h-14 items-center gap-3 py-1">
          <span className="text-green-dark">
            <WaterIcon icon="plus" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Altra quantità</span>
            <span className="block text-[13px] tabular-nums text-muted">{free > 0 ? `${formatWater(free)} oggi` : 'quantità libera o nuovo contenitore'}</span>
          </span>
          <button
            type="button"
            disabled={busy || !lastFree}
            onClick={() => decrease(null)}
            aria-label={lastFree ? `Togli l'ultima quantità libera (${formatWater(lastFree.ml)})` : 'Togli l’ultima quantità libera'}
            className={stepButton}
          >
            −
          </button>
          <span className="w-7 text-center text-[18px] font-extrabold tabular-nums">
            {countFor(entries, null)}
            <span className="sr-only"> quantità libere oggi</span>
          </span>
          <button type="button" disabled={busy} onClick={() => setCustom(true)} aria-label="Altra quantità o nuovo contenitore" className={stepButton}>
            +
          </button>
        </li>
      </ul>

      {custom && <WaterSheet date={date} existingNames={all.map((container) => container.name)} onClose={() => setCustom(false)} />}
    </section>
  )
}
