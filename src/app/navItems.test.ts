import { describe, expect, it } from 'vitest'

import { activeNavItem, NAV_ITEMS } from './navItems'

describe('NAV_ITEMS', () => {
  it('ha Palestra, Cibi, Oggi al centro, Statistiche, Profilo', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(['Palestra', 'Cibi', 'Oggi', 'Statistiche', 'Profilo'])
    expect(NAV_ITEMS[2]?.primary).toBe(true)
    expect(NAV_ITEMS.filter((item) => item.primary)).toHaveLength(1)
  })

  it('non ha percorsi duplicati', () => {
    const paths = NAV_ITEMS.map((item) => item.to)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('activeNavItem', () => {
  it('accende la voce della sezione in cui sei', () => {
    expect(activeNavItem('/statistiche')?.label).toBe('Statistiche')
    expect(activeNavItem('/cibi')?.label).toBe('Cibi')
    expect(activeNavItem('/cibi/nuovo')?.label).toBe('Cibi')
    expect(activeNavItem('/palestra')?.label).toBe('Palestra')
    expect(activeNavItem('/palestra/esercizi')?.label).toBe('Palestra')
    expect(activeNavItem('/profilo')?.label).toBe('Profilo')
  })

  it('Oggi resta acceso in Aggiungi pasto, scanner e Peso, ma non altrove', () => {
    for (const path of ['/', '/aggiungi', '/aggiungi/scanner', '/peso']) expect(activeNavItem(path)?.label).toBe('Oggi')
    expect(activeNavItem('/statistiche')?.label).not.toBe('Oggi')
  })

  it('un percorso sconosciuto non accende niente', () => {
    expect(activeNavItem('/boh')).toBeNull()
    expect(activeNavItem('/palestraX')).toBeNull()
  })
})
