import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'

import { validateGrams } from '../lib/foodValidation'
import { stepGrams } from '../lib/meals'
import { formatNumber, parseDecimal } from '../lib/numbers'
import type { Nutrients } from '../lib/nutrition'
import { FormMessage } from './States'
import { primaryButtonClass } from './ui'

interface GramsSheetProps {
  title: string
  subtitle?: string
  initialGrams: number
  servingG?: number | null
  /** Valori della porzione per i grammi indicati (calcolati in lib/, mai qui). */
  preview: (grams: number) => Nutrients
  submitLabel: string
  busy: boolean
  error?: string | null
  onSubmit: (grams: number) => void
  onClose: () => void
  /** Contenuto extra sopra il pulsante (es. scelta del pasto, Elimina). */
  children?: ReactNode
}

const decimalText = (value: number) => String(value).replace('.', ',')

/** Pannello inferiore: grammi con − / + a passi di 10 g, campo numerico e anteprima dal vivo. */
export function GramsSheet(props: GramsSheetProps) {
  const { title, subtitle, initialGrams, servingG, preview, submitLabel, busy, error, onSubmit, onClose, children } = props
  const titleId = useId()
  const [text, setText] = useState(decimalText(initialGrams))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const current = parseDecimal(text)
  const valid = validateGrams(text)
  const values = valid.ok ? preview(valid.value) : null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function step(direction: 1 | -1) {
    const base = current !== null && current > 0 ? current : initialGrams
    setText(decimalText(stepGrams(base, direction)))
    setFieldError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid.ok) {
      setFieldError(valid.message)
      return
    }
    onSubmit(valid.value)
  }

  const roundButton =
    'flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-bg text-[24px] font-bold text-ink disabled:opacity-40'

  return (
    <>
      <button type="button" aria-label="Chiudi" onClick={onClose} className="fixed inset-0 z-30 bg-ink/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 z-40 mx-auto max-w-[480px] rounded-t-sheet bg-surface px-5 pt-5 pb-5 shadow-[0_-4px_20px_rgba(21,23,30,0.12)]"
        style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom))' }}
      >
        <form onSubmit={handleSubmit} noValidate>
          <h2 id={titleId} className="truncate text-[18px] font-extrabold">
            {title}
          </h2>
          {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}

          <label htmlFor={`${titleId}-grams`} className="mt-4 block text-[13px] font-semibold text-ink-2">
            Grammi
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => step(-1)} aria-label="Togli 10 grammi" className={roundButton}>
              −
            </button>
            <div className="relative flex-1">
              <input
                id={`${titleId}-grams`}
                inputMode="decimal"
                autoComplete="off"
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setFieldError(null)
                }}
                aria-invalid={fieldError ? true : undefined}
                className="block min-h-12 w-full rounded-button border border-line bg-surface px-4 text-center text-[22px] font-extrabold tabular-nums outline-none focus:border-green focus:ring-2 focus:ring-green-tint"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[15px] text-muted">g</span>
            </div>
            <button type="button" onClick={() => step(1)} aria-label="Aggiungi 10 grammi" className={roundButton}>
              +
            </button>
          </div>
          {servingG ? (
            <button
              type="button"
              onClick={() => setText(decimalText(servingG))}
              className="mt-2 min-h-11 text-[15px] font-semibold text-green-dark"
            >
              1 porzione ({formatNumber(servingG, 1)} g)
            </button>
          ) : null}
          {fieldError && <FormMessage kind="error">{fieldError}</FormMessage>}

          <p className="mt-3 text-[15px] text-ink-2" aria-live="polite">
            {values ? (
              <>
                <span className="text-[22px] font-extrabold text-ink">{formatNumber(values.kcal)}</span> kcal · P{' '}
                {formatNumber(values.protein, 1)} g · C {formatNumber(values.carbs, 1)} g · G {formatNumber(values.fat, 1)} g
              </>
            ) : (
              'Inserisci i grammi per vedere i valori.'
            )}
          </p>

          {children}
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-4`}>
            {busy ? 'Salvataggio…' : submitLabel}
          </button>
        </form>
      </div>
    </>
  )
}
