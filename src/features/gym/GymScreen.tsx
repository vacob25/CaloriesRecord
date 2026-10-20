import { Link } from 'react-router-dom'

import { ScreenHeader } from '../../components/ScreenHeader'
import { cardClass } from '../../components/ui'
import { useWorkoutPlans } from '../../data/queries'

function HubLink({ to, title, hint }: { to: string; title: string; hint: string }) {
  return (
    <Link to={to} className={`${cardClass} flex min-h-16 items-center justify-between px-5 py-4`}>
      <span>
        <span className="block text-[17px] font-extrabold">{title}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
      <span aria-hidden="true" className="text-[20px] text-muted">
        ›
      </span>
    </Link>
  )
}

/** Palestra: schede (Fase 4) ed esercizi (Fase 3); le sessioni di allenamento arrivano nella Fase 5. */
export function GymScreen() {
  const plans = useWorkoutPlans()
  const active = (plans.data ?? []).filter((plan) => !plan.isArchived).length
  return (
    <>
      <ScreenHeader title="Palestra" />
      <div className="space-y-3 px-5 pt-4">
        <HubLink
          to="/palestra/schede"
          title="Schede"
          hint={plans.data ? (active === 0 ? 'Crea la tua prima scheda' : active === 1 ? '1 scheda attiva' : `${active} schede attive`) : 'Giorni, esercizi, serie e ripetizioni'}
        />
        <HubLink to="/palestra/esercizi" title="Esercizi" hint="Cerca per gruppo muscolare o attrezzo, aggiungi note, crea i tuoi" />
        <p className="px-1 text-[13px] text-muted">Le sessioni di allenamento arrivano nei prossimi aggiornamenti.</p>
      </div>
    </>
  )
}
