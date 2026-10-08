import { WeightPill } from '../../components/WeightPill'
import { useDayTarget, useWeights } from '../../data/queries'
import { addDays } from '../../lib/dates'
import { daysSinceLastWeight, needsWeightReminder } from '../../lib/weight'

/**
 * Promemoria giornaliero in cima a Oggi (step 17): finché il peso di oggi non è registrato.
 * Più pesate = media mobile e ricalibrazione più affidabili (§4, §7).
 */
export function WeightReminder({ today }: { today: string }) {
  const weights = useWeights(addDays(today, -60))
  const target = useDayTarget(today)
  if (!weights.data || !needsWeightReminder(weights.data, today)) return null
  // La card del target sta già chiedendo il peso: non serve un secondo invito.
  if (target.data?.status === 'needsWeight') return null
  const since = daysSinceLastWeight(weights.data, today)
  return (
    <section aria-label="Promemoria peso" className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-card border-2 border-blue/30 bg-surface px-4 py-3">
      <p className="text-[15px] font-semibold text-ink">
        Pesati oggi
        <span className="block text-[13px] font-normal text-ink-2">
          {since === null || since > 1 ? 'Ultima pesata: ' + (since === null ? 'nessuna di recente' : `${since} giorni fa`) : 'Ultima pesata: ieri'}
          {', meglio al mattino'}
        </span>
      </p>
      <WeightPill date={today} />
    </section>
  )
}
