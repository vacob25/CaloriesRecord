import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'

import { queryClient } from './queryClient'
import { useSession } from './session'

/** Cache dei dati (TanStack Query, ADR-007). All'uscita la cache si svuota: niente dati dell'utente in memoria. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { state } = useSession()

  useEffect(() => {
    if (state.status === 'signedOut') queryClient.clear()
  }, [state.status])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
