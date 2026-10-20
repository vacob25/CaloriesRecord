import { describe, expect, it } from 'vitest'

import { addDays, daysBetween, formatLongDate, formatShortDate, localDate, localHour, monthRange, weekRange } from './dates'

describe('localDate (TESTING.md)', () => {
  it('22:30 UTC in ora legale (UTC+2) è già il giorno dopo a Roma', () => {
    expect(localDate(new Date('2026-10-07T22:30:00Z'))).toBe('2026-10-08')
  })

  it('23:30 UTC in ora solare (UTC+1) è già il giorno dopo a Roma', () => {
    expect(localDate(new Date('2026-12-07T23:30:00Z'))).toBe('2026-12-08')
  })

  it('21:59 UTC in ora legale è ancora lo stesso giorno', () => {
    expect(localDate(new Date('2026-10-07T21:59:00Z'))).toBe('2026-10-07')
  })
})

describe('localHour', () => {
  it('ora di Roma, non UTC', () => {
    expect(localHour(new Date('2026-10-07T10:30:00Z'))).toBe(12)
    expect(localHour(new Date('2026-12-07T23:30:00Z'))).toBe(0)
  })
})

describe('weekRange (TESTING.md)', () => {
  it('mercoledì 7/10/2026 → lunedì 5, domenica 11', () => {
    expect(weekRange('2026-10-07')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
  })

  it('domenica e lunedì restano nella loro settimana', () => {
    expect(weekRange('2026-10-11')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
    expect(weekRange('2026-10-05')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
  })
})

describe('cambio ora legale (ultima domenica di ottobre 2026: 25/10)', () => {
  it('il giorno da 25 ore resta un solo giorno: nessun doppione o buco', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('ogni ora del 25/10 a Roma appartiene al 25/10', () => {
    // 25/10 a Roma va da 2026-10-24T22:00Z (UTC+2) a 2026-10-25T23:00Z (UTC+1): 25 ore.
    const days = new Set<string>()
    for (let h = 0; h < 25; h++) days.add(localDate(new Date(Date.UTC(2026, 9, 24, 22 + h, 30))))
    expect([...days]).toEqual(['2026-10-25'])
    expect(localDate(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26')
  })
})

describe('cambio ora legale (ultima domenica di marzo 2027: 28/03)', () => {
  it('il giorno da 23 ore resta un solo giorno: nessun buco', () => {
    expect(daysBetween('2027-03-27', '2027-03-29')).toEqual(['2027-03-27', '2027-03-28', '2027-03-29'])
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29')
    expect(addDays('2027-03-28', -1)).toBe('2027-03-27')
  })

  it('ogni ora del 28/03 a Roma appartiene al 28/03', () => {
    // 28/03 a Roma va da 2027-03-27T23:00Z (UTC+1) a 2027-03-28T22:00Z (UTC+2): 23 ore.
    const days = new Set<string>()
    for (let h = 0; h < 23; h++) days.add(localDate(new Date(Date.UTC(2027, 2, 27, 23 + h, 30))))
    expect([...days]).toEqual(['2027-03-28'])
    expect(localDate(new Date('2027-03-28T22:00:00Z'))).toBe('2027-03-29')
  })
})

describe('localHour attorno ai cambi di ora', () => {
  it('ottobre 2026: alle 02:30 si passa due volte (CEST poi CET), poi le 03', () => {
    expect(localHour(new Date('2026-10-25T00:30:00Z'))).toBe(2) // 02:30 CEST
    expect(localHour(new Date('2026-10-25T01:30:00Z'))).toBe(2) // 02:30 CET
    expect(localHour(new Date('2026-10-25T02:30:00Z'))).toBe(3)
  })

  it('marzo 2027: dopo l’01:30 si salta alle 03:30 (l’ora 2 non esiste)', () => {
    expect(localHour(new Date('2027-03-28T00:30:00Z'))).toBe(1) // 01:30 CET
    expect(localHour(new Date('2027-03-28T01:30:00Z'))).toBe(3) // 03:30 CEST
  })
})

describe('settimane che contengono il cambio di ora', () => {
  it('19-25 ottobre 2026: sette giorni, dal lunedì alla domenica del cambio', () => {
    expect(weekRange('2026-10-22')).toEqual({ start: '2026-10-19', end: '2026-10-25' })
    expect(daysBetween('2026-10-19', '2026-10-25')).toHaveLength(7)
  })

  it('22-28 marzo 2027: sette giorni, dal lunedì alla domenica del cambio', () => {
    expect(weekRange('2027-03-25')).toEqual({ start: '2027-03-22', end: '2027-03-28' })
    expect(daysBetween('2027-03-22', '2027-03-28')).toHaveLength(7)
    expect(weekRange('2027-03-29')).toEqual({ start: '2027-03-29', end: '2027-04-04' })
  })
})

describe('addDays e monthRange', () => {
  it('attraversa mesi e anni', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('mese solare, anche febbraio bisestile', () => {
    expect(monthRange('2026-10-07')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(monthRange('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

describe('formatLongDate', () => {
  it('in italiano', () => {
    expect(formatLongDate('2026-10-07')).toBe('mercoledì 7 ottobre')
  })
})

describe('formatShortDate', () => {
  it('giorno e mese abbreviato in italiano', () => {
    expect(formatShortDate('2026-10-07')).toBe('7 ott')
    expect(formatShortDate('2027-03-28')).toBe('28 mar')
  })
})
