import { useState, type FormEvent } from 'react'

import { SheetFrame } from '../../components/SheetFrame'
import { FormMessage } from '../../components/States'
import { inputClass, primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useMealSlotActions } from '../../data/queries'
import { MEAL_NAME_MAX, MEAL_SLOTS_MAX } from '../../lib/constants'
import { canAddSlot, canRemoveSlot, moveSlot, newSlotKey, validateMealName, type MealSlot } from '../../lib/mealSlots'

interface MealSlotsSheetProps {
  slots: readonly MealSlot[]
  onClose: () => void
}

const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 disabled:opacity-30'

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

/**
 * Pasti su misura (step 20): crea, rinomina, ordina ed elimina. La chiave di un pasto non cambia quando lo rinomini:
 * le voci già registrate restano al loro posto. Un pasto con voci non si elimina (lo rifiuta il database).
 */
export function MealSlotsSheet({ slots, onClose }: MealSlotsSheetProps) {
  const actions = useMealSlotActions()
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const busy = actions.create.isPending || actions.rename.isPending || actions.reorder.isPending || actions.remove.isPending
  const serverError = [actions.create, actions.rename, actions.reorder, actions.remove].find((mutation) => mutation.isError)

  function resetErrors() {
    setError(null)
    for (const mutation of [actions.create, actions.rename, actions.reorder, actions.remove]) mutation.reset()
  }

  function startRename(slot: MealSlot) {
    resetErrors()
    setConfirming(null)
    setEditing(slot.key)
    setEditText(slot.name)
  }

  function submitRename(event: FormEvent<HTMLFormElement>, slot: MealSlot) {
    event.preventDefault()
    const result = validateMealName(editText, slots, slot.key)
    if (!result.ok) return setError(result.message)
    resetErrors()
    if (result.value === slot.name) return setEditing(null)
    actions.rename.mutate({ key: slot.key, name: result.value }, { onSuccess: () => setEditing(null) })
  }

  function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateMealName(newName, slots)
    if (!result.ok) return setError(result.message)
    resetErrors()
    actions.create.mutate({ slot: { key: newSlotKey(), name: result.value }, position: slots.length }, { onSuccess: () => setNewName('') })
  }

  function move(slot: MealSlot, direction: 1 | -1) {
    resetErrors()
    actions.reorder.mutate(moveSlot(slots, slot.key, direction).map((item) => item.key))
  }

  return (
    <SheetFrame title="I tuoi pasti" subtitle="Crea, rinomina e riordina i pasti della giornata." onClose={onClose}>
      {() => (
        <div className="max-h-[62dvh] overflow-y-auto">
          <ul className="mt-2 divide-y divide-line">
            {slots.map((slot, index) => (
              <li key={slot.key} className="min-h-12 py-1">
                {editing === slot.key ? (
                  <form onSubmit={(event) => submitRename(event, slot)} noValidate className="flex items-center gap-2">
                    <label htmlFor="rename-meal" className="sr-only">
                      Nome del pasto
                    </label>
                    <input
                      id="rename-meal"
                      value={editText}
                      maxLength={MEAL_NAME_MAX}
                      autoFocus
                      autoComplete="off"
                      onChange={(event) => {
                        setEditText(event.target.value)
                        setError(null)
                      }}
                      className={`${inputClass} !mt-0 flex-1`}
                    />
                    <button type="submit" disabled={busy} className="min-h-11 shrink-0 rounded-button bg-green px-4 text-[15px] font-bold text-surface disabled:opacity-60">
                      Salva
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="min-h-11 shrink-0 px-2 text-[15px] font-semibold text-ink-2">
                      Annulla
                    </button>
                  </form>
                ) : confirming === slot.key ? (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{slot.name}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        resetErrors()
                        actions.remove.mutate(slot.key, { onSettled: () => setConfirming(null) })
                      }}
                      className="min-h-11 shrink-0 rounded-button border-2 border-ink px-3 text-[15px] font-bold disabled:opacity-60"
                    >
                      Elimina davvero
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="min-h-11 shrink-0 px-2 text-[15px] font-semibold text-ink-2">
                      Annulla
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{slot.name}</span>
                    <button type="button" onClick={() => startRename(slot)} aria-label={`Rinomina ${slot.name}`} className={iconButton}>
                      <Icon path="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />
                    </button>
                    <button type="button" disabled={busy || index === 0} onClick={() => move(slot, -1)} aria-label={`Sposta ${slot.name} su`} className={iconButton}>
                      <Icon path="M6 15l6-6 6 6" />
                    </button>
                    <button type="button" disabled={busy || index === slots.length - 1} onClick={() => move(slot, 1)} aria-label={`Sposta ${slot.name} giù`} className={iconButton}>
                      <Icon path="M6 9l6 6 6-6" />
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canRemoveSlot(slots)}
                      onClick={() => {
                        resetErrors()
                        setEditing(null)
                        setConfirming(slot.key)
                      }}
                      aria-label={`Elimina ${slot.name}`}
                      className={iconButton}
                    >
                      <Icon path="M6 6l12 12M18 6L6 18" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={submitNew} noValidate className="mt-3 flex items-start gap-2">
            <div className="flex-1">
              <label htmlFor="new-meal" className="sr-only">
                Nome del nuovo pasto
              </label>
              <input
                id="new-meal"
                value={newName}
                maxLength={MEAL_NAME_MAX}
                disabled={!canAddSlot(slots)}
                autoComplete="off"
                placeholder={canAddSlot(slots) ? 'es. Dopo allenamento' : `Hai già ${MEAL_SLOTS_MAX} pasti`}
                onChange={(event) => {
                  setNewName(event.target.value)
                  setError(null)
                }}
                className={`${inputClass} !mt-0 disabled:opacity-60`}
              />
            </div>
            <button type="submit" disabled={busy || !canAddSlot(slots) || newName.trim() === ''} className={`${primaryButtonClass} !w-auto shrink-0 disabled:opacity-40`}>
              Aggiungi
            </button>
          </form>

          {error && <FormMessage kind="error">{error}</FormMessage>}
          {serverError && <FormMessage kind="error">{errorMessage(serverError.error)}</FormMessage>}
          <p className="mt-3 text-[13px] text-muted">
            Rinominare non tocca le voci già registrate. Un pasto con delle voci non si può eliminare: rinominalo.
          </p>
        </div>
      )}
    </SheetFrame>
  )
}
