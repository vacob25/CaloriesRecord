import { chromium, expect, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, wire } from './support/harness'

// Barra in basso: Palestra, Cibi, Oggi (centro), Statistiche, Profilo; la voce in cui sei è verde; "Oggi" resta accesa
// in Aggiungi pasto; la schermata nuova compare con una piccola animazione.

const GREEN = 'rgb(26, 127, 90)'

test('Step 34 · barra di navigazione: ordine, voce verde, Oggi al centro', async () => {
  resetDatabase()
  seedProfile()
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  const p = await ctx.newPage()
  const errs: string[] = []
  p.on('pageerror', (e) => errs.push(e.message))
  await login(p)

  const nav = p.getByRole('navigation', { name: 'Navigazione principale' })
  const names = await nav.getByRole('link').allTextContents()
  check(JSON.stringify(names) === JSON.stringify(['Palestra', 'Cibi', 'Oggi', 'Statistiche', 'Profilo']), `ordine delle voci: ${names.join(', ')}`)

  const bg = (name: string) => nav.getByRole('link', { name, exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor)
  await expect(nav.getByRole('link', { name: 'Oggi', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect.poll(() => bg('Oggi')).toBe(GREEN)
  check((await bg('Statistiche')) !== GREEN, 'Statistiche non è verde quando sei in Oggi')

  const oggi = await nav.getByRole('link', { name: 'Oggi', exact: true }).boundingBox()
  const stats = await nav.getByRole('link', { name: 'Statistiche', exact: true }).boundingBox()
  check(!!oggi && !!stats && oggi.height > stats.height && Math.abs(oggi.x + oggi.width / 2 - 195) < 3, 'Oggi è più grande e sta al centro dello schermo')

  await nav.getByRole('link', { name: 'Statistiche', exact: true }).click()
  await expect(nav.getByRole('link', { name: 'Statistiche', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect.poll(() => bg('Statistiche')).toBe(GREEN)
  await expect.poll(() => bg('Oggi')).not.toBe(GREEN)
  check((await nav.locator('[aria-current="page"]').count()) === 1, 'una sola voce accesa')

  await nav.getByRole('link', { name: 'Palestra', exact: true }).click()
  await p.getByRole('heading', { name: 'Palestra', exact: true }).waitFor()
  await expect(nav.getByRole('link', { name: 'Palestra', exact: true })).toHaveAttribute('aria-current', 'page')

  // Aggiungi pasto si raggiunge da Oggi e lascia Oggi acceso.
  await nav.getByRole('link', { name: 'Oggi', exact: true }).click()
  await p.getByRole('link', { name: /Aggiungi/ }).first().click()
  await p.waitForURL(/\/aggiungi/)
  await expect(nav.getByRole('link', { name: 'Oggi', exact: true })).toHaveAttribute('aria-current', 'page')

  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`)
  await b.close()
})
