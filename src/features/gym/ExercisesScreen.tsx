import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/States'
import { cardClass, inputClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useExercises } from '../../data/queries'
import {
  EQUIPMENT_KEYS,
  EQUIPMENT_LABEL,
  MUSCLE_KEYS,
  MUSCLE_LABEL,
  exercisePath,
  filterExercises,
  muscleLabels,
  type EquipmentKey,
  type MuscleKey,
} from '../../lib/exercises'

const PAGE = 60

/** /palestra/esercizi — ricerca, filtri per gruppo muscolare e attrezzo, esercizi nascosti a richiesta. */
export function ExercisesScreen() {
  const exercises = useExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleKey | ''>('')
  const [equipment, setEquipment] = useState<EquipmentKey | ''>('')
  const [showHidden, setShowHidden] = useState(false)
  const [visible, setVisible] = useState(PAGE)

  const filtered = useMemo(
    () => filterExercises(exercises.data ?? [], { query, muscle: muscle || null, equipment: equipment || null, showHidden }),
    [exercises.data, query, muscle, equipment, showHidden],
  )
  // Cambiando ricerca o filtri si riparte dai primi risultati.
  const change = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setVisible(PAGE)
  }

  return (
    <>
      <ScreenHeader
        title="Esercizi"
        backTo="/palestra"
        action={
          <Link to="/palestra/esercizi/nuovo" className="flex min-h-11 items-center rounded-button px-3 text-[15px] font-bold text-green-dark">
            + Nuovo
          </Link>
        }
      />
      <div className="space-y-3 px-5 pt-4">
        <div>
          <label htmlFor="exercise-search" className="block text-[13px] font-semibold text-ink-2">
            Cerca un esercizio
          </label>
          <input
            id="exercise-search"
            type="search"
            value={query}
            onChange={(event) => change(setQuery)(event.target.value)}
            placeholder="Es. panca, curl, pulldown"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="exercise-muscle" className="block text-[13px] font-semibold text-ink-2">
              Gruppo muscolare
            </label>
            <select id="exercise-muscle" value={muscle} onChange={(event) => change(setMuscle)(event.target.value as MuscleKey | '')} className={inputClass}>
              <option value="">Tutti</option>
              {MUSCLE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {MUSCLE_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="exercise-equipment" className="block text-[13px] font-semibold text-ink-2">
              Attrezzo
            </label>
            <select id="exercise-equipment" value={equipment} onChange={(event) => change(setEquipment)(event.target.value as EquipmentKey | '')} className={inputClass}>
              <option value="">Tutti</option>
              {EQUIPMENT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {EQUIPMENT_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-[15px] text-ink">
          <input type="checkbox" checked={showHidden} onChange={(event) => change(setShowHidden)(event.target.checked)} className="size-5 accent-green" />
          Mostra anche i nascosti
        </label>

        {exercises.isPending && <ListSkeleton rows={6} />}
        {exercises.isError && <ErrorState message={errorMessage(exercises.error)} onRetry={exercises.refetch} />}
        {exercises.data && (
          <>
            <p role="status" className="text-[13px] font-semibold text-muted">
              {filtered.length === 1 ? '1 esercizio' : `${filtered.length} esercizi`}
            </p>
            {filtered.length === 0 && <EmptyState text="Nessun esercizio con questa ricerca. Prova con meno parole, oppure creane uno tuo." />}
            <ul className="space-y-2 pb-2">
              {filtered.slice(0, visible).map((exercise) => (
                <li key={exercise.key}>
                  <Link to={exercisePath(exercise.key)} className={`${cardClass} flex min-h-16 flex-col justify-center px-4 py-3`}>
                    <span className="text-[16px] font-bold leading-snug">{exercise.name}</span>
                    <span className="text-[13px] text-muted">
                      {muscleLabels(exercise.primaryMuscles)} · {EQUIPMENT_LABEL[exercise.equipment]}
                    </span>
                    {(exercise.isHidden || exercise.isEdited || exercise.isCustom || exercise.nameNeedsReview) && (
                      <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold text-green-dark">
                        {exercise.isCustom && <span className="rounded-full bg-green-tint px-2 py-0.5">Creato da te</span>}
                        {exercise.isEdited && !exercise.isCustom && <span className="rounded-full bg-green-tint px-2 py-0.5">Modificato</span>}
                        {exercise.nameNeedsReview && <span className="rounded-full bg-green-tint px-2 py-0.5">Nome da rivedere</span>}
                        {exercise.isHidden && <span className="rounded-full bg-green-tint px-2 py-0.5">Nascosto</span>}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {filtered.length > visible && (
              <button
                type="button"
                onClick={() => setVisible((current) => current + PAGE)}
                className="min-h-12 w-full rounded-button border border-line bg-surface px-4 text-[15px] font-bold text-ink"
              >
                Mostra altri {Math.min(PAGE, filtered.length - visible)}
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}
