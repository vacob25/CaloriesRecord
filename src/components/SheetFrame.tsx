import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

interface SheetFrameProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: (titleId: string) => ReactNode
}

/** Elementi che la tastiera può raggiungere dentro il pannello. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Due pannelli aperti insieme (raro) bloccano lo scorrimento della pagina una volta sola.
let scrollLocks = 0
let overflowBefore = ''

function lockPageScroll() {
  if (scrollLocks === 0) {
    overflowBefore = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLocks += 1
}

function unlockPageScroll() {
  scrollLocks -= 1
  if (scrollLocks === 0) document.body.style.overflow = overflowBefore
}

/**
 * Pannello inferiore con sfondo scuro. Si chiude con la X (visibile, 44 px), con Esc o toccando lo sfondo.
 * Lo sfondo è nascosto agli screen reader: per loro c'è la X con etichetta.
 *
 * Accessibilità (revisione #8): all'apertura il focus va al titolo (VoiceOver lo legge), Tab resta dentro il pannello,
 * alla chiusura il focus torna al pulsante che l'ha aperto e la pagina sotto non scorre.
 * Altezza (revisione #9): mai oltre lo schermo, tolta la barra e le zone sicure; l'intestazione con la X resta ferma
 * e scorre solo il contenuto, così su iPhone piccoli la X si raggiunge sempre.
 */
export function SheetFrame({ title, subtitle, onClose, children }: SheetFrameProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  // Letto durante il primo render, prima che un eventuale autoFocus dei figli sposti il focus.
  const [opener] = useState(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null))

  useEffect(() => {
    lockPageScroll()
    // Se un figlio ha già preso il focus (es. un campo con autoFocus) lo si lascia dov'è.
    if (!dialogRef.current?.contains(document.activeElement)) titleRef.current?.focus({ preventScroll: true })
    return () => {
      unlockPageScroll()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [opener])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Tab e Maiusc+Tab girano dentro il pannello invece di uscire sulla pagina sotto. */
  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null || item === document.activeElement)
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === titleRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-30 bg-ink/30" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={keepFocusInside}
        className="fixed inset-x-0 z-40 mx-auto flex max-h-[calc(100dvh-var(--spacing-nav)-env(safe-area-inset-top)-env(safe-area-inset-bottom)-12px)] max-w-[480px] flex-col rounded-t-sheet bg-surface px-5 pt-4 pb-5 shadow-[0_-4px_20px_rgba(21,23,30,0.12)]"
        style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom))' }}
      >
        <div className="flex shrink-0 items-start gap-2">
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className="truncate text-[18px] font-extrabold outline-none">
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
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">{children(titleId)}</div>
      </div>
    </>
  )
}
