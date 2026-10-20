import { useMutationState } from '@tanstack/react-query'

/** Quanti salvataggi sono in attesa della rete (TanStack li mette in pausa finché il telefono è offline). */
export function usePendingSaves(): number {
  return useMutationState({ filters: { status: 'pending' }, select: (mutation) => mutation.state.isPaused }).filter(Boolean).length
}
