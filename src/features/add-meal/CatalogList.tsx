import { useState } from 'react'

import { CategoryIcon } from '../../components/CategoryIcon'
import { FavoriteButton } from '../../components/FavoriteButton'
import { EmptyState, ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useCatalog, useFoods, useSaveCatalogFood, useToggleCatalogFavorite } from '../../data/queries'
import type { Food } from '../../data/types'
import { CATALOG_CATEGORIES, type CatalogCategory, type CatalogItem } from '../../lib/catalog'
import { favoritesFirst } from '../../lib/meals'
import { formatNumber } from '../../lib/numbers'
import { filterByQuery } from '../../lib/search'

interface CatalogListProps {
  /** Vuota = categorie a riquadri; altrimenti solo le voci che corrispondono. */
  query: string
  onPick: (food: Food) => void
}

/**
 * Ingredienti semplici con fonte (step 16, ADR-050). Step 17: categorie a riquadri con icona;
 * dentro una categoria ogni voce ha la stella dei preferiti e i preferiti stanno in cima.
 * Alla prima scelta (o alla prima stella) la voce diventa un proprio cibo.
 */
export function CatalogList({ query, onPick }: CatalogListProps) {
  const catalog = useCatalog()
  const save = useSaveCatalogFood()
  const toggleFavorite = useToggleCatalogFavorite()
  const foods = useFoods()
  const [category, setCategory] = useState<CatalogCategory | null>(null)
  const searching = query.trim() !== ''

  // Copie già tra i propri cibi, per nome: servono per la stella e per non ripetere le voci nella ricerca.
  const ownByName = new Map((foods.data ?? []).map((food) => [food.name.trim().toLowerCase(), food]))
  const ownCopy = (item: CatalogItem) => ownByName.get(item.name.toLowerCase())
  const isFavorite = (item: CatalogItem) => ownCopy(item)?.isFavorite ?? false

  if (catalog.isPending) return searching ? null : <ListSkeleton />
  if (catalog.isError) return <ErrorState message={errorMessage(catalog.error)} />
  if (catalog.data.length === 0) {
    return searching ? null : <EmptyState text="Il catalogo degli ingredienti non è ancora stato caricato." />
  }

  const row = (item: CatalogItem) => (
    <li key={item.id} className={`${cardClass} flex items-center gap-1 pr-1`}>
      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate(item, { onSuccess: onPick })}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{item.name}</span>
          {searching && <span className="block truncate text-[13px] text-muted">{item.category}</span>}
          {!searching && ownCopy(item) && <span className="block text-[13px] text-green-dark">Già tra i tuoi cibi</span>}
        </span>
        <span className="shrink-0 text-[13px] text-ink-2">
          <span className="font-bold">{formatNumber(item.kcal)}</span> kcal/100 {item.unit}
        </span>
      </button>
      <FavoriteButton
        name={item.name}
        isFavorite={isFavorite(item)}
        disabled={toggleFavorite.isPending}
        onToggle={() => toggleFavorite.mutate(item)}
      />
    </li>
  )

  const errors = (
    <>
      {save.isError && <FormMessage kind="error">{errorMessage(save.error)}</FormMessage>}
      {toggleFavorite.isError && <FormMessage kind="error">{errorMessage(toggleFavorite.error)}</FormMessage>}
    </>
  )

  if (searching) {
    const matches = filterByQuery(catalog.data, query).filter((item) => !ownCopy(item))
    if (matches.length === 0) return null
    return (
      <section aria-label="Catalogo degli ingredienti" className="px-5 pt-3">
        {errors}
        <h2 className="pb-2 text-[13px] font-semibold text-ink-2">Dal catalogo</h2>
        <ul className="space-y-2">{matches.map(row)}</ul>
      </section>
    )
  }

  if (category === null) {
    return (
      <section aria-label="Catalogo degli ingredienti" className="px-5 pt-3">
        <ul className="grid grid-cols-3 gap-2">
          {CATALOG_CATEGORIES.map((name) => {
            const count = catalog.data.filter((item) => item.category === name).length
            if (count === 0) return null
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setCategory(name)}
                  className={`${cardClass} flex min-h-28 w-full flex-col items-center justify-center gap-1 px-1 py-3 text-center`}
                >
                  <span className="text-green-dark">
                    <CategoryIcon category={name} />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-ink">{name}</span>
                  <span className="text-[12px] text-muted">{count === 1 ? "1 voce" : `${count} voci`}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="pt-3 pb-2 text-[13px] text-muted">
          Valori per 100 g di parte edibile dalle tabelle CREA, con la fonte per ogni voce. Con la stella metti una voce nei
          preferiti: compare in cima alla sua categoria e nei tuoi cibi.
        </p>
      </section>
    )
  }

  const items = favoritesFirst(
    catalog.data.filter((item) => item.category === category),
    isFavorite,
  )
  return (
    <section aria-label={`Catalogo: ${category}`} className="px-5 pt-3">
      <button
        type="button"
        onClick={() => setCategory(null)}
        className="flex min-h-11 items-center gap-1 text-[15px] font-semibold text-green-dark"
      >
        <span aria-hidden="true">‹</span> Tutte le categorie
      </button>
      <h2 className="flex items-center gap-2 pb-2 text-[18px] font-extrabold">
        <span className="text-green-dark">
          <CategoryIcon category={category} className="size-6" />
        </span>
        {category}
      </h2>
      {errors}
      <ul className="space-y-2">{items.map(row)}</ul>
    </section>
  )
}
