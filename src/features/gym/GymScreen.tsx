import { Link } from 'react-router-dom'

import { ScreenHeader } from '../../components/ScreenHeader'
import { cardClass } from '../../components/ui'

/** Palestra: per ora la libreria esercizi (Fase 3); schede e sessioni arrivano nelle fasi 4 e 5. */
export function GymScreen() {
  return (
    <>
      <ScreenHeader title="Palestra" />
      <div className="space-y-3 px-5 pt-4">
        <Link to="/palestra/esercizi" className={`${cardClass} flex min-h-16 items-center justify-between px-5 py-4`}>
          <span>
            <span className="block text-[17px] font-extrabold">Esercizi</span>
            <span className="block text-[13px] text-muted">Cerca per gruppo muscolare o attrezzo, aggiungi note, crea i tuoi</span>
          </span>
          <span aria-hidden="true" className="text-[20px] text-muted">
            ›
          </span>
        </Link>
        <p className="px-1 text-[13px] text-muted">Schede e sessioni di allenamento arrivano nei prossimi aggiornamenti.</p>
      </div>
    </>
  )
}
