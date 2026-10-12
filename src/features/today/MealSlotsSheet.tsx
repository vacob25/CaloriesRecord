import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'

import { SheetFrame } from '../../components/SheetFrame'
import { FormMessage } from '../../components/States'
import { inputClass, primaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useMealSlotActions } from '../../data/queries'
import { MEAL_NAME_MAX, MEAL_SLOTS_MAX } from '../../lib/constants'
import {
  canAddSlot,
  canRemoveSlot,
  dragTargetIndex,
  moveSlot,
  newSlotKey,
  reorderByDrag,
  validateMealName,
  type MealSlot,
} from '../../lib/mealSlots'

interface MealSlotsSheetProps {
  slots: readonly MealSlot[]
  onClose: () => void
}

/** Tenendo premuto su una riga (o subito sulle due linee) il pasto si solleva e si trascina su e giù. */
const LONG_PRESS_MS = 350
const PRESS_SLOP_PX = 8

interface DragState {
  key: string
  from: number
  to: number
  dy: number
  /** Altezza di una riga con il separatore (px). */
  pitch: number
  /** Rilasciato: la riga scivola al suo posto prima di salvare. */
  settling: boolean
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
export function MealSlotsSheet({ slots: savedSlots, onClose }: MealSlotsSheetProps) {
  const actions = useMealSlotActions()
  // Durante il salvataggio del nuovo ordine si mostra già quello nuovo (niente salto in attesa del server).
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)
  const slots = pendingOrder
    ? pendingOrder.map((key) => savedSlots.find((slot) => slot.key === key)).filter((slot): slot is MealSlot => slot !== undefined)
    : savedSlots
  const [drag, setDrag] = useState<DragState | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const press = useRef<{
    key: string
    from: number
    pointerId: number
    startX: number
    startY: number
    pitch: number
    timer: number | null
    active: boolean
  } | null>(null)
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

  function saveOrder(keys: string[]) {
    resetErrors()
    setPendingOrder(keys)
    actions.reorder.mutate(keys, { onSettled: () => setPendingOrder(null) })
  }

  /** Alternativa senza trascinare (tastiera e VoiceOver): freccia su / giù sulle due linee del pasto. */
  function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>, slot: MealSlot) {
    if (busy || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    saveOrder(moveSlot(slots, slot.key, event.key === 'ArrowUp' ? -1 : 1).map((item) => item.key))
  }

  // Mentre si trascina la pagina non deve scorrere. Il listener non passivo è registrato una volta sola, all'apertura
  // (su iOS uno aggiunto a gesto iniziato verrebbe ignorato) e agisce solo se un trascinamento è attivo.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const stop = (event: TouchEvent) => {
      if (press.current?.active && event.cancelable) event.preventDefault()
    }
    list.addEventListener('touchmove', stop, { passive: false })
    return () => list.removeEventListener('touchmove', stop)
  }, [])

  function activate(key: string, from: number) {
    const current = press.current
    if (!current || current.key !== key) return
    current.active = true
    current.timer = null
    navigator.vibrate?.(10)
    setDrag({ key, from, to: from, dy: 0, pitch: current.pitch, settling: false })
  }

  function onRowPointerDown(event: PointerEvent<HTMLLIElement>, slot: MealSlot, index: number) {
    if (busy || editing !== null || confirming !== null || press.current || drag) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as HTMLElement
    const onHandle = target.closest('[data-drag-handle]') !== null
    // Matita ed elimina restano normali pulsanti: il trascinamento parte solo dal resto della riga o dalle due linee.
    if (!onHandle && target.closest('button, input')) return
    const rows = listRef.current?.children
    const pitch =
      rows && rows.length > 1 ? (rows[1] as HTMLElement).offsetTop - (rows[0] as HTMLElement).offsetTop : event.currentTarget.offsetHeight
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = {
      key: slot.key,
      from: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pitch,
      timer: null,
      active: false,
    }
    if (onHandle) activate(slot.key, index)
    else press.current.timer = window.setTimeout(() => activate(slot.key, index), LONG_PRESS_MS)
  }

  function onRowPointerMove(event: PointerEvent<HTMLLIElement>) {
    const current = press.current
    if (!current || current.pointerId !== event.pointerId) return
    if (!current.active) {
      // Un dito che si muove prima del tempo vuole scorrere l'elenco, non spostare il pasto.
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > PRESS_SLOP_PX) {
        if (current.timer !== null) window.clearTimeout(current.timer)
        press.current = null
      }
      return
    }
    const min = -current.from * current.pitch
    const max = (slots.length - 1 - current.from) * current.pitch
    const dy = Math.max(min, Math.min(max, event.clientY - current.startY))
    setDrag({ key: current.key, from: current.from, dy, pitch: current.pitch, to: dragTargetIndex(current.from, dy, current.pitch, slots.length), settling: false })
  }

  function endPress(event: PointerEvent<HTMLLIElement>, cancelled: boolean) {
    const current = press.current
    if (!current || current.pointerId !== event.pointerId) return
    if (current.timer !== null) window.clearTimeout(current.timer)
    press.current = null
    if (!current.active) return
    const state = drag
    if (!state) return
    const to = cancelled ? state.from : state.to
    // La riga scivola nella sua posizione, poi si salva.
    setDrag({ ...state, to, dy: (to - state.from) * current.pitch, settling: true })
    window.setTimeout(() => {
      setDrag(null)
      if (to !== state.from) saveOrder(reorderByDrag(slots, state.from, to).map((item) => item.key))
    }, 180)
  }

  return (
    <SheetFrame title="I tuoi pasti" subtitle="Crea, rinomina e riordina i pasti della giornata." onClose={onClose}>
      {() => (
        <div className="-mx-3 max-h-[62dvh] overflow-y-auto px-3 py-2">
          <ul ref={listRef} className="mt-2 divide-y divide-line">
            {slots.map((slot, index) => {
              // Le altre righe si fanno da parte mentre quella sollevata passa.
              const lifted = drag?.key === slot.key
              let shift = 0
              if (drag && !lifted) {
                if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -1
                else if (drag.from > drag.to && index >= drag.to && index < drag.from) shift = 1
              }
              const pitch = drag?.pitch ?? 49
              return (
              <li
                key={slot.key}
                onPointerDown={(event) => onRowPointerDown(event, slot, index)}
                onPointerMove={onRowPointerMove}
                onPointerUp={(event) => endPress(event, false)}
                onPointerCancel={(event) => endPress(event, true)}
                onContextMenu={(event) => event.preventDefault()}
                style={
                  drag
                    ? {
                        transform: `translateY(${lifted ? drag.dy : shift * pitch}px)`,
                        scale: lifted ? '1.03' : undefined,
                        transition: lifted ? (drag.settling ? 'transform 180ms ease-out, scale 150ms, box-shadow 150ms' : 'scale 150ms, box-shadow 150ms') : 'transform 200ms ease-out',
                        zIndex: lifted ? 10 : undefined,
                      }
                    : undefined
                }
                className={`relative min-h-12 py-1 select-none [-webkit-touch-callout:none] ${
                  lifted ? '-mx-3 rounded-card bg-surface px-3 shadow-[0_10px_28px_rgba(21,23,30,0.22)]' : ''
                }`}
              >
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
                    <button
                      type="button"
                      data-drag-handle
                      aria-disabled={busy || undefined}
                      onKeyDown={(event) => onHandleKeyDown(event, slot)}
                      aria-label={`Riordina ${slot.name}: tieni premuto e trascina, oppure usa le frecce su e giù`}
                      className={`flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted ${busy ? 'opacity-30' : ''}`}
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                        <path d="M6 9.5h12M6 14.5h12" />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
              )
            })}
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
            Tieni premuto un pasto e trascinalo su o giù per riordinarlo. Rinominare non tocca le voci già registrate. Un pasto con delle voci non si può eliminare: rinominalo.
          </p>
        </div>
      )}
    </SheetFrame>
  )
}
