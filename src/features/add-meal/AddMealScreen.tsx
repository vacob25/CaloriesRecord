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
import { OffSearch } from './OffSearch'

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
  const [params, setParams] = useSearchParams()
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
  const returnTo = `/aggiungi?pasto=${meal}`

  // Ritorno da scanner / nuovo cibo con ?cibo=<id>: si apre subito il pannello dei grammi.
  const chosenId = params.get('cibo')
  const fromReturn = chosenId ? (all.find((food) => food.id === chosenId) ?? null) : null
  const current = selected ?? fromReturn

  function closeSheet() {
    setSelected(null)
    if (chosenId) {
      setParams((existing) => {
        const next = new URLSearchParams(existing)
        next.delete('cibo')
        return next
      }, { replace: true })
    }
  }

  function handleAdd(grams: number) {
    if (!current) return
    addEntry.mutate(
      { date: localDate(new Date()), mealType: meal, food: current, grams },
      { onSuccess: (entry) => navigate('/', { state: { added: { id: entry.id, mealType: meal } } }) },
    )
  }

  return (
    <>
      <ScreenHeader title={`Aggiungi a ${mealName}`} backTo="/" />
      <div className="px-5 pt-4">
        <MealPicker name="meal" value={meal} onChange={setMeal} />
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
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
              className={`${inputClass} !mt-0`}
            />
          </div>
          <Link
            to={`/aggiungi/scanner?pasto=${meal}`}
            aria-label="Scansiona un codice a barre"
            className="flex size-12 shrink-0 items-center justify-center rounded-button border border-line bg-surface text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8" />
            </svg>
          </Link>
        </div>
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
        <EmptyState text={searching ? `Nessuno dei tuoi cibi corrisponde a "${query.trim()}".` : EMPTY_TAB_TEXT[tab]} />
      )}

      {visible.length > 0 && (
        <div role={searching ? undefined : 'tabpanel'}>
        <ul className="space-y-2 px-5 pt-3">
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
        </div>
      )}

      {searching && (
        <OffSearch
          key={query.trim()}
          query={query}
          returnTo={returnTo}
          onPick={(food) => {
            addEntry.reset()
            setSelected(food)
          }}
        />
      )}

      {current && (
        <GramsSheet
          key={current.id}
          title={current.name}
          subtitle={`${formatNumber(current.per100g.kcal)} kcal per 100 g`}
          initialGrams={defaultGrams(lastGrams.data?.[current.id], current.servingG)}
          servingG={current.servingG}
          preview={(grams) => entrySnapshot(current.per100g, grams)}
          submitLabel={`Aggiungi a ${mealName}`}
          busy={addEntry.isPending}
          error={addEntry.isError ? errorMessage(addEntry.error) : null}
          onSubmit={handleAdd}
          onClose={closeSheet}
        />
      )}
    </>
  )
}
