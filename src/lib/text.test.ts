import { describe, expect, it } from 'vitest'

import { cleanName } from './text'

describe('cleanName', () => {
  it('sistema gli spazi e mette la maiuscola iniziale', () => {
    expect(cleanName('  calcio   a  5 ')).toBe('Calcio a 5')
    expect(cleanName('  dopo   cena ')).toBe('Dopo cena')
  })
  it('toglie i caratteri di controllo', () => {
    expect(cleanName('corsa\n\tvelocità')).toBe('Corsa velocità')
  })
  it('solo spazi → vuoto', () => {
    expect(cleanName('   ')).toBe('')
  })
})
