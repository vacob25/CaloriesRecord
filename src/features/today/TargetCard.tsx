import { useState } from 'react'

import { MacroBar } from '../../components/MacroBar'
import { Ring } from '../../components/Ring'
import { ErrorState, FormMessage } from '../../components/States'
import { WeightPill } from '../../components/WeightPill'
import { cardClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useDayTarget, useSetTrainingType } from '../../data/queries'
import type { DailyTarget } from '../../data/types'
import { TRAINING_LABEL, TRAINING_TYPES, type TrainingType } from '../../lib/labels'
import { formatNumber } from '../../lib/numbers'
import { isLowCarbs, type Nutrients } from '../../lib/nutrition'
import { progress, ringStatus } from '../../lib/targets'

interface TargetCardProps {
  date: string
  eaten: Nutrients
}

/** Card riepilogo di Oggi: anello con le kcal restanti, obiettivo, tipo di giorno e barre macro. */
export function TargetCard({ date, eaten }: TargetCardProps) {
  const target = useDayTarget(date)

  if (target.isPending) {
    return <div role="status" aria-label="Caricamento" className={`${cardClass} mx-5 mt-4 h-72 animate-pulse`} />
  }
  if (target.isError) return <ErrorState message={errorMessage(target.error)} onRetry={() => void target.refetch()} />
  if (target.data.status !== 'ready') {
    return (
      <section className={`${cardClass} mx-5 mt-4 p-5`}>
        <p className="text-[15px] text-ink-2">Registra il peso di oggi: serve per calcolare il tuo obiettivo di calorie.</p>
        <div className="mt-3">
          <WeightPill date={date} />
        </div>
      </section>
    )
  }
  return <ReadyTarget target={target.data.target} weightKg={target.data.weightKg} eaten={eaten} date={date} />
}

function ReadyTarget({ target, weightKg, eaten, date }: { target: DailyTarget; weightKg: number | null; eaten: Nutrients; date: string }) {
  const ring = ringStatus(eaten.kcal, target.targetKcal)
  const lowCarbs = weightKg !== null && isLowCarbs(target.carbs, weightKg)
  const centerLabel =
    ring.over > 0 ? `Oltre di ${formatNumber(ring.over)} kcal` : `${formatNumber(ring.remaining)} kcal restanti`

  return (
    <section aria-label="Riepilogo del giorno" className={`${cardClass} mx-5 mt-4 p-5`}>
      <div className="flex items-center gap-4">
        <Ring fraction={ring.fraction} label={`${centerLabel} su ${formatNumber(target.targetKcal)}`}>
          {ring.over > 0 ? (
            <>
              <span className="text-[13px] font-semibold text-ink-2">oltre di</span>
              <span className="text-[32px] font-extrabold leading-none tabular-nums">{formatNumber(ring.over)}</span>
              <span className="text-[13px] font-semibold text-ink-2">kcal</span>
            </>
          ) : (
            <>
              <span className="text-[32px] font-extrabold leading-none tabular-nums">{formatNumber(ring.remaining)}</span>
              <span className="mt-1 text-[13px] font-semibold text-ink-2">kcal restanti</span>
            </>
          )}
        </Ring>
        <dl className="min-w-0 flex-1 space-y-2 text-[13px]">
          <div>
            <dt className="text-ink-2">Obiettivo</dt>
            <dd className="text-[18px] font-extrabold tabular-nums">{formatNumber(target.targetKcal)} kcal</dd>
          </div>
          <div>
            <dt className="text-ink-2">Mangiate</dt>
            <dd className="text-[18px] font-extrabold tabular-nums">{formatNumber(eaten.kcal)} kcal</dd>
          </div>
        </dl>
      </div>

      <TrainingTypeBadge date={date} type={target.trainingType} />

      <div className="mt-4 space-y-3">
        <MacroBar label="Proteine" eaten={eaten.protein} goal={target.protein} progress={progress(eaten.protein, target.protein)} colorClass="bg-blue" />
        <MacroBar label="Carboidrati" eaten={eaten.carbs} goal={target.carbs} progress={progress(eaten.carbs, target.carbs)} colorClass="bg-orange" />
        <MacroBar label="Grassi" eaten={eaten.fat} goal={target.fat} progress={progress(eaten.fat, target.fat)} colorClass="bg-magenta" />
      </div>
      {lowCarbs && (
        <FormMessage kind="warning">
          carboidrati sotto 3 g per kg di peso: l’obiettivo è basso per aumentare massa. Controlla i parametri nel Profilo.
        </FormMessage>
      )}
    </section>
  )
}

/** Badge del tipo di giorno: un tocco apre la scelta; cambia il target del solo giorno. */
function TrainingTypeBadge({ date, type }: { date: string; type: TrainingType }) {
  const [open, setOpen] = useState(false)
  const setType = useSetTrainingType(date)
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="min-h-11 rounded-full bg-green-tint px-4 text-[13px] font-bold text-green-dark"
      >
        Giorno: {TRAINING_LABEL[type]} {open ? '▴' : '▾'}
      </button>
      {open && (
        <fieldset className="mt-2">
          <legend className="sr-only">Tipo di giorno</legend>
          <div className="grid grid-cols-2 gap-2">
            {TRAINING_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === type}
                disabled={setType.isPending}
                onClick={() => setType.mutate(option, { onSuccess: () => setOpen(false) })}
                className={`min-h-11 rounded-button border px-3 text-[13px] font-semibold ${
                  option === type ? 'border-green bg-green-tint text-green-dark' : 'border-line bg-surface text-ink-2'
                }`}
              >
                {TRAINING_LABEL[option]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">Nei giorni di allenamento si aggiunge il bonus (uno solo). Cambia solo oggi.</p>
          {setType.isError && <FormMessage kind="error">{errorMessage(setType.error)}</FormMessage>}
        </fieldset>
      )}
    </div>
  )
}
