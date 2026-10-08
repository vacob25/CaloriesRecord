import { useEffect } from 'react'

interface ToastProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
  seconds: number
}

/** Avviso temporaneo sopra la barra (es. "Aggiunto · Annulla"). */
export function Toast({ message, actionLabel, onAction, onDismiss, seconds }: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, seconds * 1000)
    return () => window.clearTimeout(id)
  }, [onDismiss, seconds])

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-20 mx-auto flex max-w-[480px] px-5"
      style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="flex w-full items-center gap-2 rounded-button bg-ink py-2 pl-4 pr-2 text-surface shadow-lg">
        <p className="flex-1 text-[15px] font-semibold">{message}</p>
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="min-h-11 rounded-button px-4 text-[15px] font-bold text-green-tint">
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
