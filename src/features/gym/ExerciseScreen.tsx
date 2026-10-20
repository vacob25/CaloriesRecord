import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { FormMessage } from '../../components/States'
import { ErrorState, ListSkeleton } from '../../components/States'
import { ScreenHeader } from '../../components/ScreenHeader'
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useExerciseActions } from '../../data/queries'
import { EQUIPMENT_LABEL, EXERCISE_NOTES_MAX, muscleLabels } from '../../lib/exercises'
import { useRouteExercise } from './exerciseHooks'

/** /palestra/esercizi/:key — scheda dell'esercizio: gruppi, attrezzo, note personali, modifica, nascondi, ripristina, elimina. */
export function ExerciseScreen() {
  const { exercise, list } = useRouteExercise()
  const actions = useExerciseActions()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (list.isPending) return <><ScreenHeader title="Esercizio" backTo="/palestra/esercizi" /><div className="px-5 pt-4"><ListSkeleton rows={3} /></div></>
  if (list.isError) return <><ScreenHeader title="Esercizio" backTo="/palestra/esercizi" /><div className="px-5 pt-4"><ErrorState message={errorMessage(list.error)} onRetry={list.refetch} /></div></>
  if (!exercise) {
    return (
      <>
        <ScreenHeader title="Esercizio" backTo="/palestra/esercizi" />
        <div className="px-5 pt-4">
          <FormMessage kind="error">Questo esercizio non esiste più. Torna all’elenco.</FormMessage>
        </div>
      </>
    )
  }

  const target = { userExerciseId: exercise.userExerciseId, catalogId: exercise.catalogId }
  const busy = actions.save.isPending || actions.remove.isPending
  const hasFieldEdits = !exercise.isCustom && exercise.isEdited
  const error = actions.save.error ?? actions.remove.error
  const base = `/palestra/esercizi/${encodeURIComponent(exercise.key)}`

  return (
    <>
      <ScreenHeader title={exercise.name} backTo="/palestra/esercizi" />
      <div className="space-y-4 px-5 pt-4">
        {exercise.nameNeedsReview && (
          <p className="rounded-button border border-line bg-surface p-3 text-[13px] text-ink-2">
            Il nome italiano è una traduzione automatica da controllare. Con “Modifica” lo correggi tu.
          </p>
        )}
        <section aria-labelledby="exercise-info" className={`${cardClass} p-5`}>
          <h2 id="exercise-info" className="sr-only">
            Dettagli
          </h2>
          <dl className="space-y-3 text-[15px]">
            <div>
              <dt className="text-[13px] font-semibold text-muted">Gruppi principali</dt>
              <dd className="font-bold">{muscleLabels(exercise.primaryMuscles)}</dd>
            </div>
            {exercise.secondaryMuscles.length > 0 && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Gruppi secondari</dt>
                <dd>{muscleLabels(exercise.secondaryMuscles)}</dd>
              </div>
            )}
            <div>
              <dt className="text-[13px] font-semibold text-muted">Attrezzo</dt>
              <dd>{EQUIPMENT_LABEL[exercise.equipment]}</dd>
            </div>
            {exercise.catalogName && exercise.name !== exercise.catalogName && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Nome originale</dt>
                <dd>{exercise.catalogName}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* key = note salvate: dopo un salvataggio (o un cambio di esercizio) il campo riparte dal valore vero. */}
        <NotesCard
          key={`${exercise.userExerciseId ?? exercise.catalogId}|${exercise.notes}`}
          saved={exercise.notes}
          busy={busy}
          saving={actions.save.isPending}
          onSave={(notes) => actions.save.mutate({ target, patch: { notes } })}
        />

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => navigate(`${base}/modifica`)} className={secondaryButtonClass}>
            Modifica
          </button>
          <button type="button" disabled={busy} onClick={() => actions.save.mutate({ target, patch: { isHidden: !exercise.isHidden } })} className={secondaryButtonClass}>
            {exercise.isHidden ? 'Mostra di nuovo' : 'Nascondi'}
          </button>
        </div>
        {hasFieldEdits && (
          <button
            type="button"
            disabled={busy}
            onClick={() => actions.save.mutate({ target, patch: { name: null, equipment: null, primaryMuscles: null, secondaryMuscles: null } })}
            className={secondaryButtonClass}
          >
            Ripristina i valori originali
          </button>
        )}
        {exercise.isCustom && exercise.userExerciseId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true)
              actions.remove.mutate(exercise.userExerciseId!, { onSuccess: () => navigate('/palestra/esercizi', { replace: true }) })
            }}
            className={dangerButtonClass}
          >
            {confirmDelete ? 'Tocca ancora per eliminare davvero' : 'Elimina questo esercizio'}
          </button>
        )}
        {error && <FormMessage kind="error">{errorMessage(error)}</FormMessage>}
        <p className="text-[13px] text-muted">Nascondere un esercizio lo toglie dall’elenco ma non lo cancella.</p>
      </div>
    </>
  )
}

function NotesCard({ saved, busy, saving, onSave }: { saved: string; busy: boolean; saving: boolean; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(saved)
  return (
    <section aria-labelledby="exercise-notes" className={`${cardClass} p-5`}>
      <h2 id="exercise-notes" className="text-[16px] font-extrabold">
        Le mie note
      </h2>
      <label htmlFor="exercise-notes-text" className="sr-only">
        Note sull’esercizio
      </label>
      <textarea
        id="exercise-notes-text"
        value={notes}
        maxLength={EXERCISE_NOTES_MAX}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Regolazioni della macchina, sensazioni, cosa correggere…"
        rows={4}
        className={`${inputClass} py-3`}
      />
      <p className="mt-1 text-[13px] text-muted">Solo tue: non le vede nessun altro.</p>
      <button type="button" disabled={busy || notes === saved} onClick={() => onSave(notes)} className={`${primaryButtonClass} mt-3`}>
        {saving ? 'Salvataggio…' : 'Salva la nota'}
      </button>
    </section>
  )
}
