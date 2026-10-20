import { useEffect, useState } from 'react'

const STORAGE_KEY = 'caloriesrecord.wakeLock'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }

/** Preferenza "schermo sempre acceso durante l'allenamento" (di partenza sì), salvata sul telefono. */
function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Tiene lo schermo acceso mentre `active` e la preferenza è attiva (Wake Lock API, iPhone da iOS 16.4). Il blocco si perde quando
 * l'app va in secondo piano: lo si richiede di nuovo al ritorno. Se non è supportato, `supported` è false e non succede nulla.
 */
export function useWakeLock(active: boolean) {
  const [enabled, setEnabledState] = useState(readPreference)
  const supported = typeof navigator !== 'undefined' && Boolean((navigator as WakeLockNavigator).wakeLock)

  useEffect(() => {
    if (!active || !enabled || !supported) return
    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const lock = await (navigator as WakeLockNavigator).wakeLock!.request('screen')
        if (cancelled) void lock.release()
        else sentinel = lock
      } catch {
        // Batteria scarica o permesso negato: l'allenamento funziona lo stesso, lo schermo si spegne da solo.
      }
    }
    void acquire()
    const onVisible = () => document.visibilityState === 'visible' && void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [active, enabled, supported])

  const setEnabled = (value: boolean) => {
    setEnabledState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
    } catch {
      // senza archivio locale la scelta vale solo fino alla chiusura
    }
  }
  return { enabled, setEnabled, supported }
}
