import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/States'
import { cardClass, primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useWorkoutPlans } from '../../data/queries'

/** /palestra/schede — le schede attive; quelle archiviate si vedono a richiesta. */
export function PlansScreen() {
  const plans = useWorkoutPlans()
  const [showArchived, setShowArchived] = useState(false)
  const list = (plans.data ?? []).filter((plan) => showArchived || !plan.isArchived)
  const hasArchived = (plans.data ?? []).some((plan) => plan.isArchived)

  return (
    <>
      <ScreenHeader title="Schede" backTo="/palestra" />
      <div className="space-y-3 px-5 pt-4">
        <Link to="/palestra/schede/nuova" className={`${primaryButtonClass} flex items-center justify-center`}>
          + Nuova scheda
        </Link>
        {plans.isPending && <ListSkeleton rows={3} />}
        {plans.isError && <ErrorState message={errorMessage(plans.error)} onRetry={() => void plans.refetch()} />}
        {plans.data && list.length === 0 && <EmptyState text="Nessuna scheda. Creane una: scegli i giorni e gli esercizi di ognuno." />}
        <ul className="space-y-2">
          {list.map((plan) => (
            <li key={plan.id}>
              <Link to={`/palestra/schede/${plan.id}`} className={`${cardClass} flex min-h-16 items-center justify-between px-4 py-3`}>
                <span>
                  <span className="block text-[17px] font-extrabold leading-snug">{plan.name}</span>
                  <span className="block text-[13px] text-muted">
                    {plan.dayCount === 1 ? '1 giorno' : `${plan.dayCount} giorni`}
                    {plan.isArchived ? ' · archiviata' : ''}
                  </span>
                </span>
                <span aria-hidden="true" className="text-[20px] text-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {hasArchived && (
          <label className="flex min-h-11 items-center gap-3 text-[15px] text-ink">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-5 accent-green" />
            Mostra anche le archiviate
          </label>
        )}
      </div>
    </>
  )
}
