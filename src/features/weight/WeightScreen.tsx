import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass, dangerButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { WeightChart } from '../../components/WeightChart'
import { WeightPill } from '../../components/WeightPill'
import { errorMessage } from '../../data/dbErrors'
import { useDeleteWeight, useProfile, useWeights } from '../../data/queries'
import { addDays, formatLongDate } from '../../lib/dates'
import { describeTargetRate } from '../../lib/goals'
import { formatNumber } from '../../lib/numbers'
import {
  distanceToGoal,
  lastLogOnOrBefore,
  movingAverage7,
  recentWeightSummary,
  slopeKgPerWeek,
  weightSeries,
} from '../../lib/weight'
import { weightSummary } from '../../lib/weightText'

const RANGES = [
  { days: 28, label: '4 settimane' },
  { days: 90, label: '3 mesi' },
] as const

/** /peso — pesate grezze e media mobile, distanza dal traguardo, pendenza. */
export function WeightScreen() {
  // Si torna da dove si è arrivati: Oggi (pillola del peso) o Statistiche (step 13).
  const backTo = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const today = useToday()
  const [range, setRange] = useState<28 | 90>(28)
  // 6 giorni in più prima dell'intervallo: servono alla media mobile del primo giorno.
  const weights = useWeights(addDays(today, -(Math.max(range, 28) + 6)))
  const profile = useProfile()

  const logs = weights.data ?? []
  const from = addDays(today, -(range - 1))
  const points = weightSeries(logs, from, today)
  const average = movingAverage7(logs, today)
  const last = lastLogOnOrBefore(logs, today)
  const current = average ?? last?.kg ?? null
  const slope = slopeKgPerWeek(logs, today)
  const goal = profile.data?.goalWeightKg ?? null
  const distance = current !== null && goal !== null ? distanceToGoal(current, goal) : null
  const recent = recentWeightSummary(logs, today)

  return (
    <>
      <ScreenHeader title="Peso" backTo={backTo} action={<WeightPill date={today} showTrendLink={false} />} />
      <p className="px-5 pt-1 text-[13px] font-semibold text-ink-2">Conta la tendenza, non la singola pesata.</p>

      {weights.isPending && <ListSkeleton rows={3} />}
      {weights.isError && <ErrorState message={errorMessage(weights.error)} onRetry={() => void weights.refetch()} />}
      {weights.isSuccess && logs.length === 0 && <EmptyState text="Nessuna pesata. Registra il peso di oggi, al mattino a digiuno." />}

      {weights.isSuccess && logs.length > 0 && (
        <>
          <dl className="grid grid-cols-3 gap-2 px-5 pt-4">
            <Stat
              label="Media 7 giorni"
              value={average === null ? '—' : `${formatNumber(average, 1)} kg`}
              note={average === null ? 'servono 4 pesate in 7 giorni' : undefined}
            />
            <Stat
              label="Andamento"
              value={slope === null ? '—' : `${slope > 0 ? '+' : ''}${formatNumber(slope, 2)} kg/sett.`}
              note={slope === null ? 'servono 10 pesate in 28 giorni' : `obiettivo: ${describeTargetRate({ goal: profile.data?.goal ?? 'bulk', surplusPct: profile.data?.surplusPct ?? 0, cutRatePct: profile.data?.cutRatePct ?? 0 }, current)}`}
            />
            <Stat
              label="Al traguardo"
              value={
                distance === null
                  ? '—'
                  : distance.direction === 'reached'
                    ? 'raggiunto'
                    : `${distance.direction === 'up' ? '+' : '−'}${formatNumber(distance.kg, 1)} kg`
              }
              note={goal === null ? 'imposta il peso obiettivo nel Profilo' : `obiettivo ${formatNumber(goal, 1)} kg`}
            />
          </dl>

          <section aria-labelledby="recent-title" className={`${cardClass} mx-5 mt-4 p-4`}>
            <h2 id="recent-title" className="text-[15px] font-bold">
              Ultimi 5 giorni
            </h2>
            <p className="mt-1 text-[15px] text-ink">
              {recent.count === 0
                ? 'Nessuna pesata negli ultimi 5 giorni.'
                : `${recent.count} ${recent.count === 1 ? 'pesata' : 'pesate'}, media ${formatNumber(recent.average ?? 0, 1)} kg`}
              {recent.change !== null && (
                <span className="text-ink-2">
                  {' '}
                  · {recent.change > 0 ? '+' : recent.change < 0 ? '−' : ''}
                  {formatNumber(Math.abs(recent.change), 1)} kg rispetto ai 5 giorni prima
                </span>
              )}
            </p>
          </section>

          <section aria-labelledby="chart-title" className={`${cardClass} mx-5 mt-4 p-4`}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="chart-title" className="text-[15px] font-bold">
                Andamento
              </h2>
              <div className="flex gap-1" role="group" aria-label="Periodo">
                {RANGES.map(({ days, label }) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={range === days}
                    onClick={() => setRange(days)}
                    className={`min-h-11 rounded-full px-3 text-[13px] font-bold ${range === days ? 'bg-ink text-surface' : 'text-ink-2'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[13px] text-ink-2">{weightSummary(points)}</p>
            <div className="mt-3">
              <WeightChart points={points} goalKg={goal} summary={weightSummary(points)} />
            </div>
          </section>

          <WeightList logs={logs} />
        </>
      )}
      {goal === null && profile.isSuccess && (
        <Link to="/profilo" className="mx-5 mt-4 flex min-h-11 items-center text-[15px] font-semibold text-green-dark underline">
          Imposta il peso obiettivo per vedere la distanza dal traguardo
        </Link>
      )}
    </>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${cardClass} p-3`}>
      <dt className="text-[12px] font-semibold text-ink-2">{label}</dt>
      <dd className="mt-1 text-[16px] font-extrabold tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-[11px] text-muted">{note}</dd>}
    </div>
  )
}

/** Vista a tabella delle pesate (alternativa al grafico), con eliminazione in due tocchi. */
function WeightList({ logs }: { logs: { date: string; kg: number }[] }) {
  const remove = useDeleteWeight()
  const [confirming, setConfirming] = useState<string | null>(null)
  const recent = [...logs].reverse().slice(0, 30)
  return (
    <section aria-labelledby="list-title" className={`${cardClass} mx-5 mt-4 p-4`}>
      <h2 id="list-title" className="text-[15px] font-bold">
        Pesate
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {recent.map((log) => (
          <li key={log.date} className="flex min-h-12 items-center justify-between gap-2 py-1">
            <span className="text-[15px] first-letter:uppercase">{formatLongDate(log.date)}</span>
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-bold tabular-nums">{formatNumber(log.kg, 1)} kg</span>
              {confirming === log.date ? (
                <button type="button" onClick={() => remove.mutate(log.date)} className={`${dangerButtonClass} !min-h-11 !w-auto px-3 text-[13px]`}>
                  Elimina
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(log.date)}
                  aria-label={`Elimina la pesata del ${formatLongDate(log.date)}`}
                  className="flex size-11 items-center justify-center rounded-full text-ink-2"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {remove.isError && <FormMessage kind="error">{errorMessage(remove.error)}</FormMessage>}
    </section>
  )
}
