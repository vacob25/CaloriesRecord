import { createContext, useContext } from 'react'

import type { Session } from '../data/auth'

export type SessionState =
  | { status: 'loading' }
  /** Sessione salvata ma non verificabile senza rete: non è un'uscita. */
  | { status: 'offline' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session }

export interface SessionContextValue {
  state: SessionState
  /** Riprova a leggere la sessione (dopo "Serve la connessione"). */
  retry: () => void
}

export const SessionContext = createContext<SessionContextValue>({
  state: { status: 'loading' },
  retry: () => {},
})

export function useSession(): SessionContextValue {
  return useContext(SessionContext)
}

export function toSessionState(session: Session | null): SessionState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut' }
}
