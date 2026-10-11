import { describe, expect, it } from 'vitest'

import { dayQuery, dayTitle, nextViewedDay, previousViewedDay, viewedDay } from './viewDay'

const TODAY = '2026-10-11'

describe('viewedDay', () => {
  it('senza parametro, oggi', () => {
    expect(viewedDay(null, TODAY)).toBe(TODAY)
  })
  it('ieri e fino a 14 giorni indietro sono validi', () => {
    expect(viewedDay('2026-10-10', TODAY)).toBe('2026-10-10')
    expect(viewedDay('2026-09-27', TODAY)).toBe('2026-09-27')
  })
  it('15 giorni indietro, il futuro e i testi sbagliati tornano a oggi', () => {
    expect(viewedDay('2026-09-26', TODAY)).toBe(TODAY)
    expect(viewedDay('2026-10-12', TODAY)).toBe(TODAY)
    expect(viewedDay('ieri', TODAY)).toBe(TODAY)
    expect(viewedDay('2026-02-30', TODAY)).toBe(TODAY)
    expect(viewedDay('2026-10-1', TODAY)).toBe(TODAY)
    expect(viewedDay('', TODAY)).toBe(TODAY)
  })
  it('il limite si può cambiare', () => {
    expect(viewedDay('2026-10-04', TODAY, 7)).toBe('2026-10-04')
    expect(viewedDay('2026-10-03', TODAY, 7)).toBe(TODAY)
  })
})

describe('frecce', () => {
  it('indietro si ferma al limite, avanti si ferma a oggi', () => {
    expect(previousViewedDay(TODAY, TODAY)).toBe('2026-10-10')
    expect(previousViewedDay('2026-09-27', TODAY)).toBeNull()
    expect(nextViewedDay('2026-10-10', TODAY)).toBe(TODAY)
    expect(nextViewedDay(TODAY, TODAY)).toBeNull()
  })
  it('attraversa il cambio di mese', () => {
    expect(previousViewedDay('2026-10-01', '2026-10-01')).toBe('2026-09-30')
  })
})

describe('dayTitle e dayQuery', () => {
  it('titoli', () => {
    expect(dayTitle(TODAY, TODAY)).toBe('Oggi')
    expect(dayTitle('2026-10-10', TODAY)).toBe('Ieri')
    expect(dayTitle('2026-10-09', TODAY)).toBe('L’altro ieri')
    expect(dayTitle('2026-10-06', TODAY)).toBe('5 giorni fa')
  })
  it('query solo per i giorni passati', () => {
    expect(dayQuery(TODAY, TODAY)).toBe('')
    expect(dayQuery('2026-10-10', TODAY)).toBe('data=2026-10-10')
  })
})
