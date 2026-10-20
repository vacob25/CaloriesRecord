import { describe, expect, it } from 'vitest'

/** `vercel.json` letto come testo da Vite (come le migrazioni in exportData.test.ts). */
const files = import.meta.glob<string>('../../vercel.json', { query: '?raw', import: 'default', eager: true })

function pageHeaders(): Record<string, string> {
  const config = JSON.parse(Object.values(files)[0] ?? '{}') as { headers?: { source: string; headers: { key: string; value: string }[] }[] }
  const all = config.headers?.find((rule) => rule.source === '/(.*)')
  return Object.fromEntries((all?.headers ?? []).map((header) => [header.key.toLowerCase(), header.value]))
}

describe('header di sicurezza di vercel.json (SECURITY.md, revisione #19)', () => {
  it('la pagina non si può incorniciare in un altro sito (clickjacking)', () => {
    const headers = pageHeaders()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  })

  it('restano gli header di prima: nosniff, nessun referrer, fotocamera solo dall’app', () => {
    const headers = pageHeaders()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('no-referrer')
    expect(headers['permissions-policy']).toContain('camera=(self)')
  })
})
