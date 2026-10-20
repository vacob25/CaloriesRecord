import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ScreenHeader } from '../../components/ScreenHeader'
import { ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useExercises } from '../../data/queries'
import { useSessionEditor } from '../../data/useSessionEditor'
import { fetchLastTimes } from '../../data/workoutSessions'
import { QUERY_STALE_LONG_MS } from '../../lib/constants'
import { formatLongDate } from '../../lib/dates'
import { EQUIPMENT_LABEL, muscleLabels, type Exercise } from '../../lib/exercises'
import { formatNumber } from '../../lib/numbers'
import { formatReps } from '../../lib/workoutPlans'
import { SET_KIND_LABEL, STATUS_LABEL, formatClock, lastKey, newExerciseFor, restElapsedSeconds, sessionElapsedSeconds, summarizeSession, type Session } from '../../lib/workoutSession'
import { newId } from '../../data/ids'
import { ExercisePicker } from './ExercisePicker'
import { SessionExerciseCard } from './SessionExerciseCard'
import { useNow } from './useNow'
import { useWakeLock } from './useWakeLock'

/** /palestra/allenamento/:id — la sessione: checklist degli esercizi, serie, timer di recupero, riepilogo. */
export function SessionScreen() {
  const { id } = useParams()
  const editor = useSessionEditor(id)
  const exercises = useExercises()
  const navigate = useNavigate()
  const session = editor.session
  const active = session !== undefined && session.endedAt === null
  const now = useNow(active)
  const wake = useWakeLock(active)
  const [picking, setPicking] = useState(false)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // "Ultima volta": una richiesta per tutta la sessione (sessioni già terminate dello stesso esercizio).
  const refs = session?.exercises.map((exercise) => ({ catalogId: exercise.catalogId, userExerciseId: exercise.userExerciseId })) ?? []
  const lastTimes = useQuery({
    queryKey: ['workout_sessions', 'last', id, refs.map(lastKey).join('|')],
    queryFn: () => fetchLastTimes(refs),
    enabled: session !== undefined,
    staleTime: QUERY_STALE_LONG_MS,
  })

  if (editor.isPending) return <><ScreenHeader title="Allenamento" backTo="/palestra" /><div className="px-5 pt-4"><ListSkeleton rows={3} /></div></>
  if (editor.isError) return <><ScreenHeader title="Allenamento" backTo="/palestra" /><div className="px-5 pt-4"><ErrorState message={errorMessage(editor.error)} onRetry={editor.refetch} /></div></>
  if (!session) {
    return <><ScreenHeader title="Allenamento" backTo="/palestra" /><div className="px-5 pt-4"><FormMessage kind="error">Questo allenamento non esiste più.</FormMessage></div></>
  }

  const title = session.dayName ?? 'Allenamento libero'
  const summary = summarizeSession(session, now)
  const rest = restElapsedSeconds(session, now)
  const busy = false

  const addExercise = (exercise: Exercise) => {
    const last = lastTimes.data?.get(lastKey({ catalogId: exercise.catalogId, userExerciseId: exercise.catalogId ? null : exercise.userExerciseId }))
    editor.addExercise(newExerciseFor(exercise, session.exercises.length, last, newId))
    setLastAdded(exercise.name)
  }

  if (session.endedAt !== null) return <FinishedSession session={session} title={title} />

  return (
    <>
      <ScreenHeader title={title} backTo="/palestra" />
      <div className="space-y-3 px-5 pt-2">
        <p className="text-[13px] text-muted">
          {session.planName ? `${session.planName} · ` : ''}
          {formatLongDate(session.date)}
        </p>

        <div className={`${cardClass} grid grid-cols-2 gap-3 p-4`} role="group" aria-label="Tempi">
          <div>
            <p className="text-[12px] font-semibold text-muted">Durata</p>
            <p className="text-[22px] font-extrabold tabular-nums">{formatClock(sessionElapsedSeconds(session, now))}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-muted">Recupero</p>
            <p className="text-[22px] font-extrabold tabular-nums" aria-label={rest === null ? 'Recupero: parte alla prima serie spuntata' : undefined}>
              {rest === null ? '–' : formatClock(rest)}
            </p>
          </div>
          <p className="col-span-2 text-[13px] text-ink-2">
            Fatti {summary.exercisesDone} · saltati {summary.exercisesSkipped} · da fare {summary.exercisesTodo} · serie di lavoro {summary.workSets}
          </p>
        </div>

        {editor.saveError && (
          <div role="alert" className="rounded-button border-l-4 border-ink bg-surface p-3 text-[14px] font-semibold text-ink">
            <p>
              <span aria-hidden="true">⚠︎ </span>Non salvato: {editor.saveError}
            </p>
            <button type="button" onClick={editor.clearSaveError} className="mt-1 min-h-11 text-[14px] font-bold underline">
              Ho capito, riallineo con il server
            </button>
          </div>
        )}
        <p role="status" className="min-h-5 text-[13px] text-muted">
          {editor.pending > 0 ? 'Salvataggio…' : ''}
        </p>

        <ul className="space-y-3">
          {session.exercises.map((exercise) => (
            <SessionExerciseCard
              key={exercise.id}
              exercise={exercise}
              last={lastTimes.data?.get(lastKey(exercise))}
              disabled={busy}
              onStatus={(status) => editor.setStatus(exercise.id, status)}
              onSetValues={(setId, patch) => editor.setValues(setId, patch, exercise.id)}
              onToggleDone={(setId) => editor.toggleDone(setId, exercise.id)}
              onAddSet={() => editor.addSet(exercise.id)}
              onRemoveSet={(setId) => editor.removeSet(setId, exercise.id)}
              onNote={(note) => editor.setNote(exercise.id, note)}
              onRemove={() => editor.removeExercise(exercise.id)}
            />
          ))}
        </ul>

        <button type="button" onClick={() => { setLastAdded(null); setPicking(true) }} className={secondaryButtonClass}>
          + Aggiungi un esercizio
        </button>

        {wake.supported && (
          <label className="flex min-h-11 items-center gap-3 text-[15px] text-ink">
            <input type="checkbox" checked={wake.enabled} onChange={(event) => wake.setEnabled(event.target.checked)} className="size-5 accent-green" />
            Tieni lo schermo acceso
          </label>
        )}

        <NoteField key={session.note} saved={session.note} onSave={editor.setSessionNote} />

        {finishing ? (
          <div className={`${cardClass} space-y-3 p-4`} role="region" aria-label="Termina allenamento">
            <h2 className="text-[17px] font-extrabold">Terminare l’allenamento?</h2>
            <p className="text-[15px]">
              {summary.exercisesDone} esercizi fatti, {summary.workSets} serie di lavoro, {summary.minutes} minuti.
            </p>
            {(summary.exercisesSkipped > 0 || summary.exercisesTodo > 0) && (
              <p className="rounded-button border-l-4 border-ink bg-bg p-3 text-[14px] font-semibold">
                {summary.exercisesSkipped > 0 && <>Saltati: {summary.skippedNames.join(', ')}. </>}
                {summary.exercisesTodo > 0 && <>Ancora da fare: {summary.exercisesTodo}. </>}
                Puoi terminare lo stesso: restano segnati.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFinishing(false)} className={secondaryButtonClass}>
                Continua
              </button>
              <button type="button" disabled={editor.pending > 0} onClick={editor.finish} className={primaryButtonClass}>
                Termina
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setFinishing(true)} className={primaryButtonClass}>
            Termina allenamento
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (!confirmDiscard) return setConfirmDiscard(true)
            void editor.discard().then(() => navigate('/palestra', { replace: true }))
          }}
          className={dangerButtonClass}
        >
          {confirmDiscard ? 'Tocca ancora: si perde tutto l’allenamento' : 'Elimina questo allenamento'}
        </button>
      </div>
      {picking && (
        <ExercisePicker
          exercises={exercises.data ?? []}
          usageOf={(exercise) => session.exercises.filter((item) => (exercise.catalogId ? item.catalogId === exercise.catalogId : item.userExerciseId === exercise.userExerciseId)).length}
          onAdd={addExercise}
          onClose={() => setPicking(false)}
          lastAdded={lastAdded}
        />
      )}
    </>
  )
}

function NoteField({ saved, onSave }: { saved: string; onSave: (note: string) => void }) {
  const [note, setNote] = useState(saved)
  return (
    <div>
      <label htmlFor="session-note" className="block text-[13px] font-semibold text-ink-2">
        Nota dell’allenamento
      </label>
      <textarea id="session-note" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => note !== saved && onSave(note)} className={`${inputClass} py-3`} />
    </div>
  )
}

/** Allenamento terminato: riepilogo e serie in sola lettura (modificare un allenamento finito non è previsto in questa fase). */
function FinishedSession({ session, title }: { session: Session; title: string }) {
  const summary = summarizeSession(session, session.endedAt ?? session.startedAt)
  return (
    <>
      <ScreenHeader title={title} backTo="/palestra/allenamenti" />
      <div className="space-y-3 px-5 pt-2">
        <p className="text-[13px] text-muted">
          {session.planName ? `${session.planName} · ` : ''}
          {formatLongDate(session.date)}
        </p>
        <section aria-label="Riepilogo" className={`${cardClass} space-y-1 p-4`}>
          <h2 className="text-[17px] font-extrabold">Riepilogo</h2>
          <p className="text-[15px]">
            {summary.minutes} minuti · {summary.exercisesDone} esercizi fatti · {summary.workSets} serie di lavoro
            {summary.warmupSets > 0 ? ` (+ ${summary.warmupSets} di riscaldamento)` : ''}
          </p>
          {summary.exercisesSkipped > 0 && <p className="rounded-button border-l-4 border-ink bg-bg p-3 text-[14px] font-semibold">Saltati: {summary.skippedNames.join(', ')}</p>}
          {summary.exercisesTodo > 0 && <p className="text-[14px] text-ink-2">Non iniziati: {summary.exercisesTodo}</p>}
          {session.note && <p className="pt-1 text-[14px] text-ink-2">Nota: {session.note}</p>}
        </section>
        <ul className="space-y-3">
          {session.exercises.map((exercise) => (
            <li key={exercise.id} className={`${cardClass} p-4 ${exercise.status === 'skipped' ? 'border-2 border-dashed border-ink' : ''}`}>
              <h3 className="text-[16px] font-extrabold">
                {exercise.name} <span className="text-[13px] font-semibold text-muted">· {STATUS_LABEL[exercise.status]}</span>
              </h3>
              <p className="text-[13px] text-muted">
                {muscleLabels(exercise.primaryMuscles)} · {EQUIPMENT_LABEL[exercise.equipment]}
                {exercise.plannedSets !== null && exercise.plannedRepsMin !== null ? ` · previsto ${exercise.plannedSets}×${formatReps(exercise.plannedRepsMin, exercise.plannedRepsMax)}` : ''}
              </p>
              {exercise.status !== 'skipped' && (
                <ul className="mt-2 space-y-1 text-[14px]">
                  {exercise.sets.map((set) => (
                    <li key={set.id} className={set.done ? 'font-semibold' : 'text-muted line-through'}>
                      {set.number}. {set.weightKg === null ? '–' : `${formatNumber(set.weightKg, 1)} kg`} × {set.reps ?? '–'}
                      {set.kind !== 'normal' ? ` · ${SET_KIND_LABEL[set.kind]}` : ''}
                      {set.done ? '' : ' (non fatta)'}
                    </li>
                  ))}
                </ul>
              )}
              {exercise.note && <p className="mt-1 text-[13px] text-ink-2">Nota: {exercise.note}</p>}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
