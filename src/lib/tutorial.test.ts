import { describe, expect, it } from 'vitest'

import { isLastStep, nextStep, previousStep, tourLabel, TOUR_STEPS } from './tutorial'

describe('tutorial (step 19)', () => {
  it('8 passi: anello, peso, pasti, acqua, aggiungere, cibi, statistiche, profilo', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual(['ring', 'weight', 'meals', 'water', 'add', 'foods', 'stats', 'profile'])
  })
  it('ogni passo ha schermata, titolo e testo; gli id sono unici', () => {
    expect(new Set(TOUR_STEPS.map((step) => step.id)).size).toBe(TOUR_STEPS.length)
    for (const step of TOUR_STEPS) {
      expect(step.path.startsWith('/')).toBe(true)
      expect(step.title.length).toBeGreaterThan(3)
      expect(step.text.length).toBeGreaterThan(20)
    }
  })
  it('etichetta "1/8" … "8/8"', () => {
    expect(tourLabel(0)).toBe('1/8')
    expect(tourLabel(7)).toBe('8/8')
  })
  it('avanti e indietro non escono dai limiti', () => {
    expect(nextStep(0)).toBe(1)
    expect(nextStep(7)).toBe(7)
    expect(previousStep(0)).toBe(0)
    expect(previousStep(5)).toBe(4)
    expect(isLastStep(6)).toBe(false)
    expect(isLastStep(7)).toBe(true)
  })
})
