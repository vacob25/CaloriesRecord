import { useState } from 'react'

import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/States'
import { cardClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { WeightChart } from '../../components/WeightChart'
import { errorMessage } from '../../data/dbErrors'
import { useProfile, useStatsData } from '../../data/queries'
import { addDays, formatShortDate } from '../../lib/dates'
import { DAY_STATUS_LABEL, MEAL_LABEL, MEAL_TYPES } from '../../lib/labels'
import { formatNumber } from '../../lib/numbers'
import { periodFor, periodLabel, type PeriodKind } from '../../lib/period'
import { periodStats } from '../../lib/stats'
import { weightSeries } from '../../lib/weight'
import { weightSummary } from '../../lib/weightText'
import { CaloriesChart } from './CaloriesChart'

export function StatsScreen() {
  const today = useToday()
  const [kind, setKind] = useState<PeriodKind>('week')
  const [offset, setOffset] = useState(0)
  const { start, end } = periodFor(kind, today, offset)
  // Grafico del peso: le 4 settimane fino alla fine del periodo (o a oggi), con 6 giorni in più per la media.
  const weightEnd = end < today ? end : today
  const weightStart = addDays(weightEnd, -27)
  const fetchFrom = addDays(start < weightStart ? start : weightStart, -6)
  const data = useStatsData(start, end, fetchFrom)
  const profile = useProfile()

  const stats = data.data
    ? periodStats(
        start,
        end,
        data.data.entries,
        new Map(data.data.targets.map((t) => [t.date, t.targetKcal])),
        data.data.weights,
      )
    : null
  const points = data.data ? weightSeries(data.data.weights, weightStart, weightEnd) : []
  const caloriesSummary = stats
    ? `${stats.registeredDays} giorni registrati, media ${formatNumber(stats.averageKcal ?? 0)} kcal, ${stats.respected.count} rispettati su ${stats.respected.of}.`
    : ''

  return (
    <>
      <ScreenHeader title="Statistiche" />
      <div className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-1 rounded-button bg-line/60 p-1" role="group" aria-label="Periodo">
          {(['week', 'month'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => {
                setKind(option)
                setOffset(0)
              }}
              className={`min-h-11 rounded-[12px] text-[15px] font-semibold ${kind === option ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
            >
              {option === 'week' ? 'Settimana' : 'Mese'}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Periodo precedente" className="flex size-11 items-center justify-center rounded-full text-[22px] text-ink-2">
            ‹
          </button>
          <p className="text-[15px] font-bold" aria-live="polite">
            {periodLabel(kind, start, end)}
          </p>
          <button
            type="button"
            onClick={() => setOffset(offset + 1)}
            disabled={offset >= 0}
            aria-label="Periodo successivo"
            className="flex size-11 items-center justify-center rounded-full text-[22px] text-ink-2 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {data.isPending && <ListSkeleton rows={3} />}
      {data.isError && <ErrorState message={errorMessage(data.error)} onRetry={() => void data.refetch()} />}
      {stats && stats.registeredDays === 0 && (
        <EmptyState text="Nessun giorno registrato in questo periodo. Le statistiche compaiono quando registri i pasti." />
      )}

      {stats && stats.registeredDays > 0 && (
        <>
          <dl className="grid grid-cols-3 gap-2 px-5 pt-3">
            <KeyNumber label="Media giornaliera" value={`${formatNumber(stats.averageKcal ?? 0)} kcal`} note={`su ${stats.registeredDays} giorni registrati`} />
            <KeyNumber
              label="Giorni rispettati"
              value={stats.respected.of > 0 ? `${stats.respected.count} su ${stats.respected.of}` : '—'}
              note="tra −5% e +10% del target"
            />
            <KeyNumber
              label="Peso"
              value={stats.weightKgPerWeek === null ? '—' : `${stats.weightKgPerWeek > 0 ? '+' : ''}${formatNumber(stats.weightKgPerWeek, 2)} kg/sett.`}
              note={stats.weightKgPerWeek === null ? 'servono 4 pesate a inizio e fine' : 'media mobile, inizio → fine'}
            />
          </dl>

          <section aria-labelledby="kcal-title" className={`${cardClass} mx-5 mt-4 p-4`}>
            <h2 id="kcal-title" className="text-[15px] font-bold">
              Calorie e target
            </h2>
            <p className="mt-1 text-[13px] text-ink-2">{caloriesSummary}</p>
            <div className="mt-3">
              <CaloriesChart days={stats.days} summary={caloriesSummary} />
            </div>
            <details className="mt-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-green-dark">Vedi i giorni in tabella</summary>
              <table className="mt-2 w-full text-left text-[13px]">
                <thead className="text-ink-2">
                  <tr>
                    <th className="py-1 font-semibold">Giorno</th>
                    <th className="py-1 text-right font-semibold">Kcal</th>
                    <th className="py-1 text-right font-semibold">Target</th>
                    <th className="py-1 pl-2 font-semibold">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.days.map((day) => (
                    <tr key={day.date}>
                      <td className="py-1.5">{formatShortDate(day.date)}</td>
                      <td className="py-1.5 text-right tabular-nums">{day.status === 'unregistered' ? '—' : formatNumber(day.kcal)}</td>
                      <td className="py-1.5 text-right tabular-nums">{day.target === null ? '—' : formatNumber(day.target)}</td>
                      <td className="py-1.5 pl-2">{DAY_STATUS_LABEL[day.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <section aria-labelledby="weight-title" className={`${cardClass} mx-5 mt-4 p-4`}>
            <h2 id="weight-title" className="text-[15px] font-bold">
              Peso, 4 settimane
            </h2>
            <p className="mt-1 text-[13px] text-ink-2">{weightSummary(points)}</p>
            {points.some((p) => p.kg !== null) && (
              <div className="mt-3">
                <WeightChart points={points} goalKg={profile.data?.goalWeightKg ?? null} summary={weightSummary(points)} />
              </div>
            )}
          </section>

          <section aria-labelledby="meals-title" className={`${cardClass} mx-5 mt-4 p-4`}>
            <h2 id="meals-title" className="text-[15px] font-bold">
              Calorie per pasto
            </h2>
            <ul className="mt-3 space-y-3">
              {MEAL_TYPES.map((meal) => (
                <li key={meal}>
                  <div className="flex justify-between text-[13px]">
                    <span className="font-semibold text-ink-2">{MEAL_LABEL[meal]}</span>
                    <span className="font-bold tabular-nums">{formatNumber(stats.mealShare[meal] * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <div className="h-full rounded-full bg-green" style={{ width: `${Math.round(stats.mealShare[meal] * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {stats.averageMacros && (
              <p className="mt-4 text-[13px] text-ink-2">
                Macro medie al giorno: P {formatNumber(stats.averageMacros.protein)} g · C {formatNumber(stats.averageMacros.carbs)} g · G{' '}
                {formatNumber(stats.averageMacros.fat)} g
              </p>
            )}
          </section>

          <section aria-labelledby="foods-title" className={`${cardClass} mx-5 mt-4 p-4`}>
            <h2 id="foods-title" className="text-[15px] font-bold">
              Cibi più frequenti
            </h2>
            <ol className="mt-2 divide-y divide-line">
              {stats.topFoods.map((food) => (
                <li key={food.name} className="flex min-h-11 items-center justify-between gap-2 py-1 text-[15px]">
                  <span className="truncate">{food.name}</span>
                  <span className="shrink-0 text-[13px] text-ink-2">
                    {food.count} {food.count === 1 ? 'volta' : 'volte'}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  )
}

function KeyNumber({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={`${cardClass} p-3`}>
      <dt className="text-[12px] font-semibold text-ink-2">{label}</dt>
      <dd className="mt-1 text-[16px] font-extrabold tabular-nums">{value}</dd>
      <dd className="mt-1 text-[11px] text-muted">{note}</dd>
    </div>
  )
}
