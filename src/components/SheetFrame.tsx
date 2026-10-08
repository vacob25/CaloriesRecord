import { useEffect, useId, type ReactNode } from 'react'

interface SheetFrameProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: (titleId: string) => ReactNode
}

/**
 * Pannello inferiore con sfondo scuro. Si chiude con la X (visibile, 44 px), con Esc o toccando lo sfondo.
 * Lo sfondo è nascosto agli screen reader: per loro c'è la X con etichetta.
 */
export function SheetFrame({ title, subtitle, onClose, children }: SheetFrameProps) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-30 bg-ink/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 z-40 mx-auto max-w-[480px] rounded-t-sheet bg-surface px-5 pt-4 pb-5 shadow-[0_-4px_20px_rgba(21,23,30,0.12)]"
        style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="truncate text-[18px] font-extrabold">
              {title}
            </h2>
            {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children(titleId)}
      </div>
    </>
  )
}
