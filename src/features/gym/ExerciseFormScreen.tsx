import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Field } from '../../components/Field'
import { FormMessage } from '../../components/States'
import { ScreenHeader } from '../../components/ScreenHeader'
import { cardClass, inputClass, primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useExerciseActions } from '../../data/queries'
import {
  EQUIPMENT_KEYS,
  EQUIPMENT_LABEL,
  MUSCLE_KEYS,
  MUSCLE_LABEL,
  editPatch,
  exercisePath,
  userKey,
  validateExerciseName,
  validateMuscles,
  type EquipmentKey,
  type Exercise,
  type MuscleKey,
} from '../../lib/exercises'
import { useRouteExercise } from './exerciseHooks'

/** /palestra/esercizi/nuovo (esercizio tuo) e /palestra/esercizi/:key/modifica (cambia nome, attrezzo e gruppi di uno qualunque). */
export function ExerciseFormScreen({ mode }: { mode: 'new' | 'edit' }) {
  const { exercise, list } = useRouteExercise()
  if (mode === 'edit' && list.isPending) return <ScreenHeader title="Modifica esercizio" backTo="/palestra/esercizi" />
  if (mode === 'edit' && !exercise) {
    return (
      <>
        <ScreenHeader title="Modifica esercizio" backTo="/palestra/esercizi" />
        <div className="px-5 pt-4">
          <FormMessage kind="error">Questo esercizio non esiste più.</FormMessage>
        </div>
      </>
    )
  }
  // `key` rimonta il modulo se l'esercizio caricato cambia: i campi partono sempre dai valori giusti.
  return <ExerciseForm key={exercise?.key ?? 'new'} exercise={exercise ?? null} all={list.data ?? []} />
}

function ExerciseForm({ exercise, all }: { exercise: Exercise | null; all: Exercise[] }) {
  const navigate = useNavigate()
  const actions = useExerciseActions()
  const [name, setName] = useState(exercise?.name ?? '')
  const [equipment, setEquipment] = useState<EquipmentKey>(exercise?.equipment ?? 'dumbbell')
  const [primary, setPrimary] = useState<MuscleKey[]>(exercise?.primaryMuscles ?? [])
  const [secondary, setSecondary] = useState<MuscleKey[]>(exercise?.secondaryMuscles ?? [])
  const [errors, setErrors] = useState<{ name?: string; muscles?: string }>({})
  const busy = actions.save.isPending || actions.create.isPending

  const toggle = (list: MuscleKey[], set: (next: MuscleKey[]) => void, key: MuscleKey, other: MuscleKey[], setOther: (next: MuscleKey[]) => void) => {
    const next = list.includes(key) ? list.filter((item) => item !== key) : [...list, key]
    set(MUSCLE_KEYS.filter((item) => next.includes(item)))
    // Un gruppo non può essere insieme principale e secondario.
    if (!list.includes(key) && other.includes(key)) setOther(other.filter((item) => item !== key))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const nameResult = validateExerciseName(name, all, exercise?.key)
    const musclesResult = validateMuscles(primary)
    const next = { name: nameResult.ok ? undefined : nameResult.message, muscles: musclesResult.ok ? undefined : musclesResult.message }
    setErrors(next)
    if (!nameResult.ok || !musclesResult.ok) return

    if (exercise === null) {
      actions.create.mutate(
        { name: nameResult.value, equipment, primaryMuscles: primary, secondaryMuscles: secondary },
        { onSuccess: (id) => navigate(exercisePath(userKey(id)), { replace: true }) },
      )
      return
    }
    // Si salvano solo i campi cambiati rispetto al catalogo; gli altri restano "come nel catalogo".
    const patch = editPatch(exercise, { name: nameResult.value, equipment, primaryMuscles: primary, secondaryMuscles: secondary })
    actions.save.mutate(
      { target: { userExerciseId: exercise.userExerciseId, catalogId: exercise.catalogId }, patch },
      { onSuccess: () => navigate(exercisePath(exercise.key), { replace: true }) },
    )
  }

  return (
    <>
      <ScreenHeader title={exercise ? 'Modifica esercizio' : 'Nuovo esercizio'} backTo={exercise ? exercisePath(exercise.key) : '/palestra/esercizi'} />
      <form onSubmit={submit} noValidate className="space-y-4 px-5 pt-4">
        <Field
          id="exercise-name"
          label="Nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          autoComplete="off"
          maxLength={80}
        />
        <div>
          <label htmlFor="exercise-equipment-field" className="block text-[13px] font-semibold text-ink-2">
            Attrezzo
          </label>
          <select id="exercise-equipment-field" value={equipment} onChange={(event) => setEquipment(event.target.value as EquipmentKey)} className={inputClass}>
            {EQUIPMENT_KEYS.map((key) => (
              <option key={key} value={key}>
                {EQUIPMENT_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <fieldset className={`${cardClass} p-4`}>
          <legend className="px-1 text-[15px] font-extrabold">Gruppi principali</legend>
          <MuscleChoices values={primary} onToggle={(key) => toggle(primary, setPrimary, key, secondary, setSecondary)} prefix="primary" />
          {errors.muscles && (
            <p role="alert" className="mt-2 text-[13px] font-semibold text-ink">
              <span aria-hidden="true">⚠︎ </span>
              {errors.muscles}
            </p>
          )}
        </fieldset>
        <fieldset className={`${cardClass} p-4`}>
          <legend className="px-1 text-[15px] font-extrabold">Gruppi secondari (facoltativi)</legend>
          <MuscleChoices values={secondary} onToggle={(key) => toggle(secondary, setSecondary, key, primary, setPrimary)} prefix="secondary" />
        </fieldset>
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? 'Salvataggio…' : 'Salva'}
        </button>
        {(actions.save.error ?? actions.create.error) && <FormMessage kind="error">{errorMessage(actions.save.error ?? actions.create.error)}</FormMessage>}
      </form>
    </>
  )
}

function MuscleChoices({ values, onToggle, prefix }: { values: MuscleKey[]; onToggle: (key: MuscleKey) => void; prefix: string }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-x-3">
      {MUSCLE_KEYS.map((key) => (
        <label key={key} className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink">
          <input type="checkbox" id={`${prefix}-${key}`} checked={values.includes(key)} onChange={() => onToggle(key)} className="size-5 shrink-0 accent-green" />
          {MUSCLE_LABEL[key]}
        </label>
      ))}
    </div>
  )
}
