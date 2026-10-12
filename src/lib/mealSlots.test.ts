import { describe, expect, it } from 'vitest'

import { MEAL_NAME_MAX, MEAL_SLOTS_MAX } from './constants'
import {
  canAddSlot,
  canRemoveSlot,
  dragTargetIndex,
  cleanMealName,
  DEFAULT_MEAL_SLOTS,
  mealForHour,
  moveSlot,
  newSlotKey,
  reorderByDrag,
  slotName,
  validateMealName,
} from './mealSlots'

describe('mealForHour (pasti di partenza)', () => {
  it.each([
    [0, 'snack'],
    [4, 'snack'],
    [5, 'breakfast'],
    [9, 'breakfast'],
    [10, 'morning_snack'],
    [11, 'morning_snack'],
    [12, 'lunch'],
    [14, 'lunch'],
    [15, 'snack'],
    [18, 'dinner'],
    [22, 'dinner'],
    [23, 'snack'],
  ] as const)('ore %s → %s', (hour, meal) => {
    expect(mealForHour(hour, DEFAULT_MEAL_SLOTS)).toBe(meal)
  })

  it('se il pasto della fascia è stato eliminato usa quello della fascia precedente', () => {
    const noMorningSnack = DEFAULT_MEAL_SLOTS.filter((slot) => slot.key !== 'morning_snack')
    expect(mealForHour(11, noMorningSnack)).toBe('breakfast')
  })

  it('dopo l’eliminazione di Spuntino, di notte si torna all’ultimo pasto che esiste (giro di 24 ore)', () => {
    const noSnack = DEFAULT_MEAL_SLOTS.filter((slot) => slot.key !== 'snack')
    expect(mealForHour(2, noSnack)).toBe('dinner')
  })

  it('se nessuno dei pasti di partenza esiste prende il primo dell’utente', () => {
    expect(mealForHour(13, [{ key: 'custom_1', name: 'Pasto 1' }])).toBe('custom_1')
  })
})

describe('cleanMealName', () => {
  it('sistema spazi e iniziale', () => {
    expect(cleanMealName('  dopo   cena ')).toBe('Dopo cena')
    expect(cleanMealName('   ')).toBe('')
  })
})

describe('validateMealName', () => {
  it('accetta un nome nuovo e lo pulisce', () => {
    expect(validateMealName(' post  allenamento ', DEFAULT_MEAL_SLOTS)).toEqual({ ok: true, value: 'Post allenamento' })
  })
  it('rifiuta vuoto e troppo lungo', () => {
    expect(validateMealName('  ', DEFAULT_MEAL_SLOTS).ok).toBe(false)
    expect(validateMealName('x'.repeat(MEAL_NAME_MAX + 1), DEFAULT_MEAL_SLOTS).ok).toBe(false)
    expect(validateMealName('x'.repeat(MEAL_NAME_MAX), DEFAULT_MEAL_SLOTS).ok).toBe(true)
  })
  it('rifiuta un doppione anche con maiuscole e accenti diversi', () => {
    expect(validateMealName('PRANZO', DEFAULT_MEAL_SLOTS)).toEqual({ ok: false, message: 'Hai già un pasto con questo nome.' })
    expect(validateMealName('Pranzò', DEFAULT_MEAL_SLOTS).ok).toBe(false)
  })
  it('rinominare un pasto con il suo stesso nome (cambiando solo le maiuscole) è permesso', () => {
    expect(validateMealName('pranzo', DEFAULT_MEAL_SLOTS, 'lunch')).toEqual({ ok: true, value: 'Pranzo' })
  })
})

describe('limiti', () => {
  it('al massimo 8 pasti, almeno 1', () => {
    const eight = Array.from({ length: MEAL_SLOTS_MAX }, (_, i) => ({ key: `custom_${i}`, name: `P${i}` }))
    expect(canAddSlot(DEFAULT_MEAL_SLOTS)).toBe(true)
    expect(canAddSlot(eight)).toBe(false)
    expect(canRemoveSlot(DEFAULT_MEAL_SLOTS)).toBe(true)
    expect(canRemoveSlot([{ key: 'a', name: 'A' }])).toBe(false)
  })
})

describe('newSlotKey', () => {
  it('custom_ + 8 esadecimali, valido per il vincolo del database', () => {
    expect(newSlotKey(() => 0)).toBe('custom_00000000')
    expect(newSlotKey(() => 0.99)).toBe('custom_ffffffff')
    expect(newSlotKey()).toMatch(/^custom_[0-9a-f]{8}$/)
  })
})

describe('moveSlot', () => {
  const keys = (slots: { key: string }[]) => slots.map((slot) => slot.key)
  it('sposta su e giù senza toccare l’originale', () => {
    expect(keys(moveSlot(DEFAULT_MEAL_SLOTS, 'lunch', -1))).toEqual(['breakfast', 'lunch', 'morning_snack', 'dinner', 'snack'])
    expect(keys(moveSlot(DEFAULT_MEAL_SLOTS, 'lunch', 1))).toEqual(['breakfast', 'morning_snack', 'dinner', 'lunch', 'snack'])
    expect(keys([...DEFAULT_MEAL_SLOTS])).toEqual(['breakfast', 'morning_snack', 'lunch', 'dinner', 'snack'])
  })
  it('ai bordi o con chiave sconosciuta non cambia niente', () => {
    expect(keys(moveSlot(DEFAULT_MEAL_SLOTS, 'breakfast', -1))).toEqual(keys([...DEFAULT_MEAL_SLOTS]))
    expect(keys(moveSlot(DEFAULT_MEAL_SLOTS, 'snack', 1))).toEqual(keys([...DEFAULT_MEAL_SLOTS]))
    expect(keys(moveSlot(DEFAULT_MEAL_SLOTS, 'nope', 1))).toEqual(keys([...DEFAULT_MEAL_SLOTS]))
  })
})

describe('slotName', () => {
  it('nome dalla chiave, "Pasto" se manca', () => {
    expect(slotName(DEFAULT_MEAL_SLOTS, 'dinner')).toBe('Cena')
    expect(slotName(DEFAULT_MEAL_SLOTS, 'zzz')).toBe('Pasto')
  })
})

describe('dragTargetIndex e reorderByDrag', () => {
  it('mezza riga di spostamento arrotonda alla riga più vicina, sempre dentro l’elenco', () => {
    expect(dragTargetIndex(2, 0, 50, 5)).toBe(2)
    expect(dragTargetIndex(2, 24, 50, 5)).toBe(2)
    expect(dragTargetIndex(2, 26, 50, 5)).toBe(3)
    expect(dragTargetIndex(2, -80, 50, 5)).toBe(0)
    expect(dragTargetIndex(2, 999, 50, 5)).toBe(4)
    expect(dragTargetIndex(0, -999, 50, 5)).toBe(0)
  })
  it('riordina portando un elemento in un’altra posizione', () => {
    expect(reorderByDrag(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(reorderByDrag(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(reorderByDrag(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(reorderByDrag(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})
