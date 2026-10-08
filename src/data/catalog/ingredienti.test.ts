import { describe, expect, it } from 'vitest'

import { parseCatalog } from '../../lib/catalog'
import catalog from './ingredienti.json'

// Accettazione dello step 16: ogni voce del catalogo vero rispetta il formato e le regole §9.
describe('catalogo ingredienti (dati)', () => {
  it('tutte le voci valide', () => {
    const result = parseCatalog(catalog)
    expect(result.errors).toEqual([])
    expect(result.items).toHaveLength(catalog.items.length)
  })
})
