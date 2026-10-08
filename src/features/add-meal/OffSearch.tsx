import { useNavigate } from 'react-router-dom'

import { FormMessage } from '../../components/States'
import { cardClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useSaveOffFood, useSearchOff } from '../../data/queries'
import type { Food } from '../../data/types'
import { formatNumber } from '../../lib/numbers'
import type { OffSearchHit } from '../../lib/openFoodFacts'

interface OffSearchProps {
  query: string
  returnTo: string
  onPick: (food: Food) => void
}

/**
 * Ricerca su Open Food Facts: parte solo dal pulsante (limite 10 ricerche/min, mai mentre si scrive).
 * Alla prima scelta il prodotto si salva tra i propri cibi; se i dati sono incompleti si completa a mano.
 */
export function OffSearch({ query, returnTo, onPick }: OffSearchProps) {
  const navigate = useNavigate()
  const search = useSearchOff()
  const save = useSaveOffFood()
  const searchedFor = search.variables

  function pick(hit: OffSearchHit) {
    if (hit.conversion.kind === 'complete') {
      save.mutate(hit.conversion.values, { onSuccess: onPick })
      return
    }
    navigate('/cibi/nuovo', {
      state: {
        prefill: hit.conversion.form,
        source: 'open_food_facts',
        note: `Su Open Food Facts mancano: ${hit.conversion.missing.join(', ')}. Completa dall’etichetta e salva.`,
        returnTo,
      },
    })
  }

  return (
    <section aria-label="Open Food Facts" className="px-5 pt-4">
      <button
        type="button"
        onClick={() => search.mutate(query.trim())}
        disabled={search.isPending || query.trim().length < 2}
        className={secondaryButtonClass}
      >
        {search.isPending ? 'Cerco su Open Food Facts…' : `Cerca "${query.trim()}" su Open Food Facts`}
      </button>
      {search.isError && <FormMessage kind="error">{errorMessage(search.error)}</FormMessage>}
      {save.isError && <FormMessage kind="error">{errorMessage(save.error)}</FormMessage>}
      {search.isSuccess && search.data.length === 0 && (
        <p className="mt-3 text-[15px] text-ink-2">Nessun prodotto trovato per "{searchedFor}". Puoi crearlo da Cibi → Nuovo cibo.</p>
      )}
      {search.isSuccess && search.data.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label={`Risultati di Open Food Facts per ${searchedFor}`}>
          {search.data.map((hit) => (
            <li key={hit.code}>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => pick(hit)}
                className={`${cardClass} flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-60`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{hit.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {['Open Food Facts', hit.brand, hit.conversion.kind === 'incomplete' ? 'dati da completare' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-ink-2">
                  {hit.kcal === null ? '—' : <><span className="font-bold">{formatNumber(hit.kcal)}</span> kcal/100 g</>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted">
        Dati da Open Food Facts (ODbL), inseriti da volontari: controlla l’etichetta. Si salvano tra i tuoi cibi.
      </p>
    </section>
  )
}
