import { describe, expect, it } from 'vitest'

import { buildExport, EXPORT_TABLES, exportFileName, isDeleteConfirmed, NOT_EXPORTED_TABLES } from './exportData'

/** Tabelle create nelle migrazioni (create table public.<nome>), lette come testo da Vite. */
const migrations = import.meta.glob<string>('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true })

function migrationTables(): string[] {
  const names = new Set<string>()
  for (const sql of Object.values(migrations)) {
    for (const match of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)) {
      if (match[1]) names.add(match[1])
    }
  }
  return [...names].sort()
}

describe('esporta i miei dati (step 18)', () => {
  it('l’elenco esportato coincide con le tabelle delle migrazioni (tranne quelle dichiarate non esportabili)', () => {
    const expected = migrationTables().filter((name) => !(name in NOT_EXPORTED_TABLES))
    expect([...EXPORT_TABLES].sort()).toEqual(expected)
    expect(migrationTables().length).toBeGreaterThanOrEqual(10)
  })

  it('JSON leggibile con data, account e tabelle', () => {
    const data = Object.fromEntries(EXPORT_TABLES.map((table) => [table, []])) as unknown as Parameters<typeof buildExport>[0]
    const parsed = JSON.parse(buildExport(data, new Date('2026-10-09T08:00:00Z'), 'utente.prova@example.com'))
    expect(parsed).toMatchObject({ app: 'CaloriesRecord', formato: 1, esportato_il: '2026-10-09T08:00:00.000Z', account: 'utente.prova@example.com' })
    expect(Object.keys(parsed.tabelle)).toEqual([...EXPORT_TABLES])
  })

  it('nome del file con il giorno locale', () => {
    expect(exportFileName('2026-10-09')).toBe('calories-record-dati-2026-10-09.json')
  })
})

describe('conferma eliminazione account', () => {
  it('solo "ELIMINA" esatto', () => {
    expect(isDeleteConfirmed('ELIMINA')).toBe(true)
    expect(isDeleteConfirmed('  ELIMINA ')).toBe(true)
    expect(isDeleteConfirmed('elimina')).toBe(false)
    expect(isDeleteConfirmed('ELIMIN')).toBe(false)
    expect(isDeleteConfirmed('')).toBe(false)
  })
})
