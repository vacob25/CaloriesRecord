import type { ReactNode } from 'react'

import { secondaryButtonClass } from './ui'

/** Caricamento: scheletro con la forma di una lista (DESIGN.md, "Stati comuni"). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Caricamento" className="space-y-3 px-5 pt-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-card bg-line/60" />
      ))}
    </div>
  )
}

/** Errore: messaggio + Riprova. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-5 mt-4 rounded-card bg-surface p-4">
      <p className="text-[15px] font-semibold text-ink">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${secondaryButtonClass} mt-3`}>
          Riprova
        </button>
      )}
    </div>
  )
}

/** Vuoto: frase + azione. */
export function EmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="mx-5 mt-6 rounded-card border-2 border-dashed border-line p-6 text-center">
      <p className="text-[15px] text-ink-2">{text}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

/** Messaggio sotto un modulo: errore (alert) o avviso. */
export function FormMessage({ kind, children }: { kind: 'error' | 'warning'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className="mt-4 flex gap-2 rounded-button border-l-4 border-ink bg-surface p-3 text-[15px] font-semibold text-ink"
    >
      <span aria-hidden="true">⚠︎</span>
      <span>
        {kind === 'warning' && 'Attenzione: '}
        {children}
      </span>
    </p>
  )
}
