import { WeightPill } from '../../components/WeightPill'
import { useWeights } from '../../data/queries'
import { addDays } from '../../lib/dates'
import { daysSinceLastWeight, needsWeightReminder } from '../../lib/weight'

/** Promemoria se non ti pesi da 5 giorni o più (ADR-047). Le regole del peso restano: meglio pesarsi spesso. */
export function WeightReminder({ today }: { today: string }) {
  const weights = useWeights(addDays(today, -60))
  if (!weights.data || !needsWeightReminder(weights.data, today)) return null
  const since = daysSinceLastWeight(weights.data, today)
  return (
    <section aria-label="Promemoria peso" className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-card border-2 border-blue/30 bg-surface px-4 py-3">
      <p className="text-[13px] font-semibold text-ink-2">
        {since === null ? 'Non hai pesate recenti.' : `Non ti pesi da ${since} giorni.`} Più pesate = andamento più affidabile.
      </p>
      <WeightPill date={today} />
    </section>
  )
}
