import { describe, expect, it } from 'vitest'

import { NAV_ITEMS } from './navItems'

describe('NAV_ITEMS', () => {
  it('ha le 5 voci del design, con "+" al centro', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Oggi',
      'Cibi',
      'Aggiungi pasto',
      'Statistiche',
      'Profilo',
    ])
    expect(NAV_ITEMS[2]?.primary).toBe(true)
  })

  it('non ha percorsi duplicati', () => {
    const paths = NAV_ITEMS.map((item) => item.to)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
