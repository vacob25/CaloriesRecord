import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { loadInitialSession, watchSession } from '../data/auth'
import { SessionContext, toSessionState, type SessionState } from './session'

const OFFLINE_HINT_MS = 1500

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // Cambiamenti successivi (accesso, rinnovo, uscita). Un rinnovo fallito per rete
  // assente non produce un'uscita, quindi non butta fuori l'utente.
  useEffect(() => watchSession((session) => setState(toSessionState(session))), [])

  // Stato iniziale, riletto a ogni "Riprova".
  useEffect(() => {
    let cancelled = false
    void loadInitialSession().then((result) => {
      if (cancelled) return
      setState((current) => {
        // Se nel frattempo è arrivato un evento (es. accesso), vince quello.
        if (current.status !== 'loading' && current.status !== 'offline') return current
        return result.status === 'offline' ? { status: 'offline' } : toSessionState(result.session)
      })
    })
    // Con il token scaduto supabase-js ritenta il rinnovo fino a ~30 s: se il telefono
    // è offline è inutile aspettare, lo diciamo subito.
    const offlineTimer = window.setTimeout(() => {
      if (!navigator.onLine) setState((current) => (current.status === 'loading' ? { status: 'offline' } : current))
    }, OFFLINE_HINT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(offlineTimer)
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  // Quando torna la rete si riprova da soli.
  useEffect(() => {
    if (state.status !== 'offline') return
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [state.status, retry])

  const value = useMemo(() => ({ state, retry }), [state, retry])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
