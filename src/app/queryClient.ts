import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // I dati cambiano solo da questo telefono: 30 s bastano, e si ricaricano al ritorno nell'app.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
})
