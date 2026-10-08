import { describe, expect, it } from 'vitest'

import {
  countFor,
  DEFAULT_CONTAINERS,
  freeTotal,
  lastFor,
  formatWater,
  goalToText,
  validateContainerName,
  validateWaterGoal,
  validateWaterMl,
  waterProgress,
  waterTotal,
} from './water'

describe('acqua (step 15)', () => {
  it('contenitori rapidi: 200, 500, 1500 ml', () => {
    expect(DEFAULT_CONTAINERS.map((container) => container.ml)).toEqual([200, 500, 1500])
  })

  it('tre tocchi diversi si sommano', () => {
    expect(waterTotal([{ ml: 200 }, { ml: 500 }, { ml: 750 }])).toBe(1450)
    expect(waterTotal([])).toBe(0)
  })

  it('avanzamento solo con un obiettivo', () => {
    expect(waterProgress(1450, null)).toBeNull()
    expect(waterProgress(1450, 2000)).toEqual({ fraction: 0.725, remainingMl: 550 })
    expect(waterProgress(2600, 2000)).toEqual({ fraction: 1, remainingMl: 0 })
  })

  it('formato: ml sotto il litro, L sopra', () => {
    expect(formatWater(200)).toBe('200 ml')
    expect(formatWater(1450)).toBe('1,45 L')
    expect(formatWater(1500)).toBe('1,5 L')
    expect(formatWater(0)).toBe('0 ml')
  })

  it('quantità libera', () => {
    expect(validateWaterMl('330')).toEqual({ ok: true, value: 330 })
    expect(validateWaterMl('0')).toEqual({ ok: false, message: 'I ml devono essere più di 0.' })
    expect(validateWaterMl('5001')).toEqual({ ok: false, message: 'Al massimo 5000 ml alla volta.' })
    expect(validateWaterMl('')).toEqual({ ok: false, message: 'Scrivi quanti ml.' })
  })

  it('nome del contenitore', () => {
    expect(validateContainerName('  Borraccia ')).toEqual({ ok: true, value: 'Borraccia' })
    expect(validateContainerName('')).toMatchObject({ ok: false })
    expect(validateContainerName('borraccia', ['Borraccia'])).toEqual({ ok: false, message: 'Hai già un contenitore con questo nome.' })
  })

  it('obiettivo in litri → ml, vuoto = nessuno', () => {
    expect(validateWaterGoal('2,5')).toEqual({ ok: true, value: 2500 })
    expect(validateWaterGoal('')).toEqual({ ok: true, value: null })
    expect(validateWaterGoal('0')).toMatchObject({ ok: false })
    expect(validateWaterGoal('11')).toEqual({ ok: false, message: 'Al massimo 10 L.' })
    expect(goalToText(2500)).toBe('2,5')
    expect(goalToText(null)).toBe('')
  })
})

describe('obiettivo quasi zero (revisione)', () => {
  it('0,0004 L sarebbe 0 ml: rifiutato', () => {
    expect(validateWaterGoal('0,0004')).toMatchObject({ ok: false })
    expect(validateWaterGoal('0,001')).toEqual({ ok: true, value: 1 })
  })
})

describe('contatori per contenitore (step 17)', () => {
  const day = [
    { id: '1', ml: 200, container: 'glass' },
    { id: '2', ml: 750, container: 'c-borraccia' },
    { id: '3', ml: 200, container: null },
    { id: '4', ml: 200, container: 'glass' },
  ]
  it('conteggio per contenitore: 200 ml scritti a mano non contano come bicchiere', () => {
    expect(countFor(day, 'glass')).toBe(2)
    expect(countFor(day, 'c-borraccia')).toBe(1)
    expect(countFor(day, 'bottle')).toBe(0)
    expect(countFor(day, null)).toBe(1)
  })
  it('il "−" toglie l’ultima aggiunta di quel contenitore', () => {
    expect(lastFor(day, 'glass')?.id).toBe('4')
    expect(lastFor(day, 'bottle')).toBeUndefined()
  })
  it('quantità libere: solo il loro totale', () => {
    expect(freeTotal(day)).toBe(200)
  })
})
