import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { GramsSheet } from '../../components/GramsSheet'
import { MealPicker } from '../../components/MealPicker'
import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/States'
import { cardClass, inputClass, primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useAddEntry, useFoods, useLastGrams } from '../../data/queries'
import type { Food } from '../../data/types'
import { localDate, localHour } from '../../lib/dates'
import { FOOD_SOURCE_LABEL, isMealType, MEAL_LABEL, type MealType } from '../../lib/labels'
import { defaultGrams, entrySnapshot, mealForHour, recentFoods } from '../../lib/meals'
import { formatNumber } from '../../lib/numbers'
import { filterByQuery } from '../../lib/search'

type Tab = 'recent' | 'favorites' | 'mine' | 'recipes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'recent', label: 'Recenti' },
  { id: 'favorites', label: 'Preferiti' },
  { id: 'mine', label: 'I miei cibi' },
  { id: 'recipes', label: 'Ricette' },
]

function foodsForTab(foods: readonly Food[], tab: Tab): Food[] {
  switch (tab) {
    case 'recent':
      return recentFoods(foods)
    case 'favorites':
      return foods.filter((food) => food.isFavorite)
    case 'mine':
      return foods.filter((food) => food.source !== 'recipe')
    case 'recipes':
      return foods.filter((food) => food.source === 'recipe')
  }
}

const EMPTY_TAB_TEXT: Record<Tab, string> = {
  recent: 'Qui compaiono i cibi che registri: la prossima volta basta un tocco.',
  favorites: 'Nessun preferito. Tocca la stella di un cibo in "Cibi".',
  mine: 'Nessun cibo.',
  recipes: 'Nessuna ricetta. Creale da "Cibi" → "Nuova ricetta".',
}

/** /aggiungi?pasto=lunch — registra un cibo in pochi tocchi. */
export function AddMealScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const requested = params.get('pasto')
  const [meal, setMeal] = useState<MealType>(() =>
    isMealType(requested) ? requested : mealForHour(localHour(new Date())),
  )
  const foods = useFoods()
  const lastGrams = useLastGrams()
  const addEntry = useAddEntry()
  const [query, setQuery] = useState('')
  const [chosenTab, setChosenTab] = useState<Tab | null>(null)
  const [selected, setSelected] = useState<Food | null>(null)

  const all = foods.data ?? []
  // Al primo ingresso: Recenti se ce ne sono, altrimenti tutti i cibi.
  const tab: Tab = chosenTab ?? (recentFoods(all).length > 0 ? 'recent' : 'mine')
  const searching = query.trim() !== ''
  const visible = searching ? filterByQuery(all, query) : foodsForTab(all, tab)
  const mealName = MEAL_LABEL[meal].toLowerCase()

  function handleAdd(grams: number) {
    if (!selected) return
    addEntry.mutate(
      { date: localDate(new Date()), mealType: meal, food: selected, grams },
      { onSuccess: (entry) => navigate('/', { state: { added: { id: entry.id, mealType: meal } } }) },
    )
  }

  return (
    <>
      <ScreenHeader title={`Aggiungi a ${mealName}`} backTo="/" />
      <div className="px-5 pt-4">
        <MealPicker name="meal" value={meal} onChange={setMeal} />
        <label htmlFor="add-search" className="sr-only">
          Cerca un cibo
        </label>
        <input
          id="add-search"
          type="search"
          placeholder="Cerca un cibo"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${inputClass} mt-3`}
        />
      </div>

      {!searching && (
        <div role="tablist" aria-label="Elenchi di cibi" className="flex gap-1 overflow-x-auto px-5 pt-3">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setChosenTab(id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-[13px] font-bold ${
                tab === id ? 'bg-ink text-surface' : 'bg-surface text-ink-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {foods.isPending && <ListSkeleton />}
      {foods.isError && <ErrorState message={errorMessage(foods.error)} onRetry={() => void foods.refetch()} />}
      {foods.isSuccess && all.length === 0 && (
        <EmptyState text="Non hai ancora nessun cibo. Crealo una volta, poi lo registri in un tocco.">
          <Link to="/cibi/nuovo" className={`${primaryButtonClass} flex items-center justify-center`}>
            Crea un cibo
          </Link>
        </EmptyState>
      )}
      {foods.isSuccess && all.length > 0 && visible.length === 0 && (
        <EmptyState text={searching ? `Nessun cibo trovato per "${query.trim()}".` : EMPTY_TAB_TEXT[tab]} />
      )}

      {visible.length > 0 && (
        <ul role={searching ? undefined : 'tabpanel'} className="space-y-2 px-5 pt-3">
          {visible.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => {
                  addEntry.reset()
                  setSelected(food)
                }}
                className={`${cardClass} flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{food.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {[FOOD_SOURCE_LABEL[food.source], food.brand].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-ink-2">
                  <span className="font-bold">{formatNumber(food.per100g.kcal)}</span> kcal/100 g
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <GramsSheet
          key={selected.id}
          title={selected.name}
          subtitle={`${formatNumber(selected.per100g.kcal)} kcal per 100 g`}
          initialGrams={defaultGrams(lastGrams.data?.[selected.id], selected.servingG)}
          servingG={selected.servingG}
          preview={(grams) => entrySnapshot(selected.per100g, grams)}
          submitLabel={`Aggiungi a ${mealName}`}
          busy={addEntry.isPending}
          error={addEntry.isError ? errorMessage(addEntry.error) : null}
          onSubmit={handleAdd}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
