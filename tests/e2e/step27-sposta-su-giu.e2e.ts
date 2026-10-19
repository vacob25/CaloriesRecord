import { expect, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'

const order = () => sql("select string_agg(slot_key, ',' order by position) from public.meal_slots")

// Revisione #10: il riordino dei pasti deve funzionare anche senza trascinare (VoiceOver, Switch Control, tastiera).
test('Step 27 · riordino dei pasti con "Sposta su/giù"', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await wire(ctx)
  const page = await ctx.newPage()
  await login(page)

  await page.getByRole('button', { name: 'Gestisci i pasti' }).click()
  const dialog = page.getByRole('dialog', { name: 'I tuoi pasti' })
  await expect(dialog.getByRole('listitem')).toHaveCount(5)
  const start = order()

  // Il pulsante c'è, ha un nome completo (non solo "giù") ed è raggiungibile.
  const down = dialog.getByRole('button', { name: 'Sposta Colazione giù' })
  const up = dialog.getByRole('button', { name: 'Sposta Colazione su' })
  await expect(down).toHaveCount(1)
  check(await up.isDisabled(), 'in cima, "Sposta su" è disattivato')

  await down.focus()
  await page.keyboard.press('Enter')
  await expect.poll(order).not.toBe(start)
  check(order().startsWith('morning_snack,breakfast,'), 'Sposta giù: Colazione scende di un posto')
  check(await page.evaluate(() => document.activeElement?.textContent?.includes('Sposta Colazione')), 'il focus resta sul pulsante dopo lo spostamento')
  await expect(dialog.getByRole('status')).toHaveText('Colazione: posizione 2 di 5')

  await up.focus()
  await page.keyboard.press('Enter')
  await expect.poll(order).toBe(start)
  await expect(dialog.getByRole('status')).toHaveText('Colazione: posizione 1 di 5')

  // Quando ha il focus, il pulsante si vede e si tocca con comodo (44 px).
  await down.focus()
  const box = await down.boundingBox()
  check((box?.height ?? 0) >= 44 && (box?.width ?? 0) >= 44, 'con il focus il pulsante è almeno 44 × 44 px')
  await ctx.close()
})
