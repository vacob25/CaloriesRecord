import { useSyncExternalStore } from 'react'

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
  if (online) return null
  return (
    <div role="status" className="sticky top-0 z-20 bg-ink px-5 py-2 pt-[calc(env(safe-area-inset-top)+8px)] text-center text-[13px] font-semibold text-surface">
      Serve la connessione: i dati non si caricano e non si salvano finché non torna la rete.
    </div>
  )
}
