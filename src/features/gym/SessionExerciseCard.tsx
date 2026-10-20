import { useState } from 'react'

import { cardClass, inputClass } from '../../components/ui'
import { EQUIPMENT_LABEL, muscleLabels } from '../../lib/exercises'
import { formatNumber } from '../../lib/numbers'
import { formatRest, parseWeight, formatReps } from '../../lib/workoutPlans'
import {
  SET_KIND_LABEL,
  STATUS_LABEL,
  parseDoneReps,
  summarizeLast,
  type ExerciseStatus,
  type LastTime,
  type SessionExercise,
  type SessionSet,
  type SetKind,
} from '../../lib/workoutSession'

interface Props {
  exercise: SessionExercise
  last: LastTime | undefined
  disabled: boolean
  onStatus: (status: ExerciseStatus) => void
  onSetValues: (setId: string, patch: { weightKg?: number | null; reps?: number | null; kind?: SetKind }) => void
  onToggleDone: (setId: string) => void
  onAddSet: () => void
  onRemoveSet: (setId: string) => void
  onNote: (note: string) => void
  onRemove: () => void
}

const STATUSES: ExerciseStatus[] = ['todo', 'done', 'skipped']
const tiny = 'block text-[12px] font-semibold text-ink-2'

/** Un esercizio nella sessione: stato (da fare / fatto / saltato), serie con tipo, peso, ripetizioni e spunta, nota. */
export function SessionExerciseCard({ exercise, last, disabled, onStatus, onSetValues, onToggleDone, onAddSet, onRemoveSet, onNote, onRemove }: Props) {
  const [note, setNote] = useState(exercise.note)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const skipped = exercise.status === 'skipped'
  const lastText = summarizeLast(last)
  const planned =
    exercise.plannedSets !== null && exercise.plannedRepsMin !== null
      ? `Previsto: ${exercise.plannedSets}×${formatReps(exercise.plannedRepsMin, exercise.plannedRepsMax)}${exercise.plannedRestSeconds ? ` · recupero ${formatRest(exercise.plannedRestSeconds)}` : ''}`
      : null

  return (
    <li className={`${cardClass} space-y-3 p-4 ${skipped ? 'border-2 border-dashed border-ink' : ''}`}>
      <div>
        <h3 className="text-[17px] font-extrabold leading-snug">
          {exercise.name}
          {skipped && <span className="ml-2 rounded-full border-2 border-ink px-2 py-0.5 align-middle text-[11px] font-extrabold uppercase">Saltato</span>}
        </h3>
        <p className="text-[13px] text-muted">
          {muscleLabels(exercise.primaryMuscles)} · {EQUIPMENT_LABEL[exercise.equipment]}
        </p>
        {planned && <p className="text-[13px] text-ink-2">{planned}</p>}
        {lastText && last && (
          <p className="text-[13px] font-semibold text-green-dark">
            Ultima volta: {lastText}
          </p>
        )}
      </div>

      <div role="group" aria-label={`Stato di ${exercise.name}`} className="grid grid-cols-3 gap-2">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={exercise.status === status}
            disabled={disabled}
            onClick={() => onStatus(status)}
            className={`min-h-11 rounded-button border px-2 text-[14px] font-bold ${exercise.status === status ? 'border-green bg-green text-surface' : 'border-line bg-surface text-ink'}`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      {!skipped && (
        <ul className="space-y-2">
          {exercise.sets.map((set) => (
            <SetRow key={set.id} set={set} exerciseName={exercise.name} disabled={disabled} onValues={onSetValues} onToggle={() => onToggleDone(set.id)} onRemove={() => onRemoveSet(set.id)} />
          ))}
          <li>
            <button type="button" disabled={disabled} onClick={onAddSet} className="min-h-11 w-full rounded-button border border-line bg-surface px-4 text-[14px] font-bold text-ink disabled:opacity-50">
              + Aggiungi serie
            </button>
          </li>
        </ul>
      )}

      <div>
        <label htmlFor={`note-${exercise.id}`} className={tiny}>
          Nota
        </label>
        <textarea id={`note-${exercise.id}`} rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => note !== exercise.note && onNote(note)} className={`${inputClass} py-3`} />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!confirmRemove) return setConfirmRemove(true)
          onRemove()
        }}
        className="min-h-11 w-full rounded-button border-2 border-ink px-4 text-[14px] font-bold text-ink disabled:opacity-50"
      >
        {confirmRemove ? 'Tocca ancora per togliere' : 'Togli l’esercizio'}<span className="sr-only"> {exercise.name} dalla sessione</span>
      </button>
    </li>
  )
}

function SetRow({
  set,
  exerciseName,
  disabled,
  onValues,
  onToggle,
  onRemove,
}: {
  set: SessionSet
  exerciseName: string
  disabled: boolean
  onValues: Props['onSetValues']
  onToggle: () => void
  onRemove: () => void
}) {
  const [weight, setWeight] = useState(set.weightKg === null ? '' : formatNumber(set.weightKg, 1))
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps))
  const [error, setError] = useState<string | undefined>()
  const label = `serie ${set.number} di ${exerciseName}`

  const commitWeight = () => {
    const result = parseWeight(weight)
    setError(result.ok ? undefined : result.message)
    if (result.ok && result.value !== set.weightKg) onValues(set.id, { weightKg: result.value })
  }
  const commitReps = () => {
    const result = parseDoneReps(reps)
    setError(result.ok ? undefined : result.message)
    if (result.ok && result.value !== set.reps) onValues(set.id, { reps: result.value })
  }

  return (
    <li className={`rounded-button border p-2 ${set.done ? 'border-green bg-green-tint' : 'border-line'}`}>
      <div className="flex items-end gap-2">
        <div className="w-[3.2rem] shrink-0">
          <span className={tiny}>Serie</span>
          <span className="flex min-h-11 items-center text-[16px] font-extrabold tabular-nums">{set.number}</span>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`w-${set.id}`} className={tiny}>
            kg <span className="sr-only">{label}</span>
          </label>
          <input id={`w-${set.id}`} inputMode="decimal" autoComplete="off" value={weight} onChange={(event) => setWeight(event.target.value)} onBlur={commitWeight} aria-invalid={error ? true : undefined} className={`${inputClass} !mt-0 px-3`} />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`r-${set.id}`} className={tiny}>
            rip. <span className="sr-only">{label}</span>
          </label>
          <input id={`r-${set.id}`} inputMode="numeric" autoComplete="off" value={reps} onChange={(event) => setReps(event.target.value)} onBlur={commitReps} aria-invalid={error ? true : undefined} className={`${inputClass} !mt-0 px-3`} />
        </div>
        <button
          type="button"
          aria-pressed={set.done}
          aria-label={set.done ? `Togli la spunta alla ${label}` : `Segna fatta la ${label}`}
          disabled={disabled}
          onClick={onToggle}
          className={`flex size-12 shrink-0 items-center justify-center rounded-full border-2 text-[22px] font-extrabold ${set.done ? 'border-green bg-green text-surface' : 'border-line bg-surface text-muted'}`}
        >
          ✓
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <span>Tipo</span>
          <select aria-label={`Tipo della ${label}`} value={set.kind} disabled={disabled} onChange={(event) => onValues(set.id, { kind: event.target.value as SetKind })} className="min-h-11 rounded-button border border-line bg-surface px-2 text-[14px] text-ink">
            {(Object.keys(SET_KIND_LABEL) as SetKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {SET_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={disabled} onClick={onRemove} className="min-h-11 rounded-button px-3 text-[13px] font-bold text-ink-2 underline disabled:opacity-50">
          Togli<span className="sr-only"> {label}</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] font-semibold text-ink">
          <span aria-hidden="true">⚠︎ </span>
          {error}
        </p>
      )}
    </li>
  )
}
