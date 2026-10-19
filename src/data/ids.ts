import { useState } from 'react'

/** Id nuovo (UUID v4) creato dal telefono: così la voce ha il suo id prima ancora di arrivare al database. */
export function newId(): string {
  return crypto.randomUUID()
}

export interface AttemptIds {
  /** Id per un gesto: lo stesso gesto ripetuto (doppio tocco, "Riprova") riusa l'id, un gesto diverso ne ha uno nuovo. */
  idFor: (signature: string) => string
  /** Da chiamare quando il salvataggio è riuscito: il gesto successivo, anche identico, è una voce nuova. */
  done: () => void
}

/**
 * Ricorda l'id dell'ultimo tentativo di salvataggio (ADR-079). Insieme a `insertOnce` fa sì che una richiesta
 * ripetuta non crei una seconda voce: stesso id = stessa voce.
 */
export function createAttemptIds(make: () => string = newId): AttemptIds {
  let last: { signature: string; id: string } | null = null
  return {
    idFor(signature) {
      if (last?.signature === signature) return last.id
      last = { signature, id: make() }
      return last.id
    },
    done() {
      last = null
    },
  }
}

/** Un `AttemptIds` per schermata (vive quanto il componente). */
export function useAttemptIds(): AttemptIds {
  return useState(() => createAttemptIds())[0]
}
