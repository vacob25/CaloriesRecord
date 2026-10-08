/**
 * Giorni locali Europe/Rome come stringa 'YYYY-MM-DD' (ADR-010, regola 6 di CLAUDE.md).
 * Mai timestamp UTC per i giorni: a mezzanotte UTC si sbaglierebbe giorno.
 * L'aritmetica sui giorni lavora sulla stringa (a mezzogiorno UTC), quindi l'ora legale
 * non crea mai doppioni o buchi.
 */

export const APP_TIME_ZONE = 'Europe/Rome'

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Giorno locale di Roma di un istante. */
export function localDate(instant: Date): string {
  return dayFormatter.format(instant)
}

const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' })

/** Ora locale di Roma (0-23) di un istante. */
export function localHour(instant: Date): number {
  return Number(hourFormatter.format(instant))
}

function toUtcNoon(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1, 12))
}

function fromUtcNoon(instant: Date): string {
  return instant.toISOString().slice(0, 10)
}

/** Aggiunge (o toglie) giorni di calendario a 'YYYY-MM-DD'. */
export function addDays(day: string, days: number): string {
  const instant = toUtcNoon(day)
  instant.setUTCDate(instant.getUTCDate() + days)
  return fromUtcNoon(instant)
}

/** Settimana lunedì-domenica che contiene il giorno (DOMAIN_RULES §8). */
export function weekRange(day: string): { start: string; end: string } {
  const weekday = toUtcNoon(day).getUTCDay() // 0 = domenica
  const fromMonday = (weekday + 6) % 7
  const start = addDays(day, -fromMonday)
  return { start, end: addDays(start, 6) }
}

/** Mese solare che contiene il giorno. */
export function monthRange(day: string): { start: string; end: string } {
  const start = `${day.slice(0, 8)}01`
  const nextMonth = toUtcNoon(start)
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  return { start, end: addDays(fromUtcNoon(nextMonth), -1) }
}

/** Giorni da `start` a `end` inclusi. */
export function daysBetween(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

const longFormatter = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

/** "mercoledì 7 ottobre" */
export function formatLongDate(day: string): string {
  return longFormatter.format(toUtcNoon(day))
}

const shortFormatter = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/** "7 ott" */
export function formatShortDate(day: string): string {
  return shortFormatter.format(toUtcNoon(day))
}
