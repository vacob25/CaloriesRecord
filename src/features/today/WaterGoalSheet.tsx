import { useState, type FormEvent } from 'react'

import { Field } from '../../components/Field'
import { SheetFrame } from '../../components/SheetFrame'
import { FormMessage } from '../../components/States'
import { primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useUpdateWaterGoal } from '../../data/queries'
import { goalToText, validateWaterGoal } from '../../lib/water'

/**
 * Obiettivo dell'acqua, scelto dall'utente (ADR-049), impostabile da Oggi senza andare nel Profilo (step 23).
 * Campo numerico: tastiera con cifre e virgola, in litri.
 */
export function WaterGoalSheet({ goalMl, onClose }: { goalMl: number | null; onClose: () => void }) {
  const update = useUpdateWaterGoal()
  const [text, setText] = useState(goalToText(goalMl))
  const [error, setError] = useState<string | undefined>()

  function save(value: number | null) {
    update.mutate(value, { onSuccess: onClose })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateWaterGoal(text)
    if (!result.ok) return setError(result.message)
    setError(undefined)
    save(result.value)
  }

  return (
    <SheetFrame title="Obiettivo acqua" subtitle="Quanta acqua vuoi bere ogni giorno. Facoltativo." onClose={onClose}>
      {() => (
        <form onSubmit={handleSubmit} noValidate className="mt-3">
          <Field
            id="water-goal-sheet"
            label="Litri al giorno"
            hint="Per esempio 2,5. L'app non ne propone uno."
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            suffix="L"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setError(undefined)
            }}
            error={error}
          />
          {update.isError && <FormMessage kind="error">{errorMessage(update.error)}</FormMessage>}
          <button type="submit" disabled={update.isPending} className={`${primaryButtonClass} mt-4`}>
            {update.isPending ? 'Salvataggio…' : 'Salva obiettivo'}
          </button>
          {goalMl !== null && (
            <button type="button" disabled={update.isPending} onClick={() => save(null)} className={`${secondaryButtonClass} mt-2`}>
              Togli l’obiettivo
            </button>
          )}
        </form>
      )}
    </SheetFrame>
  )
}
