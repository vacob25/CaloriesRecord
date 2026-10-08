import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { validateGrams } from '../lib/foodValidation'
import { stepGrams } from '../lib/meals'
import { formatNumber, parseDecimal } from '../lib/numbers'
import type { Nutrients } from '../lib/nutrition'
import { formatCount, formatQuantity, portionAmount, stepCount, type FoodUnit, type Portion } from '../lib/portions'
import { SheetFrame } from './SheetFrame'
import { FormMessage } from './States'
import { primaryButtonClass } from './ui'

interface GramsSheetProps {
  title: string
  subtitle?: string
  initialGrams: number
  servingG?: number | null
  /** g o ml (liquidi): cambia solo etichette e messaggi, i calcoli sono gli stessi. */
  unit?: FoodUnit
  /** Porzioni casalinghe del cibo: si sceglie la porzione e quante (passi di ½). */
  portions?: readonly Portion[]
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
  const { title, subtitle, initialGrams, servingG, unit = 'g', portions = [], preview, submitLabel, busy, error, onSubmit, onClose, children } =
    props
  const titleId = useId()
  const [text, setText] = useState(decimalText(initialGrams))
  const [fieldError, setFieldError] = useState<string | null>(null)
  /** Porzione scelta e quante; si azzera appena la quantità si cambia a mano. */
  const [chosen, setChosen] = useState<{ index: number; count: number } | null>(null)
  const current = parseDecimal(text)
  const valid = validateGrams(text, unit)
  const values = valid.ok ? preview(valid.value) : null
  const chosenPortion = chosen ? portions[chosen.index] : undefined
  const unitWord = unit === 'ml' ? 'ml' : 'grammi'

  function step(direction: 1 | -1) {
    const base = current !== null && current > 0 ? current : initialGrams
    setText(decimalText(stepGrams(base, direction)))
    setChosen(null)
    setFieldError(null)
  }

  function choose(index: number, count: number) {
    const portion = portions[index]
    if (!portion) return
    setChosen({ index, count })
    setText(decimalText(portionAmount(portion, count)))
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
    <SheetFrame title={title} subtitle={subtitle} onClose={onClose}>
      {() => (
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor={`${titleId}-grams`} className="mt-4 block text-[13px] font-semibold text-ink-2">
            {unit === 'ml' ? 'Millilitri' : 'Grammi'}
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => step(-1)} aria-label={`Togli 10 ${unitWord}`} className={roundButton}>
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
                  setChosen(null)
                  setFieldError(null)
                }}
                aria-invalid={fieldError ? true : undefined}
                className="block min-h-12 w-full rounded-button border border-line bg-surface px-4 text-center text-[22px] font-extrabold tabular-nums outline-none focus:border-green focus:ring-2 focus:ring-green-tint"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[15px] text-muted">{unit}</span>
            </div>
            <button type="button" onClick={() => step(1)} aria-label={`Aggiungi 10 ${unitWord}`} className={roundButton}>
              +
            </button>
          </div>
          {portions.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] font-semibold text-ink-2">Porzioni</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {portions.map((portion, index) => (
                  <button
                    key={`${portion.name}-${index}`}
                    type="button"
                    aria-pressed={chosen?.index === index}
                    onClick={() => choose(index, chosen?.index === index ? chosen.count : 1)}
                    className={`min-h-11 rounded-full border px-4 text-[15px] font-semibold ${
                      chosen?.index === index ? 'border-green bg-green-tint text-ink' : 'border-line bg-surface text-ink-2'
                    }`}
                  >
                    {portion.name} ({formatQuantity(portion.amount, unit)})
                  </button>
                ))}
              </div>
              {chosen && chosenPortion && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => choose(chosen.index, stepCount(chosen.count, -1))}
                    disabled={stepCount(chosen.count, -1) === chosen.count}
                    aria-label="Mezza porzione in meno"
                    className={roundButton}
                  >
                    −
                  </button>
                  <p className="flex-1 text-center text-[15px] text-ink-2" aria-live="polite">
                    <span className="text-[20px] font-extrabold text-ink">{formatCount(chosen.count)}</span> × {chosenPortion.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => choose(chosen.index, stepCount(chosen.count, 1))}
                    aria-label="Mezza porzione in più"
                    className={roundButton}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}
          {servingG && portions.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setText(decimalText(servingG))
                setChosen(null)
              }}
              className="mt-2 min-h-11 text-[15px] font-semibold text-green-dark"
            >
              1 porzione ({formatQuantity(servingG, unit)})
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
              `Inserisci ${unit === 'ml' ? 'i ml' : 'i grammi'} per vedere i valori.`
            )}
          </p>

          {children}
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-4`}>
            {busy ? 'Salvataggio…' : submitLabel}
          </button>
        </form>
      )}
    </SheetFrame>
  )
}
