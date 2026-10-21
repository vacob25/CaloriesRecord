import { useState } from 'react'

import { cardClass, inputClass } from '../../components/ui'
import type { PlanExerciseView } from './planViews'
import { EQUIPMENT_LABEL, muscleLabels } from '../../lib/exercises'
import { formatNumber } from '../../lib/numbers'
import {
  EXERCISE_NOTE_MAX,
  MAX_SETS,
  MIN_SETS,
  addSet,
  describeSets,
  effectiveReps,
  formatRest,
  parseRepsCount,
  parseRest,
  parseWeight,
  removeSet,
  setRepsAt,
  setWeightAt,
  type PlanExercise,
  type SetsPatch,
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
const weightText = (weight: number | null) => (weight === null ? '' : formatNumber(weight, 1))

/**
 * Un esercizio nel giorno di una scheda: una riga per serie con ripetizioni (a sinistra) e peso (a destra), "Aggiungi serie"
 * (copia l'ultima), recupero, nota, riordino e rimozione. I campi di testo si salvano quando si esce dal campo; un valore non valido resta scritto, con il motivo.
 */
export function PlanExerciseCard({ item, view, index, count, busy, onUpdate, onMove, onRemove }: Props) {
  const [reps, setReps] = useState(() => effectiveReps(item).map(String))
  const [rest, setRest] = useState(formatRest(item.restSeconds))
  const [note, setNote] = useState(item.note)
  const [weights, setWeights] = useState(() => Array.from({ length: item.sets }, (_, serie) => weightText(item.weightsKg[serie] ?? null)))
  const [errors, setErrors] = useState<{ rest?: string; reps: Record<number, string>; weights: Record<number, string> }>({ reps: {}, weights: {} })
  const [confirmRemove, setConfirmRemove] = useState(false)

  /** Dopo aggiungi/togli serie le bozze dei campi si riallineano alla scheda. */
  const applySets = (patch: SetsPatch) => {
    setReps(patch.repsPerSet.map(String))
    setWeights(Array.from({ length: patch.sets }, (_, serie) => weightText(patch.weightsKg[serie] ?? null)))
    setErrors((current) => ({ ...current, reps: {}, weights: {} }))
    onUpdate(patch)
  }
  const commitReps = (serie: number) => {
    const result = parseRepsCount(reps[serie] ?? '')
    setErrors((current) => ({ ...current, reps: { ...current.reps, [serie]: result.ok ? '' : result.message } }))
    if (!result.ok) return
    if (result.value !== effectiveReps(item)[serie]) onUpdate(setRepsAt(item, serie, result.value))
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

      <div role="group" aria-label={`Serie di ${view.name}`} className="space-y-2">
        <div className="grid grid-cols-[3.5rem_1fr_1fr_2.75rem] items-end gap-2 text-[13px] font-semibold text-ink-2" aria-hidden="true">
          <span>Serie</span>
          <span>Ripetizioni</span>
          <span>Chili</span>
          <span />
        </div>
        {Array.from({ length: item.sets }, (_, serie) => (
          <div key={serie}>
            <div className="grid grid-cols-[3.5rem_1fr_1fr_2.75rem] items-center gap-2">
              <span className="text-[15px] font-bold">{serie + 1}</span>
              <input
                aria-label={`Ripetizioni serie ${serie + 1}`}
                inputMode="numeric"
                value={reps[serie] ?? ''}
                onChange={(event) => setReps((current) => Object.assign([...current], { [serie]: event.target.value }))}
                onBlur={() => commitReps(serie)}
                aria-invalid={errors.reps[serie] ? true : undefined}
                autoComplete="off"
                className={`${inputClass} text-center`}
              />
              <input
                aria-label={`Chili serie ${serie + 1}`}
                inputMode="decimal"
                value={weights[serie] ?? ''}
                onChange={(event) => setWeights((current) => Object.assign([...current], { [serie]: event.target.value }))}
                onBlur={() => commitWeight(serie)}
                aria-invalid={errors.weights[serie] ? true : undefined}
                placeholder="kg"
                autoComplete="off"
                className={`${inputClass} text-center`}
              />
              <button type="button" aria-label={`Togli serie ${serie + 1} di ${view.name}`} disabled={busy || item.sets <= MIN_SETS} onClick={() => applySets(removeSet(item, serie))} className={`${iconButton} size-11 text-[18px]`}>
                ×
              </button>
            </div>
            {(errors.reps[serie] || errors.weights[serie]) && (
              <p role="alert" className="mt-1 text-[13px] font-semibold text-ink">
                <span aria-hidden="true">⚠︎ </span>
                {errors.reps[serie] || errors.weights[serie]}
              </p>
            )}
          </div>
        ))}
        <button type="button" disabled={busy || item.sets >= MAX_SETS} onClick={() => applySets(addSet(item))} className="min-h-11 w-full rounded-button border-2 border-green px-4 text-[15px] font-bold text-green-dark disabled:opacity-50">
          + Aggiungi serie
        </button>
      </div>

      <div>
        <label htmlFor={`${id}-rest`} className={smallLabel}>
          Recupero
        </label>
        <input id={`${id}-rest`} inputMode="text" value={rest} onChange={(event) => setRest(event.target.value)} onBlur={commitRest} aria-invalid={errors.rest ? true : undefined} aria-describedby={errors.rest ? `${id}-rest-err` : undefined} placeholder="1:30" autoComplete="off" className={inputClass} />
        {errors.rest && (
          <p id={`${id}-rest-err`} role="alert" className="mt-1 text-[13px] font-semibold text-ink">
            <span aria-hidden="true">⚠︎ </span>
            {errors.rest}
          </p>
        )}
      </div>

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
