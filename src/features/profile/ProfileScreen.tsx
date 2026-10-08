import { useState, type FormEvent } from 'react'

import { Field } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { signOut } from '../../data/auth'
import { errorMessage } from '../../data/dbErrors'
import { useDayTarget, useProfile, useUpdateProfile } from '../../data/queries'
import type { Profile } from '../../data/types'
import {
  validateParams,
  validatePersonal,
  type ParamsField,
  type ParamsFormInput,
  type ParamsValues,
  type PersonalField,
  type PersonalFormInput,
} from '../../lib/profileValidation'
import { GAIN_RATE_WARNING_KG_WEEK } from '../../lib/constants'
import { formatNumber, fractionToPercent } from '../../lib/numbers'
import { estimatedGainKgPerWeek } from '../../lib/targets'
import { PersonalFields } from './PersonalFields'
import { RecalibrationCard } from './RecalibrationCard'
import { WaterSection } from './WaterSection'

const text = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

const paramsKey = (p: Pick<Profile, keyof ParamsValues>) =>
  [p.activityFactor, p.surplusPct, p.trainingBonusKcal, p.proteinGPerKg, p.fatGPerKg].join('|')

const paramsForm = (p: Profile): ParamsFormInput => ({
  activityFactor: text(p.activityFactor),
  surplusPct: text(fractionToPercent(p.surplusPct)),
  trainingBonusKcal: String(p.trainingBonusKcal),
  proteinGPerKg: text(p.proteinGPerKg),
  fatGPerKg: text(p.fatGPerKg),
})

export function ProfileScreen() {
  const profile = useProfile()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    // Al termine arriva SIGNED_OUT e la guardia di route porta al login.
    await signOut()
    setBusy(false)
  }

  return (
    <>
      <ScreenHeader title="Profilo" />
      {profile.isPending && <ListSkeleton rows={3} />}
      {profile.isError && <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />}
      {profile.data && (
        <>
          <RecalibrationCard />
          <PersonalSection profile={profile.data} />
          <ParamsSection profile={profile.data} />
          <WaterSection profile={profile.data} />
        </>
      )}
      <div className="px-5 pt-6">
        <button type="button" onClick={handleSignOut} disabled={busy} className={secondaryButtonClass}>
          {busy ? 'Uscita in corso…' : 'Esci'}
        </button>
      </div>
    </>
  )
}

function SavedNote({ show }: { show: boolean }) {
  return show ? (
    <p role="status" className="mt-3 text-[13px] font-semibold text-green-dark">
      Salvato. Vale da oggi; i giorni passati non cambiano.
    </p>
  ) : null
}

function PersonalSection({ profile }: { profile: Profile }) {
  const today = useToday()
  const update = useUpdateProfile()
  const [form, setForm] = useState<PersonalFormInput>({
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: text(profile.heightCm),
    goalWeightKg: text(profile.goalWeightKg),
  })
  const [errors, setErrors] = useState<Partial<Record<PersonalField, string>>>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validatePersonal(form, today)
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    update.mutate({ personal: result.value, today })
  }

  return (
    <section aria-labelledby="personal-title" className={`${cardClass} mx-5 mt-4 p-5`}>
      <h2 id="personal-title" className="mb-4 text-[18px] font-extrabold">
        Dati personali
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <PersonalFields form={form} errors={errors} onChange={setForm} askWeight={false} />
        {update.isError && <FormMessage kind="error">{errorMessage(update.error)}</FormMessage>}
        <button type="submit" disabled={update.isPending} className={`${primaryButtonClass} mt-5`}>
          {update.isPending ? 'Salvataggio…' : 'Salva dati personali'}
        </button>
        <SavedNote show={update.isSuccess} />
      </form>
    </section>
  )
}

const PARAM_FIELDS: { field: ParamsField; label: string; suffix?: string; hint: string }[] = [
  {
    field: 'activityFactor',
    label: 'Fattore di attività',
    hint: 'Moltiplica il metabolismo a riposo per stimare il mantenimento. 1,60 ≈ 6 allenamenti a settimana. La ricalibrazione lo corregge con i tuoi dati.',
  },
  {
    field: 'surplusPct',
    label: 'Surplus',
    suffix: '%',
    hint: 'Calorie in più rispetto al mantenimento per aumentare di peso. +10% è un bulk moderato.',
  },
  {
    field: 'trainingBonusKcal',
    label: 'Bonus allenamento',
    suffix: 'kcal',
    hint: 'Si aggiunge al target nei giorni di palestra o calcio (uno solo, anche se fai entrambi).',
  },
  {
    field: 'proteinGPerKg',
    label: 'Proteine',
    suffix: 'g/kg',
    hint: 'Grammi di proteine per kg di peso. 2,0 sostiene bene la crescita muscolare.',
  },
  {
    field: 'fatGPerKg',
    label: 'Grassi',
    suffix: 'g/kg',
    hint: 'Grammi di grassi per kg di peso. I carboidrati sono il resto delle calorie.',
  },
]

function ParamsSection({ profile }: { profile: Profile }) {
  const today = useToday()
  const update = useUpdateProfile()
  const target = useDayTarget(today)
  const [form, setForm] = useState<ParamsFormInput>(() => paramsForm(profile))
  // Se i parametri cambiano altrove (es. ricalibrazione accettata) il modulo si riallinea: altrimenti
  // "Salva parametri" riscriverebbe il fattore vecchio. Si aggiorna lo stato durante il render (pattern React),
  // senza rimontare il modulo: messaggi "Salvato" e avvisi restano.
  const currentKey = paramsKey(profile)
  const [seenKey, setSeenKey] = useState(currentKey)
  // Valori appena salvati da questo modulo: quando il profilo ricaricato li riporta, non si tocca ciò che si sta scrivendo.
  const [savedKey, setSavedKey] = useState<string | null>(null)
  if (currentKey !== seenKey) {
    setSeenKey(currentKey)
    if (currentKey !== savedKey) setForm(paramsForm(profile))
  }
  const [errors, setErrors] = useState<Partial<Record<ParamsField, string>>>({})
  const [warnings, setWarnings] = useState<string[]>([])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateParams(form)
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    const extra: string[] = []
    // §2: avviso se il ritmo stimato supera +0,5 kg/settimana (serve il mantenimento di oggi).
    if (target.data?.status === 'ready') {
      const rate = estimatedGainKgPerWeek(target.data.target.maintenanceKcal, profile.activityFactor, result.value.activityFactor, result.value.surplusPct)
      if (rate > GAIN_RATE_WARNING_KG_WEEK) {
        extra.push(`Con questi parametri il ritmo stimato è circa +${formatNumber(rate, 2)} kg/settimana, oltre +0,5: l’aumento sarebbe soprattutto grasso.`)
      }
    }
    setWarnings([...result.warnings, ...extra])
    // Il profilo ricaricato dopo questo salvataggio avrà questi valori: non deve riscrivere ciò che si sta digitando.
    setSavedKey(paramsKey(result.value))
    update.mutate({ params: result.value, today })
  }

  return (
    <section aria-labelledby="params-title" className={`${cardClass} mx-5 mt-4 p-5`}>
      <h2 id="params-title" className="text-[18px] font-extrabold">
        Parametri
      </h2>
      <p className="mt-1 text-[13px] text-muted">Sono stime di partenza: la ricalibrazione le corregge con i tuoi dati.</p>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {PARAM_FIELDS.map(({ field, label, suffix, hint }) => (
          <Field
            key={field}
            id={field}
            label={label}
            hint={hint}
            suffix={suffix}
            inputMode="decimal"
            value={form[field]}
            onChange={(event) => setForm({ ...form, [field]: event.target.value })}
            error={errors[field]}
          />
        ))}
        {warnings.map((warning) => (
          <FormMessage key={warning} kind="warning">
            {warning}
          </FormMessage>
        ))}
        {update.isError && <FormMessage kind="error">{errorMessage(update.error)}</FormMessage>}
        <button type="submit" disabled={update.isPending} className={primaryButtonClass}>
          {update.isPending ? 'Salvataggio…' : 'Salva parametri'}
        </button>
        <SavedNote show={update.isSuccess} />
      </form>
    </section>
  )
}
