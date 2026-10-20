import { describe, expect, it } from 'vitest'

import {
  defaultReminderTime,
  initialSetting,
  isValidReminderTime,
  mealReminderSlot,
  shouldProposeSuspension,
  snapReminderTime,
  SUSPEND_PROPOSAL_DAYS,
  toHourMinute,
} from './reminders'

describe('orari dei promemoria', () => {
  it('accetta HH:MM a passi di 5 minuti', () => {
    for (const ok of ['00:00', '08:05', '12:30', '23:55']) expect(isValidReminderTime(ok)).toBe(true)
  })

  it('rifiuta formati e minuti non validi', () => {
    for (const bad of ['', '8:00', '24:00', '12:60', '12:31', '12:30:00', 'ab:cd']) expect(isValidReminderTime(bad)).toBe(false)
  })

  it('riporta al passo di 5 minuti verso il basso', () => {
    expect(snapReminderTime('12:34')).toBe('12:30')
    expect(snapReminderTime('12:30')).toBe('12:30')
    expect(snapReminderTime('07:04')).toBe('07:00')
    expect(snapReminderTime('99:00')).toBeNull()
  })

  it('toglie i secondi del tipo time del database', () => {
    expect(toHourMinute('12:30:00')).toBe('12:30')
  })

  it('suggerisce un orario per i pasti di partenza e mezzogiorno per gli altri', () => {
    expect(defaultReminderTime('breakfast')).toBe('08:00')
    expect(defaultReminderTime('dinner')).toBe('20:00')
    expect(defaultReminderTime('custom_ab12cd34')).toBe('12:00')
    for (const key of ['breakfast', 'morning_snack', 'lunch', 'snack', 'dinner', 'custom_x']) expect(isValidReminderTime(defaultReminderTime(key))).toBe(true)
  })

  it('l’impostazione di partenza è spenta e usa lo stesso orario nel weekend', () => {
    expect(initialSetting('lunch')).toEqual({ slot: 'meal:lunch', enabled: false, timeWeekday: '12:30', timeWeekend: null, proposalDismissedDay: null })
    expect(mealReminderSlot('custom_ab12cd34')).toBe('meal:custom_ab12cd34')
  })
})

describe('shouldProposeSuspension', () => {
  const today = '2026-10-20'
  const lastDays = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(19 - i).padStart(2, '0')}`) // 19, 18, …

  it('propone dopo 5 giorni di fila mandati e non registrati', () => {
    expect(SUSPEND_PROPOSAL_DAYS).toBe(5)
    expect(shouldProposeSuspension({ sentDays: lastDays(5), doneDays: [], today, dismissedDay: null })).toBe(true)
  })

  it('non propone con 4 giorni', () => {
    expect(shouldProposeSuspension({ sentDays: lastDays(4), doneDays: [], today, dismissedDay: null })).toBe(false)
  })

  it('oggi non conta, nemmeno se il promemoria è già partito', () => {
    expect(shouldProposeSuspension({ sentDays: [today, ...lastDays(4)], doneDays: [], today, dismissedDay: null })).toBe(false)
  })

  it('un solo giorno registrato interrompe la serie', () => {
    expect(shouldProposeSuspension({ sentDays: lastDays(5), doneDays: ['2026-10-17'], today, dismissedDay: null })).toBe(false)
  })

  it('un giorno senza promemoria interrompe la serie', () => {
    const sent = lastDays(5).filter((d) => d !== '2026-10-16')
    expect(shouldProposeSuspension({ sentDays: sent, doneDays: [], today, dismissedDay: null })).toBe(false)
  })

  it('funziona a cavallo di mese e del cambio d’ora', () => {
    const sent = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']
    expect(shouldProposeSuspension({ sentDays: sent, doneDays: [], today: '2026-10-30', dismissedDay: null })).toBe(true)
    const crossMonth = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']
    expect(shouldProposeSuspension({ sentDays: crossMonth, doneDays: [], today: '2026-11-02', dismissedDay: null })).toBe(true)
  })

  it('dopo "Continua" si riconta dai giorni successivi', () => {
    expect(shouldProposeSuspension({ sentDays: lastDays(5), doneDays: [], today, dismissedDay: '2026-10-19' })).toBe(false)
    expect(shouldProposeSuspension({ sentDays: lastDays(5), doneDays: [], today, dismissedDay: '2026-10-14' })).toBe(true)
    // 5 giorni nuovi dopo la scelta: propone di nuovo
    expect(shouldProposeSuspension({ sentDays: lastDays(5), doneDays: [], today: '2026-10-25', dismissedDay: '2026-10-19' })).toBe(false)
    expect(shouldProposeSuspension({ sentDays: [...lastDays(5), '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'], doneDays: [], today: '2026-10-25', dismissedDay: '2026-10-19' })).toBe(true)
  })
})
