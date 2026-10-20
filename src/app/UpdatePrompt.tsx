import { useIsMutating } from '@tanstack/react-query'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * Registra il service worker e, quando c'è una nuova versione, chiede all'utente
 * se aggiornare (registerType 'prompt'). Su iOS un'app lasciata in background non si riavvia da sola:
 * il controllo si ripete quando si torna nell'app e ogni ora (revisione #4).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => void registration.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, CHECK_EVERY_MS)
    },
  })
  // "Aggiorna" ricarica l'app: non mentre un salvataggio è in corso (revisione #50).
  const saving = useIsMutating() > 0

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-[60] mx-auto flex max-w-[480px] items-center gap-3 px-5"
      // Più in alto dell'avviso "Aggiunto · Annulla" (stessa base + la sua altezza): mai uno sopra l'altro.
      style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 76px)' }}
    >
      <div className="flex w-full items-center gap-2 rounded-button bg-ink py-2 pl-4 pr-2 text-surface shadow-lg">
        <p className="flex-1 text-[13px] font-semibold">
          {saving ? 'Salvataggio in corso…' : 'Nuova versione disponibile: aggiornare ricarica l’app.'}
        </p>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="min-h-11 px-3 text-[13px] font-semibold"
        >
          Dopo
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void updateServiceWorker(true)}
          className="min-h-11 rounded-button bg-green px-4 text-[13px] font-bold disabled:opacity-50"
        >
          Aggiorna
        </button>
      </div>
    </div>
  )
}
