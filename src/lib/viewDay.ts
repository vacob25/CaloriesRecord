import { BACKFILL_MAX_DAYS } from './constants'
import { addDays, daysBetween } from './dates'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** True se il testo è un giorno reale ('2026-02-30' no). */
function isRealDay(text: string): boolean {
  if (!ISO_DAY.test(text)) return false
  const [y, m, d] = text.split('-').map(Number) as [number, number, number]
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/**
 * Giorno mostrato in Oggi (step 20): il parametro `?data=` se è un giorno reale, non nel futuro e al massimo
 * `BACKFILL_MAX_DAYS` giorni indietro; altrimenti oggi. Un link sbagliato non rompe niente: si torna a oggi.
 */
export function viewedDay(param: string | null, today: string, maxDays: number = BACKFILL_MAX_DAYS): string {
  if (param === null || !isRealDay(param)) return today
  if (param > today || param < addDays(today, -maxDays)) return today
  return param
}

/** Il giorno prima, finché resta dentro il limite; altrimenti null (il pulsante si disattiva). */
export function previousViewedDay(day: string, today: string, maxDays: number = BACKFILL_MAX_DAYS): string | null {
  const previous = addDays(day, -1)
  return previous < addDays(today, -maxDays) ? null : previous
}

/** Il giorno dopo; null se si è già a oggi. */
export function nextViewedDay(day: string, today: string): string | null {
  return day >= today ? null : addDays(day, 1)
}

/** Titolo della schermata: Oggi, Ieri, L’altro ieri, "3 giorni fa". */
export function dayTitle(day: string, today: string): string {
  const ago = daysBetween(day, today).length - 1
  if (ago <= 0) return 'Oggi'
  if (ago === 1) return 'Ieri'
  if (ago === 2) return 'L’altro ieri'
  return `${ago} giorni fa`
}

/** Query string da aggiungere ai link: vuota per oggi, `data=…` per un giorno passato. */
export function dayQuery(day: string, today: string): string {
  return day === today ? '' : `data=${day}`
}

/** Distanza minima (px) per contare come swipe, e quanto deve prevalere l'orizzontale sul verticale. */
export const SWIPE_MIN_PX = 60
export const SWIPE_DOMINANCE = 1.5

/**
 * Gesto di scorrimento orizzontale in Oggi: verso destra (dx > 0) = giorno precedente, verso sinistra = giorno dopo.
 * Un gesto soprattutto verticale (scroll della pagina) o troppo corto non conta.
 */
export function swipeDirection(dx: number, dy: number): 'previous' | 'next' | null {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < SWIPE_DOMINANCE * Math.abs(dy)) return null
  return dx > 0 ? 'previous' : 'next'
}
