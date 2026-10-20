import { useMemo, useState } from 'react'

import { SheetFrame } from '../../components/SheetFrame'
import { inputClass } from '../../components/ui'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, filterExercises, type Exercise, type MuscleKey } from '../../lib/exercises'
import { groupByMuscle } from '../../lib/workoutPlans'

const SEARCH_LIMIT = 100

interface ExercisePickerProps {
  exercises: readonly Exercise[]
  /** Quante volte ogni esercizio è già nel giorno (chiave: `Exercise.key`-indipendente, vedi `usageOf`). */
  usageOf: (exercise: Exercise) => number
  onAdd: (exercise: Exercise) => void
  onClose: () => void
  /** Ultimo esercizio aggiunto: lo si annuncia a voce senza chiudere il pannello. */
  lastAdded: string | null
}

/** Scelta degli esercizi per una scheda: divisi per gruppo muscolare (gruppi apribili), con ricerca; un tocco aggiunge. */
export function ExercisePicker({ exercises, usageOf, onAdd, onClose, lastAdded }: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ReadonlySet<MuscleKey>>(new Set())
  const searching = query.trim() !== ''

  const visible = useMemo(() => filterExercises(exercises, { query, muscle: null, equipment: null, showHidden: false }), [exercises, query])
  const groups = useMemo(() => groupByMuscle(visible), [visible])
  const shown = searching ? visible.slice(0, SEARCH_LIMIT) : null

  const row = (exercise: Exercise) => {
    const used = usageOf(exercise)
    return (
      <li key={exercise.key}>
        <button type="button" onClick={() => onAdd(exercise)} className="flex min-h-12 w-full items-center justify-between gap-3 px-1 py-2 text-left">
          <span>
            <span className="block text-[15px] font-bold leading-snug">{exercise.name}</span>
            <span className="block text-[13px] text-muted">{EQUIPMENT_LABEL[exercise.equipment]}</span>
          </span>
          <span className="shrink-0 text-[13px] font-bold text-green-dark">{used > 0 ? `Nel giorno ×${used} · +` : '+ Aggiungi'}</span>
        </button>
      </li>
    )
  }

  return (
    <SheetFrame title="Aggiungi esercizio" onClose={onClose}>
      {() => (
        <div className="mt-3">
          <label htmlFor="picker-search" className="block text-[13px] font-semibold text-ink-2">
            Cerca
          </label>
          <input id="picker-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Es. panca, curl, pulldown" autoComplete="off" className={inputClass} />
          <p role="status" className="mt-2 min-h-5 text-[13px] font-semibold text-green-dark">
            {lastAdded ? `Aggiunto: ${lastAdded}` : ''}
          </p>
          {shown ? (
            <>
              {shown.length === 0 && <p className="py-4 text-[15px] text-ink-2">Nessun esercizio con questa ricerca.</p>}
              <ul className="divide-y divide-line">{shown.map(row)}</ul>
              {visible.length > SEARCH_LIMIT && <p className="py-2 text-[13px] text-muted">Mostrati i primi {SEARCH_LIMIT} di {visible.length}: scrivi di più per restringere.</p>}
            </>
          ) : (
            <ul className="space-y-1">
              {groups.map((group) => {
                const isOpen = open.has(group.muscle)
                return (
                  <li key={group.muscle} className="border-b border-line">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpen((current) => {
                          const next = new Set(current)
                          if (isOpen) next.delete(group.muscle)
                          else next.add(group.muscle)
                          return next
                        })
                      }
                      className="flex min-h-12 w-full items-center justify-between text-left text-[16px] font-extrabold"
                    >
                      <span>
                        {MUSCLE_LABEL[group.muscle]} <span className="font-semibold text-muted">({group.exercises.length})</span>
                      </span>
                      <span aria-hidden="true" className="text-[18px] text-muted">
                        {isOpen ? '▾' : '▸'}
                      </span>
                    </button>
                    {isOpen && <ul className="divide-y divide-line pb-2">{group.exercises.map(row)}</ul>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </SheetFrame>
  )
}
