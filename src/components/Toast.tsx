import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
  seconds: number
}

/** Avviso temporaneo sopra la barra (es. "Aggiunto · Annulla"). */
export function Toast({ message, actionLabel, onAction, onDismiss, seconds }: ToastProps) {
  // Con il focus (tastiera, VoiceOver) o il dito sopra il timer si ferma: "Annulla" non sparisce sotto le mani (revisione #49).
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const id = window.setTimeout(onDismiss, seconds * 1000)
    return () => window.clearTimeout(id)
  }, [onDismiss, seconds, paused])

  return (
    <div
      role="status"
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
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
