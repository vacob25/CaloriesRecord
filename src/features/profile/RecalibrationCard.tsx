import { useEffect, useRef } from 'react'

import { FormMessage } from '../../components/States'
import { cardClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { errorMessage } from '../../data/dbErrors'
import { useDecideProposal, useRecalibration } from '../../data/queries'
import { ENERGY_PER_KG, RECAL_BAND_MAX, RECAL_BAND_MIN, RECAL_FAT_WARNING_KG_WEEK, RECAL_MAX_CHANGE } from '../../lib/constants'
import { formatNumber, formatSigned as signed } from '../../lib/numbers'
import { dayTarget } from '../../lib/nutrition'

/** Scheda "Ricalibrazione" (step 10): proposta da confermare, mai automatica. */
export function RecalibrationCard() {
  const today = useToday()
  const recal = useRecalibration(today)
  const decide = useDecideProposal(today)
  const ref = useRef<HTMLElement>(null)

  // Arrivando da Oggi con #ricalibrazione la scheda si porta in vista (React Router non lo fa da solo).
  useEffect(() => {
    if (window.location.hash === '#ricalibrazione') ref.current?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <section ref={ref} id="ricalibrazione" aria-labelledby="recal-title" className={`${cardClass} mx-5 mt-4 p-5`}>
      <h2 id="recal-title" className="text-[18px] font-extrabold">
        Ricalibrazione
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Ogni settimana confronta calorie registrate e andamento del peso per correggere la stima del mantenimento.
      </p>
      {recal.isPending && <p className="mt-3 text-[13px] text-muted">Calcolo…</p>}
      {recal.isError && <FormMessage kind="error">{errorMessage(recal.error)}</FormMessage>}
      {recal.data && <Body state={recal.data} decide={decide} />}
      <details className="mt-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-green-dark">Limiti del calcolo</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-ink-2">
          <li>1 kg = {ENERGY_PER_KG} kcal è una semplificazione: la massa magra costa meno del grasso, quindi la stima può risultare un po’ bassa.</li>
          <li>Acqua, sale e carboidrati spostano il peso di 1-2 kg in pochi giorni: conta la tendenza.</li>
          <li>Se registri male le calorie, la stima è sbagliata: vale quanto i dati che inserisci.</li>
        </ul>
      </details>
    </section>
  )
}

function Body({
  state,
  decide,
}: {
  state: NonNullable<ReturnType<typeof useRecalibration>['data']>
  decide: ReturnType<typeof useDecideProposal>
}) {
  const { estimate, evaluation, currentMaintenanceKcal, currentBmrKcal, surplusPct } = state

  if (estimate?.status === 'pending' && estimate.proposedMaintenanceKcal !== null && estimate.avgIntakeKcal !== null && estimate.slopeKgWeek !== null) {
    const restTarget = dayTarget(estimate.proposedMaintenanceKcal, surplusPct, 'rest', 0)
    return (
      <div className="mt-3">
        <p className="text-[15px] text-ink">
          Negli ultimi {estimate.windowDays} giorni hai mangiato in media <strong>{formatNumber(estimate.avgIntakeKcal)} kcal</strong> e il peso è
          andato a <strong>{signed(estimate.slopeKgWeek, 2)} kg/settimana</strong> (banda {signed(RECAL_BAND_MIN, 2)} / {signed(RECAL_BAND_MAX, 2)}).
        </p>
        <p className="mt-2 text-[15px] text-ink">
          Mantenimento stimato dai tuoi dati: {formatNumber(estimate.estimatedMaintenanceKcal ?? 0)} kcal. Attuale:{' '}
          {formatNumber(currentMaintenanceKcal ?? 0)} kcal.
        </p>
        <p className="mt-2 text-[15px] font-bold text-ink">
          Proposta: mantenimento {formatNumber(estimate.proposedMaintenanceKcal)} kcal → target nei giorni di riposo {formatNumber(restTarget)} kcal.
        </p>
        <p className="mt-1 text-[13px] text-muted">La proposta resta entro ±{formatNumber(RECAL_MAX_CHANGE * 100)}% del mantenimento attuale. Se accetti, vale da domani.</p>
        {estimate.slopeKgWeek > RECAL_FAT_WARNING_KG_WEEK && (
          <FormMessage kind="warning">il peso sale più di {formatNumber(RECAL_FAT_WARNING_KG_WEEK, 2)} kg a settimana: l’eccesso è soprattutto grasso, per questo la proposta abbassa il mantenimento.</FormMessage>
        )}
        {decide.isError && <FormMessage kind="error">{errorMessage(decide.error)}</FormMessage>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ estimate, accept: false, currentBmrKcal })} className={secondaryButtonClass}>
            Rifiuta
          </button>
          <button
            type="button"
            disabled={decide.isPending || currentBmrKcal === null}
            onClick={() => decide.mutate({ estimate, accept: true, currentBmrKcal })}
            className={primaryButtonClass}
          >
            Accetta
          </button>
        </div>
      </div>
    )
  }

  if (estimate?.status === 'accepted') {
    return <p className="mt-3 text-[15px] font-semibold text-green-dark">Proposta di questa settimana accettata: vale da domani.</p>
  }
  if (estimate?.status === 'rejected') {
    return <p className="mt-3 text-[15px] text-ink-2">Proposta di questa settimana rifiutata: i parametri non sono cambiati.</p>
  }
  if (evaluation.status === 'notEnoughData') {
    return (
      <div className="mt-3 text-[15px] text-ink-2">
        <p className="font-semibold text-ink">Servono più dati.</p>
        <ul className="mt-1 list-disc pl-5 text-[13px]">
          {evaluation.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <p className="mt-3 text-[15px] text-ink-2">
      Sei nel ritmo voluto ({signed(evaluation.slopeKgWeek, 2)} kg/settimana): nessuna modifica proposta questa settimana.
    </p>
  )
}
