import { describe, expect, it } from 'vitest'

import { EXPORT_TABLES } from './exportData'
import { PRIVACY_DATA } from './privacyData'

describe('pagina Privacy e tabelle (revisione #21)', () => {
  it('descrive tutte le tabelle esportate e nessuna in più', () => {
    expect(Object.keys(PRIVACY_DATA).sort()).toEqual([...EXPORT_TABLES].sort())
  })

  it('ogni descrizione è una frase vera, non vuota', () => {
    for (const text of Object.values(PRIVACY_DATA)) expect(text.trim().length).toBeGreaterThan(10)
  })

  it('nomina ciò che mancava: obiettivo, ritmo del cut, sport, pasti su misura, contenitori, tipo di giorno', () => {
    const all = Object.values(PRIVACY_DATA).join(' ').toLowerCase()
    for (const word of ['obiettivo', 'ritmo del cut', 'sport', 'nomi e l’ordine dei tuoi pasti', 'contenitori', 'tipo di giorno']) {
      expect(all).toContain(word)
    }
  })
})
