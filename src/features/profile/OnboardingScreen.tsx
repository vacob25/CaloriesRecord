import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { ErrorState, FormMessage } from '../../components/States'
import { primaryButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { LoadingScreen } from '../../app/LoadingScreen'
import { errorMessage } from '../../data/dbErrors'
import { useCreateProfile, useProfile } from '../../data/queries'
import { validatePersonal, type PersonalField, type PersonalFormInput } from '../../lib/profileValidation'
import { PersonalFields } from './PersonalFields'

/** /benvenuto — prima apertura: dati personali e peso di oggi. Restano solo nel tuo database. */
export function OnboardingScreen() {
  const today = useToday()
  const navigate = useNavigate()
  const profile = useProfile()
  const create = useCreateProfile()
  const [form, setForm] = useState<PersonalFormInput>({ sex: '', birthDate: '', heightCm: '', weightKg: '', goalWeightKg: '' })
  const [errors, setErrors] = useState<Partial<Record<PersonalField, string>>>({})

  if (profile.isPending) return <LoadingScreen />
  if (profile.isError) return <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
  if (profile.data) return <Navigate to="/" replace />

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validatePersonal(form, today)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    create.mutate({ values: result.value, today }, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">Benvenuto</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        Servono pochi dati per calcolare il tuo obiettivo di calorie. Restano solo nel tuo database e puoi cambiarli dal
        Profilo.
      </p>
      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <PersonalFields form={form} errors={errors} onChange={setForm} askWeight />
        {create.isError && <FormMessage kind="error">{errorMessage(create.error)}</FormMessage>}
        <button type="submit" disabled={create.isPending} className={`${primaryButtonClass} mt-6`}>
          {create.isPending ? 'Salvataggio…' : 'Inizia'}
        </button>
      </form>
    </main>
  )
}
