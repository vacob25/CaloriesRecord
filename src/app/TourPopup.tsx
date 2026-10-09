import { useEffect, useRef } from 'react'

import { isLastStep, TOUR_STEPS, tourLabel } from '../lib/tutorial'

interface TourPopupProps {
  index: number
  /** Schermata in cui si trova l'utente adesso: l'evidenziazione parte solo se coincide con quella del passo. */
  pathname: string
  onBack: () => void
  onNext: () => void
  onClose: () => void
}

/**
 * Tutorial a popup (step 19): piccola scheda sopra la barra di navigazione, senza oscurare la schermata,
 * così si vede (e si può toccare) l'elemento evidenziato. "Avanti" porta nella schermata del passo successivo.
 */
export function TourPopup({ index, pathname, onBack, onNext, onClose }: TourPopupProps) {
  const step = TOUR_STEPS[index]!
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Evidenzia l'elemento del passo (appena la schermata l'ha disegnato) e lo porta in vista.
  useEffect(() => {
    if (!step.target || pathname !== step.path) return
    let active: Element | null = null
    let attempts = 0
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timer = window.setInterval(() => {
      active = document.querySelector(`[data-tour="${step.target}"]`)
      attempts += 1
      if (active) {
        active.setAttribute('data-tour-active', 'true')
        active.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
        window.clearInterval(timer)
      } else if (attempts >= 20) {
        window.clearInterval(timer)
      }
    }, 100)
    return () => {
      window.clearInterval(timer)
      active?.removeAttribute('data-tour-active')
    }
  }, [step, pathname])

  // Chi usa VoiceOver sente il titolo del nuovo passo.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [index])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const last = isLastStep(index)
  return (
    <div
      role="dialog"
      aria-label="Tutorial"
      className="fixed inset-x-0 z-50 mx-auto max-w-[480px] px-5"
      style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="rounded-card border border-line bg-surface p-4 shadow-[0_8px_30px_rgba(21,23,30,0.25)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-green-dark" aria-live="polite">
            Tutorial · {tourLabel(index)}
          </p>
          <button type="button" onClick={onClose} className="-mr-2 min-h-11 px-3 text-[13px] font-semibold text-ink-2">
            Salta
          </button>
        </div>
        <h2 ref={titleRef} tabIndex={-1} className="mt-1 text-[18px] font-extrabold outline-none">
          {step.title}
        </h2>
        <p className="mt-1 text-[15px] leading-snug text-ink-2">{step.text}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          {TOUR_STEPS.map((item, i) => (
            <span key={item.id} className={`size-2 rounded-full ${i === index ? 'bg-green' : i < index ? 'bg-green/40' : 'bg-line'}`} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0}
            className="min-h-12 rounded-button border border-line bg-surface px-4 text-[15px] font-bold text-ink disabled:opacity-40"
          >
            Indietro
          </button>
          <button type="button" onClick={onNext} className="min-h-12 rounded-button bg-green px-4 text-[15px] font-bold text-surface">
            {last ? 'Fine' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  )
}
