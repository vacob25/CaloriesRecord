import { describe, expect, it } from 'vitest'

import { parseCatalog } from '../../lib/catalog'
import ingredients from './ingredienti.json'
import dishes from './piatti.json'

// Piatti comuni (step 20): calcolati da ingredienti del catalogo; ogni voce rispetta formato e regole §9.
describe('catalogo piatti (dati)', () => {
  it('tutte le voci valide, insieme agli ingredienti (id e nomi mai ripetuti)', () => {
    const result = parseCatalog(ingredients, dishes)
    expect(result.errors).toEqual([])
    expect(result.items).toHaveLength(ingredients.items.length + dishes.items.length)
  })

  it('sono tutti "Piatti comuni", con porzione e ricetta nella fonte', () => {
    for (const dish of dishes.items) {
      expect(dish.category).toBe('Piatti comuni')
      expect(dish.portions.length).toBeGreaterThan(0)
      expect(dish.source).toMatch(/^Calcolato dalla ricetta/)
      expect(dish.notes).toMatch(/^STIMA/)
    }
  })

  it('i valori tornano con la ricetta: ricalcolo dalle voci degli ingredienti (tolleranza 1 kcal per l’arrotondamento)', () => {
    const byId = new Map([...ingredients.items, ...dishes.items].map((item) => [item.id, item]))
    // Esempio verificabile a mano: pasta al pomodoro = pasta lessata 160 + passata 100 + olio 8 + parmigiano 5, 30 g di acqua evaporata.
    const pasta = byId.get('pasta-di-semola-lessata')
    const passata = byId.get('passata-di-pomodoro')
    const olio = byId.get('olio-extravergine-di-oliva')
    const parmigiano = byId.get('parmigiano-reggiano-dop')
    const dish = byId.get('pasta-al-pomodoro')
    expect(pasta && passata && olio && parmigiano && dish).toBeTruthy()
    const kcal = (pasta!.kcal * 160 + passata!.kcal * 100 + olio!.kcal * 8 + parmigiano!.kcal * 5) / 100
    expect(Math.abs(dish!.kcal - (kcal / 243) * 100)).toBeLessThanOrEqual(1)
  })
})
