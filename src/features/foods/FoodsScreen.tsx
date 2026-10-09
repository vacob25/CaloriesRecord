import { useState } from 'react'
import { Link } from 'react-router-dom'

import { FavoriteButton } from '../../components/FavoriteButton'
import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/States'
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useFoods, useToggleFavorite } from '../../data/queries'
import type { Food } from '../../data/types'
import { FOOD_SOURCE_LABEL } from '../../lib/labels'
import { recentFoods } from '../../lib/meals'
import { formatNumber } from '../../lib/numbers'
import { per100Label } from '../../lib/portions'
import { filterByQuery } from '../../lib/search'
import { foodPath } from './paths'

/** Cibi (step 17): Preferiti e Alimenti recenti in vista; tutti gli altri con la ricerca o "Tutti i tuoi cibi". */
export function FoodsScreen() {
  const foods = useFoods()
  const toggleFavorite = useToggleFavorite()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const all = foods.data ?? []
  const searching = query.trim() !== ''
  const favorites = all.filter((food) => food.isFavorite)
  const recent = recentFoods(all)

  const row = (food: Food) => (
    <li key={food.id} className={`${cardClass} flex items-center gap-1 pr-1`}>
      <div className="flex min-h-16 min-w-0 flex-1 flex-col justify-center py-2 pl-4">
        <span className="truncate text-[15px] font-semibold text-ink">{food.name}</span>
        <span className="truncate text-[13px] text-muted">
          {formatNumber(food.per100g.kcal)} kcal {per100Label(food.unit)}
          {food.brand ? ` · ${food.brand}` : food.source !== 'manual' ? ` · ${FOOD_SOURCE_LABEL[food.source]}` : ''}
        </span>
      </div>
      <FavoriteButton
        name={food.name}
        isFavorite={food.isFavorite}
        disabled={toggleFavorite.isPending}
        onToggle={() => toggleFavorite.mutate({ id: food.id, isFavorite: !food.isFavorite })}
      />
      <Link
        to={foodPath(food)}
        aria-label={`Modifica ${food.name}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16z" />
          <path d="M13 7l4 4" />
        </svg>
      </Link>
    </li>
  )

  const section = (title: string, list: readonly Food[], badge?: string) => (
    <section aria-label={title} className="px-5 pt-5">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
        {badge && (
          <span aria-hidden="true" className="text-green">
            {badge}
          </span>
        )}
        {title}
      </h2>
      <ul className="mt-2 space-y-2">{list.map(row)}</ul>
    </section>
  )

  return (
    <>
      <ScreenHeader title="Cibi" />
      <div data-tour="foods-actions" className="grid grid-cols-2 gap-3 px-5 pt-4">
        <Link to="/cibi/nuovo" className={`${primaryButtonClass} flex items-center justify-center`}>
          Nuovo cibo
        </Link>
        <Link to="/cibi/ricette/nuova" className={`${secondaryButtonClass} flex items-center justify-center`}>
          Nuova ricetta
        </Link>
      </div>

      <div className="px-5 pt-4">
        <label htmlFor="food-search" className="sr-only">
          Cerca nei tuoi cibi
        </label>
        <input
          id="food-search"
          type="search"
          placeholder="Cerca nei tuoi cibi"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={inputClass}
        />
      </div>

      {foods.isPending && <ListSkeleton />}
      {foods.isError && <ErrorState message={errorMessage(foods.error)} onRetry={() => void foods.refetch()} />}
      {toggleFavorite.isError && <ErrorState message={errorMessage(toggleFavorite.error)} />}

      {foods.isSuccess && all.length === 0 && (
        <EmptyState text="Non hai ancora nessun cibo. Creane uno, oppure sceglilo dal Catalogo in Aggiungi pasto." />
      )}

      {foods.isSuccess && all.length > 0 && searching && (
        <>
          {filterByQuery(all, query).length === 0 ? (
            <EmptyState text={`Nessun cibo trovato per "${query.trim()}".`} />
          ) : (
            section('Risultati', filterByQuery(all, query))
          )}
        </>
      )}

      {foods.isSuccess && all.length > 0 && !searching && (
        <>
          {favorites.length > 0 ? (
            section('Preferiti', favorites, '★')
          ) : (
            <p className="px-5 pt-5 text-[13px] text-muted">Tocca la stella di un cibo per averlo qui tra i preferiti.</p>
          )}
          {recent.length > 0 && section('Alimenti recenti', recent)}
          <div className="px-5 pt-5">
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((open) => !open)}
              className="flex min-h-11 items-center gap-1 text-[15px] font-semibold text-green-dark"
            >
              {showAll ? 'Nascondi tutti i tuoi cibi' : `Tutti i tuoi cibi (${all.length})`}
            </button>
          </div>
          {showAll && section('Tutti i tuoi cibi', all)}
        </>
      )}
    </>
  )
}
