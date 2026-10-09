import { describe, expect, it } from 'vitest'

import { addSport, cleanSportName, coerceTrainingType, parseSports, RECOMMENDED_SPORT, SUGGESTED_SPORTS, trainingDayTypes, trainingLabel } from './sports'

describe('sport personali (step 19)', () => {
  it('Palestra è il consigliato e fra i suggeriti', () => {
    expect(RECOMMENDED_SPORT).toBe('Palestra')
    expect(SUGGESTED_SPORTS[0]).toBe('Palestra')
  })

  it('nome pulito: spazi, iniziale maiuscola, niente caratteri di controllo', () => {
    expect(cleanSportName('  calcio   a  5 ')).toBe('Calcio a 5')
    expect(cleanSportName('corsa\n\tvelocità')).toBe('Corsa velocità')
    expect(cleanSportName('   ')).toBe('')
  })

  it('aggiungere: vuoto, troppo lungo, doppione (anche maiuscole/accenti diversi), massimo 2', () => {
    expect(addSport([], '')).toEqual({ ok: false, message: 'Scrivi il nome dello sport.' })
    expect(addSport([], 'a'.repeat(25))).toEqual({ ok: false, message: 'Al massimo 24 caratteri.' })
    expect(addSport(['Palestra'], 'palestra')).toEqual({ ok: false, message: 'Hai già aggiunto questo sport.' })
    expect(addSport(['Pallavolo'], 'PALLAVOLO')).toMatchObject({ ok: false })
    expect(addSport(['Palestra', 'Calcio'], 'Nuoto')).toMatchObject({ ok: false })
    expect(addSport([], ' nuoto ')).toEqual({ ok: true, value: ['Nuoto'] })
    expect(addSport(['Palestra'], 'calcio')).toEqual({ ok: true, value: ['Palestra', 'Calcio'] })
  })

  it('dal database: solo testi validi, puliti, senza doppioni, al massimo 2', () => {
    expect(parseSports(['Palestra', 'Calcio'])).toEqual(['Palestra', 'Calcio'])
    expect(parseSports(['palestra', 'PALESTRA', 'Calcio', 'Nuoto'])).toEqual(['Palestra', 'Calcio'])
    expect(parseSports(['Palestra', 5, null, '  '])).toEqual(['Palestra'])
    expect(parseSports('Palestra')).toEqual([])
    expect(parseSports(undefined)).toEqual([])
  })
})

describe('tipi di giorno dagli sport (come Riposo / Palestra / Calcio / Palestra + calcio)', () => {
  it('due sport: quattro tipi, con "Palestra + calcio"', () => {
    expect(trainingDayTypes(['Palestra', 'Calcio'])).toEqual([
      { type: 'rest', label: 'Riposo' },
      { type: 'sport_1', label: 'Palestra' },
      { type: 'sport_2', label: 'Calcio' },
      { type: 'both', label: 'Palestra + calcio' },
    ])
  })
  it('un solo sport: Riposo e quello; nessuno sport: solo Riposo', () => {
    expect(trainingDayTypes(['Nuoto']).map((option) => option.type)).toEqual(['rest', 'sport_1'])
    expect(trainingDayTypes([])).toEqual([{ type: 'rest', label: 'Riposo' }])
  })
  it('sigle e nomi con maiuscole interne restano', () => {
    expect(trainingDayTypes(['CrossFit', 'HIIT']).at(-1)?.label).toBe('CrossFit + HIIT')
    expect(trainingDayTypes(['Corsa', 'Basket']).at(-1)?.label).toBe('Corsa + basket')
  })
  it('etichetta con gli sport di adesso; sport sparito → "Allenamento"', () => {
    expect(trainingLabel('both', ['Palestra', 'Calcio'])).toBe('Palestra + calcio')
    expect(trainingLabel('rest', [])).toBe('Riposo')
    expect(trainingLabel('sport_2', ['Palestra'])).toBe('Allenamento')
  })
  it('sport cambiati: un giorno che non esiste più torna a Riposo', () => {
    expect(coerceTrainingType('both', ['Palestra'])).toBe('rest')
    expect(coerceTrainingType('sport_1', ['Palestra'])).toBe('sport_1')
    expect(coerceTrainingType('rest', [])).toBe('rest')
  })
})
