import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { renewSession } from '../data/auth'
import { DataError, isSessionExpiredCode } from '../data/dbErrors'

/** Token scaduto durante una richiesta: lo si rinnova (o si torna al login), l'utente riprova con "Riprova". */
function onError(error: unknown) {
  if (error instanceof DataError && isSessionExpiredCode(error.code)) void renewSession()
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      // I dati cambiano solo da questo telefono: 30 s bastano, e si ricaricano al ritorno nell'app.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    // networkMode predefinito ('online'): senza rete un salvataggio resta in attesa e parte da solo al ritorno
    // della rete. Il banner lo dice (OfflineBanner) e l'id deciso dall'app evita le voci doppie (ADR-079).
    mutations: { retry: 0 },
  },
})
