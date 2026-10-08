import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { LoadingScreen } from './LoadingScreen'
import { OfflineScreen } from './OfflineScreen'
import { useSession } from './session'

/** Senza sessione si va al login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, retry } = useSession()
  if (state.status === 'loading') return <LoadingScreen />
  if (state.status === 'offline') return <OfflineScreen onRetry={retry} />
  if (state.status === 'signedOut') return <Navigate to="/login" replace />
  return children
}

/** Con una sessione attiva il login non serve: si torna all'app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { state, retry } = useSession()
  if (state.status === 'loading') return <LoadingScreen />
  if (state.status === 'offline') return <OfflineScreen onRetry={retry} />
  if (state.status === 'signedIn') return <Navigate to="/" replace />
  return children
}
