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

/**
 * Quantità libera in ml, oppure un nuovo contenitore (es. la borraccia di tutti i giorni).
 * Salvare un contenitore NON aggiunge acqua (step 17): poi si usa il suo "+" quando la bevi.
 */
export function WaterSheet({ date, existingNames, onClose }: WaterSheetProps) {
  const add = useAddWater(date)
  const create = useCreateContainer()
  const [mlText, setMlText] = useState('')
  const [asContainer, setAsContainer] = useState(false)
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<{ ml?: string; name?: string }>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ml = validateWaterMl(mlText)
    const containerName = asContainer ? validateContainerName(name, existingNames) : null
    setErrors({
      ml: ml.ok ? undefined : ml.message,
      name: containerName && !containerName.ok ? containerName.message : undefined,
    })
    if (!ml.ok || (containerName && !containerName.ok)) return
    if (containerName) create.mutate({ name: containerName.value, ml: ml.value }, { onSuccess: onClose })
    else add.mutate({ ml: ml.value, container: null }, { onSuccess: onClose })
  }

  const mutation = asContainer ? create : add
  const busy = add.isPending || create.isPending

  return (
    <SheetFrame title={asContainer ? 'Nuovo contenitore' : "Altra quantità d'acqua"} onClose={onClose}>
      {() => (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={asContainer}
              onChange={(event) => setAsContainer(event.target.checked)}
              className="size-5 accent-green"
            />
            Salva come contenitore (senza aggiungere acqua)
          </label>
          <Field
            id="water-ml"
            label={asContainer ? 'Capienza del contenitore' : 'Millilitri'}
            inputMode="numeric"
            autoComplete="off"
            suffix="ml"
            value={mlText}
            onChange={(event) => setMlText(event.target.value)}
            error={errors.ml}
          />
          {asContainer && (
            <Field
              id="water-name"
              label="Nome del contenitore"
              hint="Compare nell'elenco con il suo − / +. Es. Borraccia."
              autoComplete="off"
              maxLength={CONTAINER_NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
            />
          )}
          {mutation.isError && <FormMessage kind="error">{errorMessage(mutation.error)}</FormMessage>}
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Salvataggio…' : asContainer ? 'Salva contenitore' : 'Aggiungi'}
          </button>
        </form>
      )}
    </SheetFrame>
  )
}
