import { useState } from 'react'

import { cardClass, inputClass } from '../../components/ui'
import type { PlanExerciseView } from './planViews'
import { EQUIPMENT_LABEL, muscleLabels } from '../../lib/exercises'
import { formatNumber } from '../../lib/numbers'
import {
  EXERCISE_NOTE_MAX,
  MAX_SETS,
  MIN_SETS,
  describeSets,
  formatReps,
  formatRest,
  parseRest,
  parseReps,
  parseWeight,
  setWeightAt,
  withSets,
  type PlanExercise,
} from '../../lib/workoutPlans'
import type { PlanExercisePatch } from '../../data/workoutPlans'

interface Props {
  item: PlanExercise
  view: PlanExerciseView
  index: number
  count: number
  busy: boolean
  onUpdate: (patch: PlanExercisePatch) => void
  onMove: (direction: 1 | -1) => void
  onRemove: () => void
}

const iconButton = 'flex size-11 items-center justify-center rounded-full border border-line bg-surface text-[20px] font-bold disabled:opacity-40'
const smallLabel = 'block text-[13px] font-semibold text-ink-2'

/**
 * Un esercizio nel giorno di una scheda: serie con − e +, ripetizioni (un numero o 8-12), peso per serie, recupero, nota,
 * riordino e rimozione. I campi di testo si salvano quando si esce dal campo; un valore non valido resta scritto, con il motivo.
 */
export function PlanExerciseCard({ item, view, index, count, busy, onUpdate, onMove, onRemove }: Props) {
  const [reps, setReps] = useState(formatReps(item.repsMin, item.repsMax))
  const [rest, setRest] = useState(formatRest(item.restSeconds))
  const [note, setNote] = useState(item.note)
  const [weights, setWeights] = useState(() => item.weightsKg.map((weight) => (weight === null ? '' : formatNumber(weight, 1))))
  const [errors, setErrors] = useState<{ reps?: string; rest?: string; weights: Record<number, string> }>({ weights: {} })
  const [showWeights, setShowWeights] = useState(item.weightsKg.some((weight) => weight !== null))
  const [confirmRemove, setConfirmRemove] = useState(false)

  const commitReps = () => {
    const result = parseReps(reps)
    setErrors((current) => ({ ...current, reps: result.ok ? undefined : result.message }))
    if (result.ok && (result.min !== item.repsMin || result.max !== item.repsMax)) onUpdate({ repsMin: result.min, repsMax: result.max })
  }
  const commitRest = () => {
    const result = parseRest(rest)
    setErrors((current) => ({ ...current, rest: result.ok ? undefined : result.message }))
    if (result.ok && result.value !== item.restSeconds) onUpdate({ restSeconds: result.value })
  }
  const commitWeight = (serie: number) => {
    const result = parseWeight(weights[serie] ?? '')
    setErrors((current) => ({ ...current, weights: { ...current.weights, [serie]: result.ok ? '' : result.message } }))
    if (!result.ok) return
    const next = setWeightAt(item.weightsKg, serie, result.value, item.sets)
    if (JSON.stringify(next) !== JSON.stringify(item.weightsKg)) onUpdate({ weightsKg: next })
  }
  const changeSets = (delta: number) => {
    const next = withSets(item, item.sets + delta)
    if (next.sets !== item.sets) onUpdate(next)
  }
  const id = `item-${item.id}`

  return (
    <li className={`${cardClass} space-y-3 p-4`}>
      <div>
        <h3 className="text-[17px] font-extrabold leading-snug">{view.name}</h3>
        <p className="text-[13px] text-muted">
          {view.available ? `${muscleLabels(view.primaryMuscles)} · ${EQUIPMENT_LABEL[view.equipment]}` : 'Questo esercizio non è più nell’elenco.'}
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-green-dark">{describeSets(item)}</p>
      </div>

      <div className="flex items-center justify-between">
        <span id={`${id}-sets`} className="text-[15px] font-bold">
          Serie
        </span>
        <span className="flex items-center gap-2" role="group" aria-labelledby={`${id}-sets`}>
          <button type="button" aria-label={`Una serie in meno per ${view.name}`} disabled={busy || item.sets <= MIN_SETS} onClick={() => changeSets(-1)} className={iconButton}>
            −
          </button>
          <span aria-live="polite" className="w-8 text-center text-[18px] font-extrabold tabular-nums">
            {item.sets}
          </span>
          <button type="button" aria-label={`Una serie in più per ${view.name}`} disabled={busy || item.sets >= MAX_SETS} onClick={() => changeSets(1)} className={iconButton}>
            +
          </button>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-reps`} className={smallLabel}>
            Ripetizioni
          </label>
          <input id={`${id}-reps`} inputMode="text" value={reps} onChange={(event) => setReps(event.target.value)} onBlur={commitReps} aria-invalid={errors.reps ? true : undefined} aria-describedby={errors.reps ? `${id}-reps-err` : undefined} placeholder="10 o 8-12" autoComplete="off" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-rest`} className={smallLabel}>
            Recupero
          </label>
          <input id={`${id}-rest`} inputMode="text" value={rest} onChange={(event) => setRest(event.target.value)} onBlur={commitRest} aria-invalid={errors.rest ? true : undefined} aria-describedby={errors.rest ? `${id}-rest-err` : undefined} placeholder="1:30" autoComplete="off" className={inputClass} />
        </div>
      </div>
      {errors.reps && (
        <p id={`${id}-reps-err`} role="alert" className="text-[13px] font-semibold text-ink">
          <span aria-hidden="true">⚠︎ </span>
          {errors.reps}
        </p>
      )}
      {errors.rest && (
        <p id={`${id}-rest-err`} role="alert" className="text-[13px] font-semibold text-ink">
          <span aria-hidden="true">⚠︎ </span>
          {errors.rest}
        </p>
      )}

      <button type="button" aria-expanded={showWeights} onClick={() => setShowWeights((value) => !value)} className="flex min-h-11 w-full items-center justify-between text-left text-[15px] font-bold">
        <span>Peso per serie (facoltativo)</span>
        <span aria-hidden="true" className="text-[18px] text-muted">
          {showWeights ? '▾' : '▸'}
        </span>
      </button>
      {showWeights && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: item.sets }, (_, serie) => (
            <div key={serie}>
              <label htmlFor={`${id}-w${serie}`} className={smallLabel}>
                Serie {serie + 1}
              </label>
              <div className="relative">
                <input
                  id={`${id}-w${serie}`}
                  inputMode="decimal"
                  value={weights[serie] ?? ''}
                  onChange={(event) => setWeights((current) => Object.assign([...current], { [serie]: event.target.value }))}
                  onBlur={() => commitWeight(serie)}
                  aria-invalid={errors.weights[serie] ? true : undefined}
                  autoComplete="off"
                  className={`${inputClass} pr-12`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 mt-2 flex items-center text-[15px] text-muted">kg</span>
              </div>
              {errors.weights[serie] && <p role="alert" className="mt-1 text-[13px] font-semibold text-ink">{errors.weights[serie]}</p>}
            </div>
          ))}
        </div>
      )}

      <div>
        <label htmlFor={`${id}-note`} className={smallLabel}>
          Nota
        </label>
        <textarea id={`${id}-note`} value={note} maxLength={EXERCISE_NOTE_MAX} rows={2} onChange={(event) => setNote(event.target.value)} onBlur={() => note !== item.note && onUpdate({ note })} className={`${inputClass} py-3`} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="flex gap-2">
          <button type="button" aria-label={`Sposta ${view.name} su`} disabled={busy || index === 0} onClick={() => onMove(-1)} className={iconButton}>
            ▲
          </button>
          <button type="button" aria-label={`Sposta ${view.name} giù`} disabled={busy || index === count - 1} onClick={() => onMove(1)} className={iconButton}>
            ▼
          </button>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirmRemove) return setConfirmRemove(true)
            onRemove()
          }}
          className="min-h-11 rounded-button border-2 border-ink px-4 text-[14px] font-bold text-ink disabled:opacity-50"
        >
          {confirmRemove ? 'Tocca ancora per togliere' : `Togli ${view.name}`}
        </button>
      </div>
    </li>
  )
}
