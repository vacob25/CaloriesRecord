import { useState } from 'react'

import { SheetFrame } from '../../components/SheetFrame'
import { SportsFields } from '../../components/SportsFields'
import { FormMessage } from '../../components/States'
import { primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { errorMessage } from '../../data/dbErrors'
import { useChooseSports } from '../../data/queries'
import { deferSportsChoice } from './sportsChoice'

/**
 * Scelta degli sport dopo l'azzeramento della correzione #18 (migrazione 009, ADR-077). Si può salvare anche
 * senza sport ("Non faccio sport"). Finché non si sceglie, ogni giorno conta come riposo.
 */
export function SportsChoiceSheet({ onClose }: { onClose: () => void }) {
  const today = useToday()
  const choose = useChooseSports()
  const [sports, setSports] = useState<string[]>([])

  function later() {
    deferSportsChoice()
    onClose()
  }

  return (
    <SheetFrame title="Scegli i tuoi sport" onClose={later}>
      {() => (
        <>
          {/* Solo testo e sport scorrono: i pulsanti restano sempre raggiungibili, anche su iPhone piccoli. */}
          <div className="-mx-3 mt-2 max-h-[calc(100dvh-var(--spacing-nav)-env(safe-area-inset-top)-env(safe-area-inset-bottom)-240px)] space-y-4 overflow-y-auto px-3 pb-1">
          <p className="text-[15px] text-ink-2">
            Per un errore ti avevamo assegnato Palestra e Calcio senza chiedertelo: li abbiamo tolti. Scegli gli sport che fai
            davvero, oppure nessuno.
          </p>
          <p className="text-[13px] text-muted">
            Finché non scegli, ogni giorno conta come riposo: il tuo obiettivo non include calorie di allenamento. I giorni passati
            restano come erano.
          </p>
          <SportsFields sports={sports} onChange={setSports} />
          {choose.isError && <FormMessage kind="error">{errorMessage(choose.error)}</FormMessage>}
          </div>
          <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={choose.isPending}
            onClick={() => choose.mutate({ sports, today }, { onSuccess: onClose })}
            className={primaryButtonClass}
          >
            {choose.isPending ? 'Salvataggio…' : sports.length > 0 ? 'Salva i miei sport' : 'Non faccio sport'}
          </button>
          <button type="button" onClick={later} className={secondaryButtonClass}>
            Più tardi
          </button>
          </div>
        </>
      )}
    </SheetFrame>
  )
}
