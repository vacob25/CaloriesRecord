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
import { PORTION_NAME_MAX, per100Label, validatePortionRows, type FoodUnit, type Portion, type PortionRowInput } from '../../lib/portions'

const EMPTY_FORM: FoodFormInput = {
  name: '',
  brand: '',
  barcode: '',
  unit: 'g',
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
    unit: food.unit,
    basis: '100g',
    servingG: text(food.servingG),
    kcal: text(food.per100g.kcal),
    protein: text(food.per100g.protein),
    carbs: text(food.per100g.carbs),
    fat: text(food.per100g.fat),
  }
}

let rowCounter = 0
const newRowKey = () => `porzione-${++rowCounter}`

function toPortionRows(portions: readonly Portion[]): PortionRowInput[] {
  return portions.map((portion) => ({ key: newRowKey(), name: portion.name, amount: String(portion.amount).replace('.', ',') }))
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
  const [portionRows, setPortionRows] = useState<PortionRowInput[]>(() => toPortionRows(food?.portions ?? []))
  const [portionErrors, setPortionErrors] = useState<Record<string, string>>({})
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
    const portions = validatePortionRows(portionRows)
    setPortionErrors(portions.ok ? {} : portions.errors)
    if (!result.ok || !portions.ok) {
      setErrors(result.ok ? {} : result.errors)
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
      { id: food?.id ?? null, values: result.value, source, portions: portions.value },
      {
        onSuccess: (created) => {
          if (created && returnTo) navigate(`${returnTo}${returnTo.includes('?') ? '&' : '?'}cibo=${created.id}`)
          else navigate('/cibi')
        },
      },
    )
  }

  const unit = form.unit
  const perLabel = form.basis === 'serving' ? 'per porzione' : per100Label(unit)
  const serving = form.basis === 'serving'
  const unitWord = unit === 'ml' ? 'Millilitri' : 'Grammi'

  function setPortionRow(key: string, field: 'name' | 'amount', value: string) {
    setPortionRows((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
    setPortionErrors(({ [key]: _removed, ...rest }) => rest)
  }

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
          <legend className="text-[13px] font-semibold text-ink-2">Si misura in</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-button bg-line/60 p-1">
            {(['g', 'ml'] as const satisfies readonly FoodUnit[]).map((option) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] text-[15px] font-semibold ${
                  unit === option ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                }`}
              >
                <input
                  type="radio"
                  name="unit"
                  value={option}
                  checked={unit === option}
                  onChange={() => {
                    setForm((current) => ({ ...current, unit: option }))
                    setAcceptedWarnings(false)
                  }}
                  className="sr-only"
                />
                {option === 'g' ? 'Grammi (g)' : 'Millilitri (ml)'}
              </label>
            ))}
          </div>
          {unit === 'ml' && <p className="mt-1 text-[13px] text-muted">Per i liquidi: valori dell'etichetta per 100 ml.</p>}
        </fieldset>

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
                {basis === '100g' ? `100 ${unit}` : 'Una porzione'}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id="servingG"
          label={serving ? `${unitWord} della porzione` : 'Porzione abituale (facoltativa)'}
          hint={
            serving
              ? `I valori vengono convertiti e salvati per 100 ${unit}.`
              : `Per proporre la quantità quando registri un pasto.`
          }
          inputMode="decimal"
          suffix={unit}
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

        <fieldset>
          <legend className="text-[13px] font-semibold text-ink-2">Porzioni casalinghe (facoltative)</legend>
          <p className="mt-1 text-[13px] text-muted">
            Es. "1 uovo medio" = 50 g, "1 cucchiaio" = 10 g. Quando registri un pasto basta scegliere quante.
          </p>
          <ul className="mt-2 space-y-2">
            {portionRows.map((row, index) => (
              <li key={row.key}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`${row.key}-name`} className="sr-only">
                      Nome della porzione {index + 1}
                    </label>
                    <input
                      id={`${row.key}-name`}
                      value={row.name}
                      maxLength={PORTION_NAME_MAX}
                      placeholder="es. 1 uovo medio"
                      autoComplete="off"
                      onChange={(event) => setPortionRow(row.key, 'name', event.target.value)}
                      aria-invalid={portionErrors[row.key] ? true : undefined}
                      className="block min-h-11 w-full rounded-button border border-line bg-surface px-3 text-[15px] outline-none focus:border-green focus:ring-2 focus:ring-green-tint"
                    />
                  </div>
                  <div className="relative w-28 shrink-0">
                    <label htmlFor={`${row.key}-amount`} className="sr-only">
                      Quantità della porzione {index + 1} in {unit}
                    </label>
                    <input
                      id={`${row.key}-amount`}
                      value={row.amount}
                      inputMode="decimal"
                      autoComplete="off"
                      onChange={(event) => setPortionRow(row.key, 'amount', event.target.value)}
                      aria-invalid={portionErrors[row.key] ? true : undefined}
                      className="block min-h-11 w-full rounded-button border border-line bg-surface pl-3 pr-9 text-right text-[15px] tabular-nums outline-none focus:border-green focus:ring-2 focus:ring-green-tint"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted">{unit}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPortionRows((rows) => rows.filter((other) => other.key !== row.key))}
                    aria-label={`Togli la porzione ${row.name.trim() || index + 1}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2"
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                {portionErrors[row.key] && <FormMessage kind="error">{portionErrors[row.key]}</FormMessage>}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPortionRows((rows) => [...rows, { key: newRowKey(), name: '', amount: '' }])}
            className="mt-2 min-h-11 text-[15px] font-semibold text-green-dark"
          >
            + Aggiungi porzione
          </button>
        </fieldset>

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
