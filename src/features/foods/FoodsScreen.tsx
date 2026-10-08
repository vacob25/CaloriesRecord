import { useState } from 'react'
import { Link } from 'react-router-dom'

import { FavoriteButton } from '../../components/FavoriteButton'
import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/States'
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useFoods, useToggleFavorite } from '../../data/queries'
import { FOOD_SOURCE_LABEL } from '../../lib/labels'
import { formatNumber } from '../../lib/numbers'
import { per100Label } from '../../lib/portions'
import { filterByQuery } from '../../lib/search'
import { foodPath } from './paths'

export function FoodsScreen() {
  const foods = useFoods()
  const toggleFavorite = useToggleFavorite()
  const [query, setQuery] = useState('')
  const visible = filterByQuery(foods.data ?? [], query)

  return (
    <>
      <ScreenHeader title="Cibi" />
      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
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

      {foods.isSuccess && foods.data.length === 0 && (
        <EmptyState text="Non hai ancora nessun cibo. Aggiungi quelli che mangi più spesso." />
      )}
      {foods.isSuccess && foods.data.length > 0 && visible.length === 0 && (
        <EmptyState text={`Nessun cibo trovato per "${query.trim()}".`} />
      )}

      {visible.length > 0 && (
        <ul className="space-y-2 px-5 pt-4">
          {visible.map((food) => (
            <li key={food.id} className={`${cardClass} flex items-center gap-1 pr-1`}>
              <Link to={foodPath(food)} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center py-2 pl-4">
                <span className="truncate text-[15px] font-semibold text-ink">{food.name}</span>
                <span className="truncate text-[13px] text-muted">
                  {[FOOD_SOURCE_LABEL[food.source], food.brand].filter(Boolean).join(' · ')}
                </span>
              </Link>
              <span className="shrink-0 text-right text-[13px] text-ink-2">
                <span className="font-bold">{formatNumber(food.per100g.kcal)}</span> kcal
                <span className="block text-muted">{per100Label(food.unit)}</span>
              </span>
              <FavoriteButton
                name={food.name}
                isFavorite={food.isFavorite}
                disabled={toggleFavorite.isPending}
                onToggle={() => toggleFavorite.mutate({ id: food.id, isFavorite: !food.isFavorite })}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
