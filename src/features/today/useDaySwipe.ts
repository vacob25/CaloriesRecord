import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

import { swipeDirection } from '../../lib/viewDay'
import { ENTRY_DRAGGING_ATTRIBUTE } from './useEntryDrag'

const EDGE_PX = 24
const LOCK_PX = 10

/** Mentre si trascina una voce tra i pasti lo swipe tra i giorni è sospeso. */
function entryDragging(): boolean {
  return document.body.hasAttribute(ENTRY_DRAGGING_ATTRIBUTE)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

interface DaySwipeOptions {
  onPrevious: (() => void) | null
  onNext: (() => void) | null
}

/**
 * Scorrimento orizzontale tra i giorni (step 20): il contenuto segue il dito, e al rilascio, se il gesto è valido,
 * cambia giorno con una breve animazione d'ingresso dal lato giusto. Se non c'è un giorno in quella direzione
 * (oltre il limite, o a oggi verso sinistra) torna al suo posto. Con "riduci movimento" niente animazioni.
 * Il trasformare solo il contenitore (non i pannelli) tiene a posto i pannelli `fixed`.
 */
export function useDaySwipe(ref: RefObject<HTMLElement | null>, day: string, { onPrevious, onNext }: DaySwipeOptions) {
  const handlers = useRef({ onPrevious, onNext })
  useEffect(() => {
    handlers.current = { onPrevious, onNext }
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let start: { x: number; y: number } | null = null
    let horizontal = false

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      // Partire dal bordo sinistro è il gesto "indietro" di iOS: non lo intercettiamo.
      start = event.touches.length === 1 && touch && touch.clientX > EDGE_PX ? { x: touch.clientX, y: touch.clientY } : null
      horizontal = false
    }
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!start || !touch || entryDragging()) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (!horizontal && Math.abs(dx) > LOCK_PX && Math.abs(dx) > Math.abs(dy)) horizontal = true
      if (!horizontal || prefersReducedMotion()) return
      const allowed = dx > 0 ? handlers.current.onPrevious : handlers.current.onNext
      const follow = allowed ? 0.35 : 0.12
      el.style.transform = `translateX(${Math.max(-90, Math.min(90, dx * follow))}px)`
    }
    const finish = (event: TouchEvent, cancelled: boolean) => {
      const touch = event.changedTouches[0]
      const begin = start
      start = null
      if (!begin || !touch) return
      const direction = cancelled || entryDragging() ? null : swipeDirection(touch.clientX - begin.x, touch.clientY - begin.y)
      const action = direction === 'previous' ? handlers.current.onPrevious : direction === 'next' ? handlers.current.onNext : null
      const shifted = el.style.transform
      el.style.transform = ''
      if (action) {
        action()
      } else if (shifted && !prefersReducedMotion()) {
        // Torna al suo posto.
        el.animate([{ transform: shifted }, { transform: 'none' }], { duration: 160, easing: 'ease-out' })
      }
    }
    const onEnd = (event: TouchEvent) => finish(event, false)
    const onCancel = (event: TouchEvent) => finish(event, true)

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [ref])

  // Animazione d'ingresso al cambio di giorno (frecce o swipe): indietro entra da sinistra, avanti da destra.
  const previousDay = useRef(day)
  useLayoutEffect(() => {
    const el = ref.current
    const before = previousDay.current
    previousDay.current = day
    if (!el || before === day || prefersReducedMotion()) return
    const from = day < before ? -48 : 48
    el.animate(
      [
        { transform: `translateX(${from}px)`, opacity: 0.2 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    )
  }, [day, ref])
}
