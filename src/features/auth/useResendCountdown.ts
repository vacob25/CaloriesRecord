import { useEffect, useState } from 'react'

import { secondsUntilResend } from '../../lib/auth'

/** Secondi mancanti al prossimo reinvio, aggiornati ogni secondo finché servono. */
export function useResendCountdown(sentAt: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  // Dopo un nuovo invio `now` può essere rimasto fermo a prima: l'invio stesso è il minimo "adesso" possibile.
  const seconds = sentAt === null ? 0 : secondsUntilResend(sentAt, Math.max(now, sentAt))

  const counting = seconds > 0

  useEffect(() => {
    if (!counting) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [counting, sentAt])

  return seconds
}
