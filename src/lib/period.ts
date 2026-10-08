import { addDays, monthRange, weekRange } from './dates'

export type PeriodKind = 'week' | 'month'

/** Periodo che contiene `day` spostato di `offset` settimane o mesi (0 = attuale, −1 = precedente). */
export function periodFor(kind: PeriodKind, day: string, offset: number): { start: string; end: string } {
  if (kind === 'week') return weekRange(addDays(day, offset * 7))
  const [year, month] = day.split('-').map(Number)
  const index = (year ?? 1970) * 12 + ((month ?? 1) - 1) + offset
  const shifted = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
  return monthRange(shifted)
}

const monthFormatter = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const dayMonth = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/** "5–11 ott" per la settimana, "ottobre 2026" per il mese. */
export function periodLabel(kind: PeriodKind, start: string, end: string): string {
  const at = (day: string) => new Date(`${day}T12:00:00Z`)
  if (kind === 'month') return monthFormatter.format(at(start))
  return `${dayMonth.format(at(start))} – ${dayMonth.format(at(end))}`
}
