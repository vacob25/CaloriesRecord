import { useState, type FormEvent } from 'react'

import { Field } from '../../components/Field'
import { SheetFrame } from '../../components/SheetFrame'
import { FormMessage } from '../../components/States'
import { primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useAddWater, useCreateContainer } from '../../data/queries'
import { CONTAINER_NAME_MAX } from '../../lib/constants'
import { validateContainerName, validateWaterMl } from '../../lib/water'

interface WaterSheetProps {
  date: string
  existingNames: readonly string[]
  onClose: () => void
}

/** Quantità libera in ml; se serve si salva come contenitore (es. la borraccia di tutti i giorni). */
export function WaterSheet({ date, existingNames, onClose }: WaterSheetProps) {
  const add = useAddWater(date)
  const create = useCreateContainer()
  const [mlText, setMlText] = useState('')
  const [save, setSave] = useState(false)
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<{ ml?: string; name?: string }>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ml = validateWaterMl(mlText)
    const containerName = save ? validateContainerName(name, existingNames) : null
    const next = {
      ml: ml.ok ? undefined : ml.message,
      name: containerName && !containerName.ok ? containerName.message : undefined,
    }
    setErrors(next)
    if (!ml.ok || (containerName && !containerName.ok)) return
    try {
      if (containerName) {
        await create.mutateAsync({ name: containerName.value, ml: ml.value })
        // Contenitore salvato: se ora fallisce l'aggiunta, "Aggiungi" di nuovo non deve ricrearlo.
        setSave(false)
      }
      await add.mutateAsync(ml.value)
      onClose()
    } catch {
      // L'errore si mostra sotto il modulo (add.error / create.error).
    }
  }

  // Solo l'ultimo errore: dopo un nuovo tentativo riuscito quello vecchio sparisce.
  const error = add.isError ? add.error : create.isError && save ? create.error : null
  const busy = add.isPending || create.isPending

  return (
    <SheetFrame title="Altra quantità d'acqua" onClose={onClose}>
      {() => (
        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="mt-4 space-y-4">
          <Field
            id="water-ml"
            label="Millilitri"
            inputMode="numeric"
            autoComplete="off"
            suffix="ml"
            value={mlText}
            onChange={(event) => setMlText(event.target.value)}
            error={errors.ml}
          />
          <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-ink">
            <input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} className="size-5 accent-green" />
            Salva come contenitore
          </label>
          {save && (
            <Field
              id="water-name"
              label="Nome del contenitore"
              hint="Comparirà tra i tocchi rapidi, es. Borraccia."
              autoComplete="off"
              maxLength={CONTAINER_NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
            />
          )}
          {error && <FormMessage kind="error">{errorMessage(error)}</FormMessage>}
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Salvataggio…' : 'Aggiungi'}
          </button>
        </form>
      )}
    </SheetFrame>
  )
}
