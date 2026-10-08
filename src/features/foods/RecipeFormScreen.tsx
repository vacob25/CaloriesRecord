import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ConfirmButton } from '../../components/ConfirmButton'
import { Field } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useDeleteFood, useFoods, useRecipe, useSaveRecipe } from '../../data/queries'
import type { Food, Recipe } from '../../data/types'
import { validateGrams } from '../../lib/foodValidation'
import { formatNumber, parseDecimal } from '../../lib/numbers'
import { per100Label } from '../../lib/portions'
import { recipePer100g, totalGrams } from '../../lib/nutrition'
import { validateRecipe, type RecipeFormErrors } from '../../lib/recipeValidation'
import { filterByQuery } from '../../lib/search'

interface ItemState {
  key: string
  ingredient: Food
  grams: string
}

/** /cibi/ricette/nuova e /cibi/ricette/:id */
export function RecipeFormScreen() {
  const { id } = useParams()
  const recipe = useRecipe(id)
  if (!id) return <RecipeForm recipe={null} />
  if (recipe.isPending) return <ListSkeleton rows={4} />
  if (recipe.isError) return <ErrorState message={errorMessage(recipe.error)} onRetry={() => void recipe.refetch()} />
  return <RecipeForm key={recipe.data.food.id} recipe={recipe.data} />
}

const decimalText = (value: number) => String(value).replace('.', ',')

// Chiave stabile per ogni riga ingrediente (lo stesso cibo può comparire due volte).
let keyCounter = 0
const newKey = () => `i${keyCounter++}`

function RecipeForm({ recipe }: { recipe: Recipe | null }) {
  const navigate = useNavigate()
  const save = useSaveRecipe()
  const remove = useDeleteFood()

  const [name, setName] = useState(recipe?.food.name ?? '')
  const [cookedWeightG, setCookedWeightG] = useState(
    recipe?.food.cookedWeightG ? decimalText(recipe.food.cookedWeightG) : '',
  )
  const [items, setItems] = useState<ItemState[]>(() =>
    (recipe?.items ?? []).map((item) => ({ key: newKey(), ingredient: item.ingredient, grams: decimalText(item.grams) })),
  )
  const [picking, setPicking] = useState(recipe === null)
  const [errors, setErrors] = useState<RecipeFormErrors>({ itemGrams: {} })

  // Anteprima dal vivo: solo con grammi e peso cotto validi.
  const validItems = items.flatMap((item) => {
    const grams = validateGrams(item.grams)
    return grams.ok ? [{ per100g: item.ingredient.per100g, grams: grams.value }] : []
  })
  const cooked = parseDecimal(cookedWeightG)
  const preview =
    validItems.length === items.length && items.length > 0 && cooked !== null && cooked > 0
      ? recipePer100g(validItems, cooked)
      : null
  const rawTotal = totalGrams(validItems)

  function addIngredient(food: Food) {
    setItems((current) => [
      ...current,
      { key: newKey(), ingredient: food, grams: food.servingG ? decimalText(food.servingG) : '' },
    ])
    setPicking(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateRecipe({ name, cookedWeightG, items })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({ itemGrams: {} })
    save.mutate(
      {
        id: recipe?.food.id ?? null,
        name: result.value.name,
        cookedWeightG: result.value.cookedWeightG,
        items: items.map((item) => ({ ingredient: item.ingredient, grams: result.value.grams[item.key] ?? 0 })),
      },
      { onSuccess: () => navigate('/cibi') },
    )
  }

  return (
    <>
      <ScreenHeader title={recipe ? 'Modifica ricetta' : 'Nuova ricetta'} backTo="/cibi" />
      <form onSubmit={handleSubmit} noValidate className="space-y-4 px-5 pt-4">
        <Field id="recipe-name" label="Nome della ricetta" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="off" />

        <section aria-labelledby="ingredients-title">
          <h2 id="ingredients-title" className="text-[13px] font-semibold text-ink-2">
            Ingredienti (pesati crudi)
          </h2>
          {items.length > 0 && (
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li key={item.key} className={`${cardClass} p-3`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{item.ingredient.name}</p>
                      <p className="text-[13px] text-muted">{formatNumber(item.ingredient.per100g.kcal)} kcal {per100Label(item.ingredient.unit)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                      aria-label={`Togli ${item.ingredient.name}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                  <Field
                    id={`grams-${item.key}`}
                    label={`${item.ingredient.unit === 'ml' ? 'Millilitri' : 'Grammi'} di ${item.ingredient.name}`}
                    inputMode="decimal"
                    suffix={item.ingredient.unit}
                    value={item.grams}
                    onChange={(e) =>
                      setItems((current) =>
                        current.map((other) => (other.key === item.key ? { ...other, grams: e.target.value } : other)),
                      )
                    }
                    error={errors.itemGrams[item.key]}
                    className="mt-2"
                  />
                </li>
              ))}
            </ul>
          )}
          {errors.items && <FormMessage kind="error">{errors.items}</FormMessage>}
          {picking ? (
            <IngredientPicker excludeId={recipe?.food.id} onPick={addIngredient} onClose={() => setPicking(false)} />
          ) : (
            <button type="button" onClick={() => setPicking(true)} className={`${secondaryButtonClass} mt-3`}>
              + Aggiungi ingrediente
            </button>
          )}
        </section>

        <div>
          <Field
            id="cooked"
            label="Peso totale cotto"
            hint="Pesa tutto a fine cottura (senza pentola): serve a calcolare i valori per 100 g di piatto pronto."
            inputMode="decimal"
            suffix="g"
            value={cookedWeightG}
            onChange={(e) => setCookedWeightG(e.target.value)}
            error={errors.cookedWeightG}
          />
          {rawTotal > 0 && (
            <button
              type="button"
              onClick={() => setCookedWeightG(decimalText(rawTotal))}
              className="mt-1 min-h-11 text-[15px] font-semibold text-green-dark"
            >
              Usa il peso crudo ({formatNumber(rawTotal, 1)} g)
            </button>
          )}
        </div>

        <div className={`${cardClass} p-4`} aria-live="polite">
          <p className="text-[13px] font-semibold text-ink-2">Per 100 g di ricetta</p>
          {preview ? (
            <p className="mt-1 text-[15px]">
              <span className="text-[20px] font-extrabold">{formatNumber(preview.kcal)}</span> kcal · P{' '}
              {formatNumber(preview.protein, 1)} g · C {formatNumber(preview.carbs, 1)} g · G {formatNumber(preview.fat, 1)} g
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted">Compila ingredienti e peso cotto per vedere i valori.</p>
          )}
        </div>

        {save.isError && <FormMessage kind="error">{errorMessage(save.error)}</FormMessage>}
        <button type="submit" disabled={save.isPending} className={primaryButtonClass}>
          {save.isPending ? 'Salvataggio…' : 'Salva ricetta'}
        </button>
      </form>

      {recipe && (
        <div className="px-5 pt-6">
          <ConfirmButton
            label="Elimina ricetta"
            confirmLabel="Elimina davvero"
            busyLabel="Eliminazione…"
            busy={remove.isPending}
            onConfirm={() => remove.mutate(recipe.food.id, { onSuccess: () => navigate('/cibi') })}
          />
          <p className="mt-2 text-[13px] text-muted">I pasti già registrati restano con il loro nome e i loro valori.</p>
          {remove.isError && <FormMessage kind="error">{errorMessage(remove.error)}</FormMessage>}
        </div>
      )}
    </>
  )
}

/** Scelta di un ingrediente tra i propri cibi (in v1 una ricetta non può contenere ricette, ADR-012). */
function IngredientPicker({
  excludeId,
  onPick,
  onClose,
}: {
  excludeId?: string
  onPick: (food: Food) => void
  onClose: () => void
}) {
  const foods = useFoods()
  const [query, setQuery] = useState('')
  const candidates = (foods.data ?? []).filter((food) => food.source !== 'recipe' && food.id !== excludeId)
  const visible = filterByQuery(candidates, query).slice(0, 30)

  return (
    <div className={`${cardClass} mt-3 p-3`}>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="ingredient-search" className="block text-[13px] font-semibold text-ink-2">
            Cerca un ingrediente
          </label>
          <input
            id="ingredient-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass}
          />
        </div>
        <button type="button" onClick={onClose} className="min-h-12 px-3 text-[15px] font-semibold text-ink-2">
          Chiudi
        </button>
      </div>
      {foods.isPending && <p className="mt-3 text-[13px] text-muted">Caricamento…</p>}
      {foods.isError && <p className="mt-3 text-[13px] font-semibold">{errorMessage(foods.error)}</p>}
      {foods.isSuccess && candidates.length === 0 && (
        <p className="mt-3 text-[13px] text-muted">Prima crea i cibi da usare come ingredienti (Cibi → Nuovo cibo).</p>
      )}
      <ul className="mt-2 divide-y divide-line">
        {visible.map((food) => (
          <li key={food.id}>
            <button
              type="button"
              onClick={() => onPick(food)}
              className="flex min-h-12 w-full items-center justify-between gap-2 py-2 text-left"
            >
              <span className="min-w-0 truncate text-[15px] font-semibold">{food.name}</span>
              <span className="shrink-0 text-[13px] text-muted">{formatNumber(food.per100g.kcal)} kcal/100 {food.unit}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
