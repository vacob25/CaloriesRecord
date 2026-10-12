import { describe, expect, it } from 'vitest'

import { sessionKcal, sportEnergyFor, SPORT_ENERGY, trainingBonus } from './sportEnergy'

describe('sportEnergyFor — riconoscimento del nome scritto dall’utente', () => {
  it.each([
    ['Tennis', 'Tennis'],
    ['tennis singolo', 'Tennis'],
    ['Corsa', 'Corsa'],
    ['Running', 'Corsa'],
    ['Calcio', 'Calcio'],
    ['Calcio a 5', 'Calcio'],
    ['Calcetto', 'Calcio'],
    ['Palestra', 'Palestra'],
    ['  PALESTRA ', 'Palestra'],
    ['Sala pesi', 'Palestra'],
  ])('%s → %s', (name, label) => {
    expect(sportEnergyFor(name)?.label).toBe(label)
  })
  it('sport non in tabella (o solo simili): nessuna voce', () => {
    expect(sportEnergyFor('Padel')).toBeUndefined()
    expect(sportEnergyFor('Tennis tavolo')).toBeUndefined()
    expect(sportEnergyFor('Nuoto')).toBeUndefined()
    expect(sportEnergyFor('CrossFit')).toBeUndefined()
    expect(sportEnergyFor('')).toBeUndefined()
  })
})

describe('sessionKcal = (MET − 1) · kg · ore, a 75 kg', () => {
  it.each([
    ['Tennis', 525], // 7 · 75 · 1
    ['Corsa', 495], // 8,8 · 75 · 0,75
    ['Calcio', 450], // 6 · 75 · 1
    ['Palestra', 281], // 5 · 75 · 0,75 = 281,25
  ])('%s → %s kcal', (name, expected) => {
    expect(sessionKcal(sportEnergyFor(name)!, 75)).toBe(expected)
  })
  it('cresce col peso: 60 kg di Calcio → 360', () => {
    expect(sessionKcal(sportEnergyFor('Calcio')!, 60)).toBe(360)
  })
  it('la tabella ha i valori della fonte', () => {
    expect(SPORT_ENERGY.map((entry) => [entry.label, entry.met])).toEqual([
      ['Tennis', 8],
      ['Corsa', 9.8],
      ['Calcio', 7],
      ['Palestra', 6],
    ])
  })
})

describe('trainingBonus — più sport si sommano', () => {
  const sports = ['Palestra', 'Calcio', 'Padel', 'Tennis']
  it('riposo = 0', () => {
    expect(trainingBonus('rest', sports, 75, 200)).toEqual({ total: 0, parts: [] })
  })
  it('un sport', () => {
    expect(trainingBonus('sport_4', sports, 75, 200).total).toBe(525)
  })
  it('due sport: la somma (Palestra + Calcio = 281 + 450)', () => {
    const result = trainingBonus('sport_1+sport_2', sports, 75, 200)
    expect(result.total).toBe(731)
    expect(result.parts.map((part) => part.name)).toEqual(['Palestra', 'Calcio'])
  })
  it('sport fuori tabella = bonus di riserva, segnato come non stimato', () => {
    const result = trainingBonus('sport_1+sport_3', sports, 75, 150)
    expect(result.total).toBe(281 + 150)
    expect(result.parts.map((part) => part.estimated)).toEqual([true, false])
  })
  it('tutti e quattro', () => {
    expect(trainingBonus('sport_1+sport_2+sport_3+sport_4', sports, 75, 200).total).toBe(281 + 450 + 200 + 525)
  })
  it('sport che non esiste più nell’elenco: non conta', () => {
    expect(trainingBonus('sport_3', ['Palestra'], 75, 200).total).toBe(0)
  })
})
