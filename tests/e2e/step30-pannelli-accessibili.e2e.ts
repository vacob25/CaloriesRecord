import { expect, test, type Browser } from '@playwright/test'

import { APP_URL, check, login, resetDatabase, seedProfile, sql, USERS, wire } from './support/harness'

async function openApp(browser: Browser, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await wire(ctx)
  const page = await ctx.newPage()
  return { ctx, page }
}

// Revisione #8: i pannelli portano il focus al titolo, lo trattengono, lo restituiscono e bloccano lo scorrimento della pagina.
test('Step 30 · pannello: focus, Tab, Esc e scorrimento', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  const { ctx, page } = await openApp(browser)
  await login(page)

  const opener = page.getByRole('button', { name: /modifica il peso/ })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()

  const insideDialog = () => page.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement) ?? false)
  check(await page.evaluate(() => document.activeElement?.tagName === 'H2'), 'all’apertura il focus è sul titolo del pannello')
  check(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'la pagina sotto non scorre mentre il pannello è aperto')

  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab')
    if (!(await insideDialog())) check(false, `Tab ${i + 1}: il focus è uscito dal pannello`)
  }
  await page.getByRole('heading', { level: 2 }).first().focus()
  await page.keyboard.press('Shift+Tab')
  check(await insideDialog(), 'Maiusc+Tab dal titolo resta nel pannello (va all’ultimo elemento)')

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  check(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.includes('modifica il peso') ?? false), 'alla chiusura il focus torna al pulsante che l’aveva aperto')
  check(await page.evaluate(() => document.body.style.overflow === ''), 'lo scorrimento della pagina torna normale')
  await ctx.close()
})

// Revisione #9: anche su uno schermo molto basso (iPhone SE con la tastiera aperta) il pannello non esce dallo schermo e la X si raggiunge.
test('Step 30 · pannelli alti su schermo basso: la X resta in vista', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  for (const key of ['custom_aaaaaaa1', 'custom_aaaaaaa2', 'custom_aaaaaaa3']) {
    sql(`insert into public.meal_slots (user_id, slot_key, name, position) values ('${USERS.a!.id}', '${key}', 'Pasto ${key.slice(-1)}', ${5 + Number(key.slice(-1))})`)
  }
  const height = 420
  const { ctx, page } = await openApp(browser, { width: 375, height })
  await login(page)

  const checkFits = async (label: string) => {
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    const box = (await dialog.boundingBox())!
    const close = (await dialog.getByRole('button', { name: 'Chiudi' }).boundingBox())!
    check(box.y >= 0 && close.y >= 0, `${label}: il pannello e la X non escono in alto (y = ${Math.round(box.y)})`)
    check(box.y + box.height <= height, `${label}: il pannello sta dentro lo schermo`)
  }

  await page.getByRole('button', { name: /modifica il peso/ }).click()
  await checkFits('Peso')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Gestisci i pasti' }).click()
  await expect(page.getByRole('dialog', { name: 'I tuoi pasti' }).getByRole('listitem')).toHaveCount(8)
  await checkFits('Pasti (8)')
  await ctx.close()
})

// Revisione #48: con la tastiera si vede dove si è, anche sulle scelte a carte.
test('Step 30 · anello di focus sulle scelte a carte', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  const { ctx, page } = await openApp(browser)
  await login(page)

  await page.goto(`${APP_URL}/aggiungi?pasto=lunch`)
  // La scelta del pasto sta sopra la ricerca: da lì si risale con Maiusc+Tab.
  await page.getByLabel('Cerca un cibo').focus()
  let reached = false
  for (let i = 0; i < 12 && !reached; i += 1) {
    await page.keyboard.press('Shift+Tab')
    reached = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type === 'radio')
  }
  check(reached, 'con Tab si raggiunge la scelta del pasto')
  const ring = await page.evaluate(() => {
    const radio = document.activeElement as HTMLInputElement
    return getComputedStyle(radio.closest('label')!).boxShadow
  })
  // L'etichetta scelta ha già una piccola ombra: si cerca proprio l'anello verde del focus (--color-green).
  check(ring.includes('rgb(26, 127, 90)'), `la scelta in focus ha l'anello verde (${ring.slice(0, 60)})`)
  await ctx.close()
})

// Revisione #49: "Annulla" non sparisce mentre ha il focus.
test('Step 30 · l’avviso "Annulla" aspetta finché ha il focus', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  sql(`insert into public.foods (user_id, name, kcal_100g, protein_100g, carbs_100g, fat_100g) values ('${USERS.a!.id}', 'Uovo', 143, 12.6, 0.7, 9.5)`)
  const { ctx, page } = await openApp(browser)
  await page.clock.install()
  await login(page)

  await page.goto(`${APP_URL}/aggiungi?pasto=lunch`)
  await page.getByRole('button', { name: /^Uovo/ }).click()
  await page.getByRole('button', { name: 'Aggiungi a pranzo' }).click()
  const undo = page.getByRole('button', { name: 'Annulla' })
  await undo.waitFor()
  await undo.focus()
  await page.clock.fastForward('00:30')
  check(await undo.isVisible(), '"Annulla" resta anche dopo 30 secondi se ha il focus')
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())
  await page.clock.fastForward('00:30')
  await expect(undo).toHaveCount(0)
  await ctx.close()
})

// Revisione #53: quale campo è sbagliato lo dice aria-invalid, e un errore di rete non accusa l’email.
test('Step 30 · login: campi segnati solo quando sono sbagliati', async ({ browser }) => {
  resetDatabase()
  const { ctx, page } = await openApp(browser)
  await page.goto(`${APP_URL}/login`)
  const email = page.getByLabel('Email')
  const password = page.getByLabel('Password', { exact: true })
  const invalid = async (locator: typeof email) => (await locator.getAttribute('aria-invalid')) === 'true'

  await email.fill('non-una-email')
  await password.fill('password-di-prova')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.getByRole('alert').waitFor()
  check((await invalid(email)) && !(await invalid(password)), 'email scritta male: solo l’email è segnata')

  await email.fill(USERS.a!.email)
  await password.fill('password-sbagliata')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.getByRole('alert').getByText(/non corretti/).waitFor()
  check((await invalid(email)) && (await invalid(password)), 'credenziali sbagliate: email e password segnate')
  check(((await password.getAttribute('aria-describedby')) ?? '').includes('login-error'), 'la password è collegata al messaggio d’errore')

  await ctx.route('**/auth/v1/token**', (route) => route.abort('failed'))
  await password.fill('password-di-prova')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.getByRole('alert').getByText(/connessione|raggiungere/i).waitFor()
  check(!(await invalid(email)) && !(await invalid(password)), 'errore di rete: nessun campo accusato')
  await ctx.close()
})

// Revisione #46: i grafici usano i colori dei token (variabili CSS), non copie scritte a mano.
test('Step 30 · i grafici seguono i token di colore', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) select '${USERS.a!.id}', (now() at time zone 'Europe/Rome')::date - g, 75 + g * 0.05 from generate_series(1, 14) g`)
  const { ctx, page } = await openApp(browser)
  await login(page)

  await page.goto(`${APP_URL}/peso`)
  await page.locator('.recharts-line-curve').first().waitFor()
  const line = page.locator('.recharts-line-curve').first()
  check((await line.evaluate((path) => getComputedStyle(path).stroke)) === 'rgb(47, 98, 217)', 'la linea del peso ha il blu del design')
  // Se il grafico usasse una copia scritta a mano, cambiare il token non lo smuoverebbe.
  await page.evaluate(() => document.documentElement.style.setProperty('--color-blue', 'rgb(1, 2, 3)'))
  check((await line.evaluate((path) => getComputedStyle(path).stroke)) === 'rgb(1, 2, 3)', 'la linea del peso segue --color-blue (variabile CSS, non un colore copiato)')
  await ctx.close()
})
