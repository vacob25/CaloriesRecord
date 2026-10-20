import { useEffect, useState } from 'react'

/** L'ora di adesso, aggiornata ogni `everyMs` solo mentre `active`. Serve solo a ridisegnare i timer: il valore si calcola da orari salvati. */
export function useNow(active: boolean, everyMs = 1000): string {
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(new Date().toISOString()), everyMs)
    // Al ritorno nell'app il telefono può aver sospeso il timer: si aggiorna subito.
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date().toISOString())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, everyMs])
  return now
}
