import { describe, expect, it } from 'vitest'

import { periodFor, periodLabel } from './period'

describe('periodFor', () => {
  it('settimana lun-dom, attuale e precedente', () => {
    expect(periodFor('week', '2026-10-08', 0)).toEqual({ start: '2026-10-05', end: '2026-10-11' })
    expect(periodFor('week', '2026-10-08', -1)).toEqual({ start: '2026-09-28', end: '2026-10-04' })
  })

  it('mese solare, anche attraverso l’anno', () => {
    expect(periodFor('month', '2026-10-08', 0)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(periodFor('month', '2026-01-15', -1)).toEqual({ start: '2025-12-01', end: '2025-12-31' })
    expect(periodFor('month', '2026-12-15', 1)).toEqual({ start: '2027-01-01', end: '2027-01-31' })
  })
})

describe('periodLabel', () => {
  it('in italiano', () => {
    expect(periodLabel('month', '2026-10-01', '2026-10-31')).toBe('ottobre 2026')
    expect(periodLabel('week', '2026-10-05', '2026-10-11')).toBe('5 ott – 11 ott')
  })
})
