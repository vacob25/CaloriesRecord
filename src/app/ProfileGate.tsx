import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { ErrorState } from '../components/States'
import { errorMessage } from '../data/dbErrors'
import { useProfile } from '../data/queries'
import { LoadingScreen } from './LoadingScreen'

/** Senza profilo si va alla prima apertura (/benvenuto). */
export function ProfileGate({ children }: { children: ReactNode }) {
  const profile = useProfile()
  if (profile.isPending) return <LoadingScreen />
  if (profile.isError) {
    return (
      <main className="mx-auto max-w-[480px] pt-[calc(env(safe-area-inset-top)+32px)]">
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
      </main>
    )
  }
  if (!profile.data) return <Navigate to="/benvenuto" replace />
  return children
}
