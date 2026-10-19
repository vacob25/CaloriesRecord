import { expect, test, type Browser } from '@playwright/test'

import { APP_URL, check, login, loseNextResponse, resetDatabase, seedProfile, sql, USERS, wire } from './support/harness'

const FOOD = "insert into public.foods (user_id, name, kcal_100g, protein_100g, carbs_100g, fat_100g) values ('" + USERS.a!.id + "', 'Uovo', 143, 12.6, 0.7, 9.5)"
const entries = () => Number(sql('select count(*) from public.meal_entries'))

async function openApp(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await wire(ctx)
  const page = await ctx.newPage()
  return { ctx, page }
}

test('Step 26 · risposta persa e "Riprova": una sola voce', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  sql(FOOD)
  const { ctx, page } = await openApp(browser)
  const state = await loseNextResponse(ctx, /\/rest\/v1\/meal_entries/)
  await login(page)

  await page.goto(`${APP_URL}/aggiungi?pasto=lunch`)
  await page.getByRole('button', { name: /^Uovo/ }).click()
  await page.getByRole('button', { name: 'Aggiungi a pranzo' }).click()
  await expect(page.getByRole('alert')).toContainText('connessione')
  check(state.lost === 1, 'la prima richiesta è arrivata al database ma la risposta è stata persa')
  check(entries() === 1, 'la voce è già salvata, anche se l’app non lo sa')

  await page.getByRole('button', { name: 'Aggiungi a pranzo' }).click()
  await page.getByText('Aggiunto a pranzo').waitFor()
  check(entries() === 1, 'dopo "Riprova" la voce è una sola (stesso id = stessa voce)')
  await ctx.close()
})

test('Step 26 · senza rete il salvataggio aspetta, lo dice e parte da solo', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  sql(FOOD)
  const { ctx, page } = await openApp(browser)
  await login(page)

  await page.goto(`${APP_URL}/aggiungi?pasto=lunch`)
  await page.getByRole('button', { name: /^Uovo/ }).click()
  await ctx.setOffline(true)
  await page.getByRole('button', { name: 'Aggiungi a pranzo' }).click()
  await expect(page.getByText('Salvataggio in attesa')).toBeVisible()
  check(entries() === 0, 'finché manca la rete non è stato scritto niente')

  await ctx.setOffline(false)
  await page.getByText('Aggiunto a pranzo').waitFor()
  check(entries() === 1, 'tornata la rete la voce è salvata una volta sola')
  await ctx.close()
})

// La revisione (#6) temeva che senza rete "Esci" non facesse nulla: supabase-js toglie la sessione locale comunque. Resta come protezione.
test('Step 26 · "Esci" funziona anche senza rete', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  const { ctx, page } = await openApp(browser)
  await ctx.route('**/auth/v1/logout**', (route) => route.abort('failed'))
  await login(page)

  await page.goto(`${APP_URL}/profilo`)
  await page.getByRole('button', { name: 'Esci' }).click()
  await page.waitForURL('**/login')
  await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible()
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('sb-')))
  check(keys.length === 0, 'la sessione è stata tolta dal telefono')
  await page.goto(`${APP_URL}/`)
  await page.waitForURL('**/login')
  await ctx.close()
})

test('Step 26 · schermata che non si carica: messaggio in italiano', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  const { ctx, page } = await openApp(browser)
  await login(page)
  await ctx.route('**/assets/StatsScreen-*.js', (route) => route.abort('failed'))

  await page.getByRole('link', { name: 'Statistiche' }).click()
  await expect(page.getByRole('heading', { name: 'Qualcosa è andato storto' })).toBeVisible()
  check((await page.getByRole('button', { name: 'Riprova' }).count()) === 1, 'c’è "Riprova"')
  check(!(await page.content()).includes('Unexpected Application Error'), 'niente pagina tecnica di React Router')
  await ctx.close()
})

test('Step 26 · ricaricamento in background fallito: l’app resta dov’è', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  const { ctx, page } = await openApp(browser)
  await page.clock.install()
  await login(page)
  await page.getByRole('heading', { name: 'Oggi', exact: true }).waitFor()

  // Il profilo è già in memoria; passa il tempo, i dati diventano "vecchi" e il ricaricamento fallisce.
  let hits = 0
  await ctx.route('**/rest/v1/profiles**', (route) => {
    hits += 1
    return route.abort('failed')
  })
  await page.clock.fastForward('01:00')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  // La rete e la libreria dei dati ritentano da sole (con pause): si fa passare il tempo simulato finché hanno finito.
  for (let step = 0; step < 24; step += 1) {
    await page.waitForTimeout(150)
    await page.clock.fastForward('00:10')
  }
  await page.waitForTimeout(300)
  check(hits >= 2, 'il ricaricamento del profilo è stato tentato ed è fallito')
  check(await page.getByRole('heading', { name: 'Oggi', exact: true }).isVisible(), 'la schermata Oggi è ancora lì')
  check((await page.getByRole('alert').count()) === 0, 'nessun errore a schermo intero al posto dell’app')
  await ctx.close()
})
