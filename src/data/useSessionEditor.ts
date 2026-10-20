import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { QUERY_STALE_LONG_MS } from '../lib/constants'
import {
  addSet,
  appendExercise,
  finishSession,
  removeExercise,
  removeSet,
  setExerciseNote,
  setStatus,
  toggleSetDone,
  updateSet,
  type ExerciseStatus,
  type Session,
  type SessionExercise,
  type SetKind,
} from '../lib/workoutSession'
import { newId } from './ids'
import { errorMessage } from './dbErrors'
import {
  deleteSessionExerciseRow,
  deleteSessionRow,
  deleteSetRow,
  getSession,
  insertSessionExercise,
  saveExerciseFields,
  saveSessionFields,
  saveSets,
} from './workoutSessions'

export const sessionKey = (id: string) => ['workout_sessions', 'detail', id] as const

/**
 * Una sessione in corso (o finita) e tutte le sue modifiche. Il telefono è la fonte: ogni tocco cambia subito la schermata
 * (funzioni pure di `lib/workoutSession`) e poi si salva sul database in ordine, una richiesta alla volta, così due modifiche
 * veloci alla stessa serie arrivano nell'ordine giusto. Se un salvataggio fallisce, `saveError` lo dice e la sessione si
 * riallinea con il server. (Senza rete la bozza locale arriva con la Fase 5b.)
 */
export function useSessionEditor(id: string | undefined) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: sessionKey(id ?? ''), queryFn: () => getSession(id ?? ''), enabled: Boolean(id), staleTime: QUERY_STALE_LONG_MS })
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const [pending, setPending] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  const edit = useCallback(
    (change: (session: Session) => Session, persist: (next: Session, previous: Session) => Promise<void>) => {
      if (!id) return
      const previous = client.getQueryData<Session | null>(sessionKey(id))
      if (!previous) return
      const next = change(previous)
      if (next === previous) return
      client.setQueryData(sessionKey(id), next)
      setSaveError(null)
      setPending((count) => count + 1)
      chain.current = chain.current
        .then(() => persist(next, previous))
        .catch((error: unknown) => {
          setSaveError(errorMessage(error))
          // Si riparte da ciò che c'è davvero sul server.
          return client.invalidateQueries({ queryKey: sessionKey(id) })
        })
        .finally(() => setPending((count) => count - 1))
    },
    [client, id],
  )

  const exerciseOf = (session: Session, exerciseId: string): SessionExercise => session.exercises.find((exercise) => exercise.id === exerciseId)!

  return {
    session: query.data ?? undefined,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    /** Salvataggi ancora in corso. */
    pending,
    saveError,
    clearSaveError: () => setSaveError(null),

    setValues: (setId: string, patch: { weightKg?: number | null; reps?: number | null; kind?: SetKind }, exerciseId: string) =>
      edit((session) => updateSet(session, setId, patch), (next) => saveSets(exerciseId, exerciseOf(next, exerciseId).sets.filter((set) => set.id === setId))),

    toggleDone: (setId: string, exerciseId: string) =>
      edit(
        (session) => toggleSetDone(session, setId, new Date().toISOString()),
        async (next, previous) => {
          const exercise = exerciseOf(next, exerciseId)
          await saveSets(exerciseId, exercise.sets.filter((set) => set.id === setId))
          if (exercise.status !== exerciseOf(previous, exerciseId).status) await saveExerciseFields(exerciseId, { status: exercise.status })
        },
      ),

    addSet: (exerciseId: string) =>
      edit((session) => addSet(session, exerciseId, newId), (next, previous) => {
        const before = new Set(exerciseOf(previous, exerciseId).sets.map((set) => set.id))
        return saveSets(exerciseId, exerciseOf(next, exerciseId).sets.filter((set) => !before.has(set.id)))
      }),

    removeSet: (setId: string, exerciseId: string) =>
      edit(
        (session) => removeSet(session, setId),
        async (next) => {
          await deleteSetRow(setId)
          // Le serie rimaste cambiano numero.
          await saveSets(exerciseId, exerciseOf(next, exerciseId).sets)
        },
      ),

    setStatus: (exerciseId: string, status: ExerciseStatus) => edit((session) => setStatus(session, exerciseId, status), () => saveExerciseFields(exerciseId, { status })),

    setNote: (exerciseId: string, note: string) => edit((session) => setExerciseNote(session, exerciseId, note), () => saveExerciseFields(exerciseId, { note })),

    addExercise: (exercise: SessionExercise) =>
      edit((session) => appendExercise(session, exercise), (next) => insertSessionExercise(next.id, next.exercises[next.exercises.length - 1]!)),

    removeExercise: (exerciseId: string) => edit((session) => removeExercise(session, exerciseId), () => deleteSessionExerciseRow(exerciseId)),

    setSessionNote: (note: string) => edit((session) => ({ ...session, note }), (next) => saveSessionFields(next.id, { note })),

    finish: () => edit((session) => finishSession(session, new Date().toISOString()), (next) => saveSessionFields(next.id, { endedAt: next.endedAt })),

    /** Elimina la sessione intera (si perde tutto). */
    discard: async () => {
      if (!id) return
      await chain.current
      await deleteSessionRow(id)
      client.removeQueries({ queryKey: sessionKey(id) })
      await client.invalidateQueries({ queryKey: ['workout_sessions'] })
    },
  }
}
