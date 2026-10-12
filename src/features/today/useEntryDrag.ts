import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

const LONG_PRESS_MS = 350
const PRESS_SLOP_PX = 8
/** Fasce vicino ai bordi dello schermo in cui la pagina scorre da sola mentre si trascina (la barra in basso è alta ~72 px). */
const SCROLL_TOP_ZONE = 90
const SCROLL_BOTTOM_ZONE = 150
const SCROLL_STEP_PX = 12
const SETTLE_MS = 180
const DROP_MS = 140

export const ENTRY_DRAGGING_ATTRIBUTE = 'data-entry-dragging'

export interface DraggableEntry {
  id: string
  mealType: string
}

export interface EntryDragState {
  id: string
  dx: number
  dy: number
  /** Pasto sotto il dito (diverso da quello di partenza), o null. */
  over: string | null
  /** drag = segue il dito; drop = rilasciato su un pasto (sfuma); back = rilasciato fuori (torna al suo posto). */
  phase: 'drag' | 'drop' | 'back'
}

interface Press<T> {
  entry: T
  el: HTMLElement
  pointerId: number
  startX: number
  startY: number
  startScroll: number
  lastX: number
  lastY: number
  timer: number | null
  raf: number | null
  active: boolean
}

/** Pasto sotto il dito, ignorando la voce che si sta trascinando (è proprio sotto il dito, dentro il pasto di partenza). */
function mealUnder(x: number, y: number, dragged: HTMLElement): string | null {
  for (const element of document.elementsFromPoint(x, y)) {
    if (dragged.contains(element)) continue
    const key = (element as HTMLElement).closest?.('[data-meal-key]')?.getAttribute('data-meal-key')
    if (key) return key
  }
  return null
}

/**
 * Spostare una voce in un altro pasto trascinandola (step 21). Tenendo premuto ~350 ms su una voce, questa si solleva
 * (come in iOS), segue il dito e il pasto sotto il dito si evidenzia; rilasciando su un altro pasto la voce ci va, altrove torna
 * al suo posto. Vicino ai bordi la pagina scorre da sola. Un tocco veloce apre ancora la modifica; un movimento prima del
 * tempo è uno scorrimento (o lo swipe tra i giorni). Mentre si trascina lo swipe tra i giorni è sospeso.
 */
export function useEntryDrag<T extends DraggableEntry>({ enabled, onDrop }: { enabled: boolean; onDrop: (entry: T, mealKey: string) => void }) {
  const [drag, setDrag] = useState<EntryDragState | null>(null)
  const press = useRef<Press<T> | null>(null)
  const swallowClick = useRef(false)
  const timers = useRef<number[]>([])
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop
  })

  // La pagina non scorre sotto il dito mentre si trascina: listener non passivo registrato una volta (iOS ignora quelli
  // aggiunti a gesto iniziato).
  useEffect(() => {
    const stop = (event: TouchEvent) => {
      if (press.current?.active && event.cancelable) event.preventDefault()
    }
    document.addEventListener('touchmove', stop, { passive: false })
    const pending = timers.current
    return () => {
      document.removeEventListener('touchmove', stop)
      for (const id of pending) window.clearTimeout(id)
      const current = press.current
      if (current?.timer) window.clearTimeout(current.timer)
      if (current?.raf) cancelAnimationFrame(current.raf)
      document.body.removeAttribute(ENTRY_DRAGGING_ATTRIBUTE)
    }
  }, [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const update = useCallback((current: Press<T>) => {
    const over = mealUnder(current.lastX, current.lastY, current.el)
    setDrag({
      id: current.entry.id,
      dx: current.lastX - current.startX,
      dy: current.lastY - current.startY + (window.scrollY - current.startScroll),
      over: over !== null && over !== current.entry.mealType ? over : null,
      phase: 'drag',
    })
  }, [])

  // Scorrimento automatico vicino ai bordi: un giro per fotogramma finché il trascinamento è attivo.
  function tick(current: Press<T>) {
    if (press.current !== current || !current.active) return
    const before = window.scrollY
    if (current.lastY > window.innerHeight - SCROLL_BOTTOM_ZONE) window.scrollBy(0, SCROLL_STEP_PX)
    else if (current.lastY < SCROLL_TOP_ZONE) window.scrollBy(0, -SCROLL_STEP_PX)
    if (window.scrollY !== before) update(current)
    current.raf = requestAnimationFrame(() => tick(current))
  }

  function activate(current: Press<T>) {
    if (press.current !== current) return
    current.active = true
    current.timer = null
    try {
      current.el.setPointerCapture(current.pointerId)
    } catch {
      // puntatore già rilasciato: il trascinamento finirà subito
    }
    document.body.setAttribute(ENTRY_DRAGGING_ATTRIBUTE, '')
    navigator.vibrate?.(10)
    update(current)
    current.raf = requestAnimationFrame(() => tick(current))
  }

  function finish(current: Press<T>, over: string | null) {
    document.body.removeAttribute(ENTRY_DRAGGING_ATTRIBUTE)
    setDrag(null)
    if (over) onDropRef.current(current.entry, over)
  }

  function rowProps(entry: T) {
    return {
      'data-entry-id': entry.id,
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (!enabled || press.current || drag) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        // Il puntatore si cattura solo quando parte il trascinamento: catturarlo subito farebbe arrivare il "click" alla riga
        // e non al pulsante della voce, e il tocco veloce non aprirebbe più la modifica.
        const current: Press<T> = {
          entry,
          el: event.currentTarget,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startScroll: window.scrollY,
          lastX: event.clientX,
          lastY: event.clientY,
          timer: null,
          raf: null,
          active: false,
        }
        current.timer = window.setTimeout(() => activate(current), LONG_PRESS_MS)
        press.current = current
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const current = press.current
        if (!current || current.pointerId !== event.pointerId) return
        current.lastX = event.clientX
        current.lastY = event.clientY
        if (!current.active) {
          // Un dito che si muove prima del tempo vuole scorrere o fare swipe, non spostare la voce.
          if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > PRESS_SLOP_PX) {
            if (current.timer) window.clearTimeout(current.timer)
            press.current = null
          }
          return
        }
        update(current)
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        end(event, false)
      },
      onPointerCancel(event: PointerEvent<HTMLElement>) {
        end(event, true)
      },
      onContextMenu(event: { preventDefault: () => void }) {
        event.preventDefault()
      },
      // Dopo un trascinamento il browser manda comunque un "click": non deve aprire la modifica della voce.
      onClickCapture(event: { stopPropagation: () => void; preventDefault: () => void }) {
        if (swallowClick.current) {
          event.stopPropagation()
          event.preventDefault()
        }
      },
    }
  }

  function end(event: PointerEvent<HTMLElement>, cancelled: boolean) {
    const current = press.current
    if (!current || current.pointerId !== event.pointerId) return
    if (current.timer) window.clearTimeout(current.timer)
    if (current.raf) cancelAnimationFrame(current.raf)
    press.current = null
    if (!current.active) return
    swallowClick.current = true
    later(() => {
      swallowClick.current = false
    }, 400)
    const over = cancelled ? null : mealUnder(current.lastX, current.lastY, current.el)
    const target = over !== null && over !== current.entry.mealType ? over : null
    if (target) {
      setDrag((state) => (state ? { ...state, phase: 'drop' } : state))
      later(() => finish(current, target), DROP_MS)
    } else {
      setDrag((state) => (state ? { ...state, dx: 0, dy: 0, over: null, phase: 'back' } : state))
      later(() => finish(current, null), SETTLE_MS)
    }
  }

  /** Stile della voce: sollevata mentre la si trascina, ferma altrimenti. */
  function rowStyle(id: string): CSSProperties | undefined {
    if (drag?.id !== id) return undefined
    return {
      position: 'relative',
      zIndex: 50,
      transform: `translate(${drag.dx}px, ${drag.dy}px)`,
      scale: drag.phase === 'drop' ? '0.9' : '1.03',
      opacity: drag.phase === 'drop' ? 0 : 1,
      transition:
        drag.phase === 'drag'
          ? 'scale 150ms, box-shadow 150ms'
          : drag.phase === 'back'
            ? `transform ${SETTLE_MS}ms ease-out, scale 150ms`
            : `opacity ${DROP_MS}ms, scale ${DROP_MS}ms`,
    }
  }

  const liftedClass = '-mx-3 rounded-card bg-surface px-3 shadow-[0_10px_28px_rgba(21,23,30,0.22)]'

  return { drag, rowProps, rowStyle, liftedClass }
}
