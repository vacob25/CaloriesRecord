import { describe, expect, it } from 'vitest'

import { createAttemptIds, newId } from './ids'

const sequence = () => {
  let n = 0
  return () => `id-${++n}`
}

describe('newId', () => {
  it('è un UUID v4 e non si ripete', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newId()).not.toBe(newId())
  })
})

describe('createAttemptIds', () => {
  it('lo stesso gesto ripetuto (doppio tocco, Riprova) riusa lo stesso id', () => {
    const attempts = createAttemptIds(sequence())
    expect(attempts.idFor('uovo|2')).toBe('id-1')
    expect(attempts.idFor('uovo|2')).toBe('id-1')
  })

  it('un gesto diverso ha un id nuovo', () => {
    const attempts = createAttemptIds(sequence())
    expect(attempts.idFor('uovo|2')).toBe('id-1')
    expect(attempts.idFor('uovo|3')).toBe('id-2')
  })

  it('dopo un salvataggio riuscito lo stesso gesto è una voce nuova', () => {
    const attempts = createAttemptIds(sequence())
    expect(attempts.idFor('acqua|500')).toBe('id-1')
    attempts.done()
    expect(attempts.idFor('acqua|500')).toBe('id-2')
  })

  it('dopo un errore lo stesso gesto riprova con lo stesso id', () => {
    const attempts = createAttemptIds(sequence())
    const first = attempts.idFor('acqua|500')
    // nessun done(): il salvataggio è fallito o la risposta si è persa
    expect(attempts.idFor('acqua|500')).toBe(first)
  })
})
