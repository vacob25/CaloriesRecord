import { useSyncExternalStore } from 'react'

import { usePendingSaves } from '../data/pendingSaves'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Banner "Serve la connessione" (DESIGN.md, Stati comuni): niente modalità offline in v1, lo si dice chiaramente. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  const pending = usePendingSaves()
  if (online) return null
  return (
    <div role="status" className="sticky top-[env(safe-area-inset-top)] z-20 bg-ink px-5 py-2 text-center text-[13px] font-semibold text-surface">
      {pending > 0
        ? 'Salvataggio in attesa: parte da solo quando torna la rete. Non chiudere l’app, altrimenti non viene salvato.'
        : 'Serve la connessione: i dati non si caricano e non si salvano finché non torna la rete.'}
    </div>
  )
}
