interface OfflineScreenProps {
  onRetry: () => void
}

/** Sessione salvata ma rete assente: si chiede la connessione, non un nuovo login. */
export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  return (
    <main className="mx-auto max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+48px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">Serve la connessione</h1>
      <p className="mt-3 text-[15px] text-ink-2">
        Non riesco a raggiungere il server. Non sei stato disconnesso: appena torna la rete l’app riparte da sola (al massimo dopo un minuto).
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 min-h-12 w-full rounded-button bg-green px-4 text-[15px] font-bold text-surface"
      >
        Riprova
      </button>
    </main>
  )
}
