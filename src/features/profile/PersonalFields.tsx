import { Field } from '../../components/Field'
import { SEX_LABEL, type Sex } from '../../lib/labels'
import type { PersonalField, PersonalFormInput } from '../../lib/profileValidation'

interface PersonalFieldsProps {
  form: PersonalFormInput
  errors: Partial<Record<PersonalField, string>>
  onChange: (form: PersonalFormInput) => void
  /** Alla prima apertura si chiede anche il peso di oggi (ADR-037). */
  askWeight: boolean
  /** Al Benvenuto il peso obiettivo si chiede nel passo dell'obiettivo (serve al cut): qui si nasconde. */
  askGoalWeight?: boolean
}

/** Campi dei dati personali, condivisi da Benvenuto e Profilo. */
export function PersonalFields({ form, errors, onChange, askWeight, askGoalWeight = true }: PersonalFieldsProps) {
  const set = (field: keyof PersonalFormInput) => (event: { target: { value: string } }) =>
    onChange({ ...form, [field]: event.target.value })

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-[13px] font-semibold text-ink-2">Sesso (serve solo alla formula del metabolismo)</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-button bg-line/60 p-1">
          {(['male', 'female'] as Sex[]).map((sex) => (
            <label
              key={sex}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] text-[15px] font-semibold ${
                form.sex === sex ? 'bg-surface text-ink shadow-sm' : 'text-muted'
              }`}
            >
              <input type="radio" name="sex" value={sex} checked={form.sex === sex} onChange={() => onChange({ ...form, sex })} className="sr-only" />
              {SEX_LABEL[sex]}
            </label>
          ))}
        </div>
        {errors.sex && <p className="mt-1 text-[13px] font-semibold">⚠︎ {errors.sex}</p>}
      </fieldset>
      <Field id="birthDate" label="Data di nascita" type="date" value={form.birthDate} onChange={set('birthDate')} error={errors.birthDate} />
      <Field id="heightCm" label="Altezza" inputMode="decimal" suffix="cm" value={form.heightCm} onChange={set('heightCm')} error={errors.heightCm} />
      {askWeight && (
        <Field
          id="weightKg"
          label="Peso di oggi"
          hint="Meglio al mattino, a digiuno. Diventa la tua prima pesata."
          inputMode="decimal"
          suffix="kg"
          value={form.weightKg ?? ''}
          onChange={set('weightKg')}
          error={errors.weightKg}
        />
      )}
      {askGoalWeight && (
        <Field
          id="goalWeightKg"
          label="Peso obiettivo (facoltativo)"
          inputMode="decimal"
          suffix="kg"
          value={form.goalWeightKg}
          onChange={set('goalWeightKg')}
          error={errors.goalWeightKg}
        />
      )}
    </div>
  )
}
