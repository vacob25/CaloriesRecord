import { useState, type FormEvent } from 'react'

import { Field } from '../../components/Field'
import { FormMessage } from '../../components/States'
import { primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useSaveWeight, useWeights } from '../../data/queries'
import { addDays } from '../../lib/dates'
import { formatNumber } from '../../lib/numbers'
import { validateWeight } from '../../lib/profileValidation'
import { needsJumpConfirmation } from '../../lib/weight'

/** Pill del peso di oggi: un tocco apre l'inserimento (upsert: la seconda pesata sostituisce la prima). */
export function WeightPill({ date }: { date: string }) {
  const weights = useWeights(addDays(date, -1))
  const save = useSaveWeight()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmJump, setConfirmJump] = useState(false)
  const todayLog = weights.data?.find((log) => log.date === date)

  function openSheet() {
    setText(todayLog ? String(todayLog.kg).replace('.', ',') : '')
    setError(null)
    setConfirmJump(false)
    save.reset()
    setOpen(true)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateWeight(text)
    if (!result.ok) return setError(result.message)
    setError(null)
    if (!confirmJump && needsJumpConfirmation(weights.data ?? [], date, result.value)) {
      setConfirmJump(true)
      return
    }
    save.mutate({ day: date, kg: result.value }, { onSuccess: () => setOpen(false) })
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="min-h-11 rounded-full bg-surface px-4 text-[13px] font-bold text-blue shadow-[0_1px_3px_rgba(21,23,30,0.08)]"
      >
        {todayLog ? `${formatNumber(todayLog.kg, 1)} kg` : 'Registra peso'}
      </button>
      {open && (
        <>
          <button type="button" aria-label="Chiudi" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-ink/30" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="weight-title"
            className="fixed inset-x-0 z-40 mx-auto max-w-[480px] rounded-t-sheet bg-surface p-5"
            style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom))' }}
          >
            <h2 id="weight-title" className="text-[18px] font-extrabold">
              Peso di oggi
            </h2>
            <p className="text-[13px] text-muted">Conta la tendenza, non la singola pesata.</p>
            <form onSubmit={handleSubmit} noValidate className="mt-3">
              <Field
                id="weight-today"
                label="Peso"
                inputMode="decimal"
                suffix="kg"
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setConfirmJump(false)
                }}
                error={error ?? undefined}
              />
              {confirmJump && (
                <FormMessage kind="warning">
                  più di 2 kg di differenza da ieri. Se è giusto, tocca di nuovo Salva.
                </FormMessage>
              )}
              {save.isError && <FormMessage kind="error">{errorMessage(save.error)}</FormMessage>}
              <button type="submit" disabled={save.isPending} className={`${primaryButtonClass} mt-4`}>
                {save.isPending ? 'Salvataggio…' : 'Salva'}
              </button>
            </form>
          </div>
        </>
      )}
    </>
  )
}
