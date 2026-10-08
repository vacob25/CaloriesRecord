import { useSyncExternalStore } from 'react'

import { localDate } from '../lib/dates'

function subscribe(onChange: () => void): () => void {
  // La PWA resta aperta in background per giorni: si ricontrolla al ritorno e ogni minuto.
  const id = window.setInterval(onChange, 60_000)
  document.addEventListener('visibilitychange', onChange)
  window.addEventListener('focus', onChange)
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onChange)
    window.removeEventListener('focus', onChange)
  }
}

/** Giorno locale di Roma di adesso ('YYYY-MM-DD'), aggiornato anche dopo la mezzanotte. */
export function useToday(): string {
  return useSyncExternalStore(subscribe, () => localDate(new Date()))
}
