import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ConfirmButton } from '../../components/ConfirmButton'
import { Field } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useDeleteFood, useFood, useSaveFood } from '../../data/queries'
import type { Food } from '../../data/types'
import { validateFood, type FoodField, type FoodFormInput } from '../../lib/foodValidation'

const EMPTY_FORM: FoodFormInput = {
  name: '',
  brand: '',
  barcode: '',
  basis: '100g',
  servingG: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
}

/** Valori salvati → testo del modulo (con la virgola italiana). */
function toForm(food: Food): FoodFormInput {
  const text = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))
  return {
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    basis: '100g',
    servingG: text(food.servingG),
    kcal: text(food.per100g.kcal),
    protein: text(food.per100g.protein),
    carbs: text(food.per100g.carbs),
    fat: text(food.per100g.fat),
  }
}

/** Stato passato da Aggiungi pasto / scanner: modulo precompilato e dove tornare dopo il salvataggio. */
export interface FoodFormState {
  prefill?: FoodFormInput
  source?: 'manual' | 'open_food_facts'
  note?: string
  returnTo?: string
}

/** /cibi/nuovo (anche ?barcode=…) e /cibi/:id */
export function FoodFormScreen() {
  const { id } = useParams()
  const food = useFood(id)
  const [params] = useSearchParams()
  const state = (useLocation().state as FoodFormState | null) ?? {}

  if (!id) {
    const initial = state.prefill ?? { ...EMPTY_FORM, barcode: params.get('barcode') ?? '' }
    return <FoodForm initial={initial} food={null} source={state.source} note={state.note} returnTo={state.returnTo} />
  }
  if (food.isPending) return <ListSkeleton rows={4} />
  if (food.isError) return <ErrorState message={errorMessage(food.error)} onRetry={() => void food.refetch()} />
  if (food.data.source === 'recipe') return <Navigate to={`/cibi/ricette/${food.data.id}`} replace />
  return <FoodForm key={food.data.id} initial={toForm(food.data)} food={food.data} />
}

interface FoodFormProps {
  initial: FoodFormInput
  food: Food | null
  source?: 'manual' | 'open_food_facts'
  note?: string
  returnTo?: string
}

function FoodForm({ initial, food, source, note, returnTo }: FoodFormProps) {
  const navigate = useNavigate()
  const save = useSaveFood()
  const remove = useDeleteFood()
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<FoodField, string>>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [acceptedWarnings, setAcceptedWarnings] = useState(false)

  const set = (field: keyof FoodFormInput) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setAcceptedWarnings(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateFood(form)
    if (!result.ok) {
      setErrors(result.errors)
      setWarnings([])
      return
    }
    setErrors({})
    // Avviso "valori incoerenti": non blocca, ma chiede un secondo tocco su Salva.
    if (result.warnings.length > 0 && !acceptedWarnings) {
      setWarnings(result.warnings)
      setAcceptedWarnings(true)
      return
    }
    save.mutate(
      { id: food?.id ?? null, values: result.value, source },
      {
        onSuccess: (created) => {
          if (created && returnTo) navigate(`${returnTo}${returnTo.includes('?') ? '&' : '?'}cibo=${created.id}`)
          else navigate('/cibi')
        },
      },
    )
  }

  const perLabel = form.basis === 'serving' ? 'per porzione' : 'per 100 g'
  const serving = form.basis === 'serving'

  return (
    <>
      <ScreenHeader title={food ? 'Modifica cibo' : 'Nuovo cibo'} backTo={returnTo ?? '/cibi'} />
      {note && (
        <div className="px-5 pt-2">
          <FormMessage kind="warning">{note}</FormMessage>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="space-y-4 px-5 pt-4">
        <Field id="name" label="Nome" value={form.name} onChange={set('name')} error={errors.name} autoComplete="off" />
        <Field id="brand" label="Marca (facoltativa)" value={form.brand} onChange={set('brand')} autoComplete="off" />

        <fieldset>
          <legend className="text-[13px] font-semibold text-ink-2">Valori riferiti a</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-button bg-line/60 p-1">
            {(['100g', 'serving'] as const).map((basis) => (
              <label
                key={basis}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] text-[15px] font-semibold ${
                  form.basis === basis ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                }`}
              >
                <input
                  type="radio"
                  name="basis"
                  value={basis}
                  checked={form.basis === basis}
                  onChange={() => setForm((current) => ({ ...current, basis }))}
                  className="sr-only"
                />
                {basis === '100g' ? '100 g' : 'Una porzione'}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id="servingG"
          label={serving ? 'Grammi della porzione' : 'Porzione abituale (facoltativa)'}
          hint={serving ? 'I valori vengono convertiti e salvati per 100 g.' : 'Per proporre i grammi quando registri un pasto.'}
          inputMode="decimal"
          suffix="g"
          value={form.servingG}
          onChange={set('servingG')}
          error={errors.servingG}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field id="kcal" label={`Kcal ${perLabel}`} inputMode="decimal" suffix="kcal" value={form.kcal} onChange={set('kcal')} error={errors.kcal} />
          <Field id="protein" label="Proteine" inputMode="decimal" suffix="g" value={form.protein} onChange={set('protein')} error={errors.protein} />
          <Field id="carbs" label="Carboidrati" inputMode="decimal" suffix="g" value={form.carbs} onChange={set('carbs')} error={errors.carbs} />
          <Field id="fat" label="Grassi" inputMode="decimal" suffix="g" value={form.fat} onChange={set('fat')} error={errors.fat} />
        </div>
        {errors.macroSum && <FormMessage kind="error">{errors.macroSum}</FormMessage>}

        <Field
          id="barcode"
          label="Codice a barre (facoltativo)"
          inputMode="numeric"
          autoComplete="off"
          value={form.barcode}
          onChange={set('barcode')}
          error={errors.barcode}
        />

        {warnings.map((warning) => (
          <FormMessage key={warning} kind="warning">
            {warning} Se è giusto, tocca di nuovo Salva.
          </FormMessage>
        ))}
        {save.isError && <FormMessage kind="error">{errorMessage(save.error)}</FormMessage>}

        <button type="submit" disabled={save.isPending} className={primaryButtonClass}>
          {save.isPending ? 'Salvataggio…' : 'Salva'}
        </button>
      </form>

      {food && (
        <div className="px-5 pt-6">
          <ConfirmButton
            label="Elimina cibo"
            confirmLabel="Elimina davvero"
            busyLabel="Eliminazione…"
            busy={remove.isPending}
            onConfirm={() => remove.mutate(food.id, { onSuccess: () => navigate('/cibi') })}
          />
          <p className="mt-2 text-[13px] text-muted">I pasti già registrati restano con il loro nome e i loro valori.</p>
          {remove.isError && <FormMessage kind="error">{errorMessage(remove.error)}</FormMessage>}
        </div>
      )}
    </>
  )
}
