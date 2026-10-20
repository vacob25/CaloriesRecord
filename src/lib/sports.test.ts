import { describe, expect, it } from 'vitest'

import {
  addSport,
  buildTrainingType,
  coerceTrainingType,
  parseSports,
  RECOMMENDED_SPORT,
  SUGGESTED_SPORTS,
  toggleSportInType,
  trainingLabel,
  trainingSportIndexes,
} from './sports'

describe('sport personali (step 19)', () => {
  it('Palestra è il consigliato e fra i suggeriti', () => {
    expect(RECOMMENDED_SPORT).toBe('Palestra')
    expect(SUGGESTED_SPORTS[0]).toBe('Palestra')
  })

  it('aggiungere: vuoto, troppo lungo, doppione (anche maiuscole/accenti diversi), massimo 4', () => {
    expect(addSport([], '')).toEqual({ ok: false, message: 'Scrivi il nome dello sport.' })
    expect(addSport([], 'a'.repeat(25))).toEqual({ ok: false, message: 'Al massimo 24 caratteri.' })
    expect(addSport(['Palestra'], 'palestra')).toEqual({ ok: false, message: 'Hai già aggiunto questo sport.' })
    expect(addSport(['Pallavolo'], 'PALLAVOLO')).toMatchObject({ ok: false })
    expect(addSport(['Palestra', 'Calcio', 'Nuoto'], 'Corsa')).toEqual({ ok: true, value: ['Palestra', 'Calcio', 'Nuoto', 'Corsa'] })
    expect(addSport(['Palestra', 'Calcio', 'Nuoto', 'Corsa'], 'Basket')).toMatchObject({ ok: false })
    expect(addSport([], ' nuoto ')).toEqual({ ok: true, value: ['Nuoto'] })
    expect(addSport(['Palestra'], 'calcio')).toEqual({ ok: true, value: ['Palestra', 'Calcio'] })
  })

  it('dal database: solo testi validi, puliti, senza doppioni, al massimo 4', () => {
    expect(parseSports(['Palestra', 'Calcio'])).toEqual(['Palestra', 'Calcio'])
    expect(parseSports(['palestra', 'PALESTRA', 'Calcio', 'Nuoto', 'Corsa', 'Basket'])).toEqual(['Palestra', 'Calcio', 'Nuoto', 'Corsa'])
    expect(parseSports(['Palestra', 5, null, '  '])).toEqual(['Palestra'])
    expect(parseSports('Palestra')).toEqual([])
    expect(parseSports(undefined)).toEqual([])
  })
})

describe('tipi di giorno: gli sport fatti quel giorno (step 21)', () => {
  it('lettura: rest, uno o più sport; il vecchio "both" vale i primi due; valori sporchi → nessuno', () => {
    expect(trainingSportIndexes('rest')).toEqual([])
    expect(trainingSportIndexes('sport_1')).toEqual([0])
    expect(trainingSportIndexes('sport_1+sport_3')).toEqual([0, 2])
    expect(trainingSportIndexes('sport_3+sport_1')).toEqual([0, 2])
    expect(trainingSportIndexes('both')).toEqual([0, 1])
    expect(trainingSportIndexes('gym')).toEqual([])
    expect(trainingSportIndexes('sport_1+x')).toEqual([])
  })
  it('costruzione: ordinati, senza doppioni, nessuno = rest', () => {
    expect(buildTrainingType([])).toBe('rest')
    expect(buildTrainingType([2, 0, 2])).toBe('sport_1+sport_3')
    expect(buildTrainingType([3])).toBe('sport_4')
  })
  it('toccare uno sport dopo l’altro crea la combinazione; toccarlo di nuovo lo toglie', () => {
    let type = 'rest'
    type = toggleSportInType(type, 0)
    expect(type).toBe('sport_1')
    type = toggleSportInType(type, 2)
    expect(type).toBe('sport_1+sport_3')
    type = toggleSportInType(type, 1)
    expect(type).toBe('sport_1+sport_2+sport_3')
    type = toggleSportInType(type, 0)
    expect(type).toBe('sport_2+sport_3')
    type = toggleSportInType(toggleSportInType(type, 1), 2)
    expect(type).toBe('rest')
  })
  it('etichette con gli sport di adesso', () => {
    expect(trainingLabel('rest', ['Palestra'])).toBe('Riposo')
    expect(trainingLabel('sport_1', ['Palestra', 'Calcio'])).toBe('Palestra')
    expect(trainingLabel('sport_1+sport_2', ['Palestra', 'Calcio'])).toBe('Palestra + calcio')
    expect(trainingLabel('sport_1+sport_2+sport_4', ['Palestra', 'Calcio', 'Nuoto', 'CrossFit'])).toBe('Palestra + calcio + CrossFit')
    expect(trainingLabel('both', ['Palestra', 'Calcio'])).toBe('Palestra + calcio')
    expect(trainingLabel('sport_2', ['Palestra'])).toBe('Allenamento')
  })
  it('sigle e nomi con maiuscole interne restano', () => {
    expect(trainingLabel('sport_1+sport_2', ['CrossFit', 'HIIT'])).toBe('CrossFit + HIIT')
    expect(trainingLabel('sport_1+sport_2', ['Corsa', 'Basket'])).toBe('Corsa + basket')
  })
  it('sport cambiati: gli sport che non ci sono più si tolgono, se non resta niente Riposo', () => {
    expect(coerceTrainingType('sport_1+sport_2', ['Palestra'])).toBe('sport_1')
    expect(coerceTrainingType('both', ['Palestra'])).toBe('sport_1')
    expect(coerceTrainingType('sport_2', ['Palestra'])).toBe('rest')
    expect(coerceTrainingType('sport_1+sport_3', ['A', 'B', 'C'])).toBe('sport_1+sport_3')
    expect(coerceTrainingType('both', ['Palestra', 'Calcio'])).toBe('sport_1+sport_2')
    expect(coerceTrainingType('rest', [])).toBe('rest')
  })
})
