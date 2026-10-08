import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Registra il service worker e, quando c'è una nuova versione, chiede all'utente
 * se aggiornare (registerType 'prompt'). Su iOS l'aggiornamento arriva di solito
 * alla riapertura dell'app.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-20 mx-auto flex max-w-[480px] items-center gap-3 px-5"
      // Più in alto dell'avviso "Aggiunto · Annulla" (stessa base + la sua altezza): mai uno sopra l'altro.
      style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 76px)' }}
    >
      <div className="flex w-full items-center gap-2 rounded-button bg-ink py-2 pl-4 pr-2 text-surface shadow-lg">
        <p className="flex-1 text-[13px] font-semibold">Nuova versione disponibile</p>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="min-h-11 px-3 text-[13px] font-semibold"
        >
          Dopo
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-11 rounded-button bg-green px-4 text-[13px] font-bold"
        >
          Aggiorna
        </button>
      </div>
    </div>
  )
}
