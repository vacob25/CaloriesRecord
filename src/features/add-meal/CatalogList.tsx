import { EmptyState, ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { cardClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useCatalog, useFoods, useSaveCatalogFood } from '../../data/queries'
import type { Food } from '../../data/types'
import { CATALOG_CATEGORIES, type CatalogItem } from '../../lib/catalog'
import { formatNumber } from '../../lib/numbers'
import { filterByQuery } from '../../lib/search'

interface CatalogListProps {
  /** Vuota = tutto il catalogo per categoria; altrimenti solo le voci che corrispondono. */
  query: string
  onPick: (food: Food) => void
}

/** Ingredienti semplici con fonte (step 16, ADR-050): alla prima scelta la voce diventa un proprio cibo. */
export function CatalogList({ query, onPick }: CatalogListProps) {
  const catalog = useCatalog()
  const save = useSaveCatalogFood()
  const foods = useFoods()
  const searching = query.trim() !== ''
  // Voci già copiate tra i propri cibi: nella ricerca compaiono già sopra, qui non si ripetono.
  const owned = new Set((foods.data ?? []).map((food) => food.name.trim().toLowerCase()))
  const isOwned = (item: CatalogItem) => owned.has(item.name.toLowerCase())
  const items = filterByQuery(catalog.data ?? [], query).filter((item) => !searching || !isOwned(item))

  if (catalog.isPending) return searching ? null : <ListSkeleton />
  if (catalog.isError) return <ErrorState message={errorMessage(catalog.error)} />
  if (catalog.data.length === 0) {
    return searching ? null : <EmptyState text="Il catalogo degli ingredienti non è ancora stato caricato." />
  }
  if (items.length === 0) return null

  const row = (item: CatalogItem) => (
    <li key={item.id}>
      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate(item, { onSuccess: onPick })}
        className={`${cardClass} flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-60`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{item.name}</span>
          {searching && <span className="block truncate text-[13px] text-muted">{item.category}</span>}
          {!searching && isOwned(item) && <span className="block text-[13px] text-green-dark">Già tra i tuoi cibi</span>}
        </span>
        <span className="shrink-0 text-[13px] text-ink-2">
          <span className="font-bold">{formatNumber(item.kcal)}</span> kcal/100 {item.unit}
        </span>
      </button>
    </li>
  )

  return (
    <section aria-label="Catalogo degli ingredienti" className="px-5 pt-3">
      {save.isError && <FormMessage kind="error">{errorMessage(save.error)}</FormMessage>}
      {searching ? (
        <>
          <h2 className="pb-2 text-[13px] font-semibold text-ink-2">Dal catalogo</h2>
          <ul className="space-y-2">{items.map(row)}</ul>
        </>
      ) : (
        CATALOG_CATEGORIES.map((category) => {
          const inCategory = items.filter((item) => item.category === category)
          if (inCategory.length === 0) return null
          return (
            <div key={category} className="pb-3">
              <h2 className="pb-2 text-[13px] font-semibold text-ink-2">{category}</h2>
              <ul className="space-y-2">{inCategory.map(row)}</ul>
            </div>
          )
        })
      )}
      <p className="pt-1 pb-2 text-[13px] text-muted">
        Valori per 100 g di parte edibile dalle tabelle CREA, con la fonte per ogni voce. Alla prima scelta la voce si copia tra i tuoi cibi e puoi modificarla (anche aggiungere porzioni tue).
      </p>
    </section>
  )
}
