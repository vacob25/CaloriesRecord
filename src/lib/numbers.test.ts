import { describe, expect, it } from 'vitest'

import { formatFixed, formatNumber, formatSigned, parseDecimal, round } from './numbers'

describe('parseDecimal', () => {
  it.each([
    ['3,5', 3.5],
    ['3.5', 3.5],
    [' 120 ', 120],
    [',5', 0.5],
    ['0', 0],
  ])('"%s" → %s', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each(['', '  ', 'abc', '3,5,1', '1.2.3', '3 kg', '1e3'])('"%s" → null', (input) => {
    expect(parseDecimal(input)).toBeNull()
  })
})

describe('round', () => {
  it('arrotonda correttamente i casi di virgola mobile', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(463.75)).toBe(464)
    expect(round(2.449, 1)).toBe(2.4)
    expect(round(6.6 * 0.75, 1)).toBe(5)
    expect(round(1.15, 1)).toBe(1.2)
    expect(round(136.05, 2)).toBe(136.05)
  })
})

describe('formatNumber', () => {
  it('usa la virgola italiana e taglia i decimali in più', () => {
    expect(formatNumber(3.456, 1)).toBe('3,5')
    expect(formatNumber(120, 1)).toBe('120')
  })
})

describe('formatFixed / formatSigned (cifre fisse)', () => {
  it('0,2 con 2 cifre → 0,20; segno esplicito', () => {
    expect(formatFixed(0.2, 2)).toBe('0,20')
    expect(formatSigned(0.2, 2)).toBe('+0,20')
    expect(formatSigned(-0.375, 2)).toBe('-0,38')
    expect(formatSigned(0, 1)).toBe('0,0')
  })
})
