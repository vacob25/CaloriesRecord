import { expect, test, type Browser, type Page } from '@playwright/test'

import { APP_URL, check, login, resetDatabase, seedProfile, sql, USERS, wire } from './support/harness'

async function openApp(browser: Browser, height = 844) {
  const ctx = await browser.newContext({ viewport: { width: 390, height }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await wire(ctx)
  const page = await ctx.newPage()
  const requests: string[] = []
  page.on('request', (request) => {
    const match = request.url().match(/rest\/v1\/([a-z_]+)/)
    if (match) requests.push(`${request.method()} ${match[1]}`)
  })
  return { ctx, page, requests }
}

const count = (requests: string[], what: string) => requests.filter((request) => request === what).length

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}

// Revisione #16 e #17: meno richieste uguali, e niente riscaricare ciò che è appena stato scaricato.
test('Step 31 · richieste alla rete: apertura, ritorno, tipo di giorno, nuova pesata', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) select '${USERS.a!.id}', (now() at time zone 'Europe/Rome')::date - g, 75 from generate_series(1, 20) g on conflict do nothing`)
  const { ctx, page, requests } = await openApp(browser)
  await login(page)
  await page.getByRole('heading', { name: 'Oggi', exact: true }).waitFor()
  await settle(page)

  check(count(requests, 'GET profiles') === 1, `apertura di Oggi: il profilo si scarica una volta sola (${count(requests, 'GET profiles')})`)
  check(count(requests, 'GET weight_logs') <= 3, `apertura di Oggi: le pesate al massimo 3 volte, prima 5 (${count(requests, 'GET weight_logs')})`)
  check(requests.length <= 16, `apertura di Oggi: al massimo 16 richieste in tutto, prima 20 (${requests.length})`)

  // Ritorno nell'app subito dopo: i dati che cambiano solo con le nostre scritture sono ancora freschi.
  requests.length = 0
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })))
  await settle(page)
  for (const table of ['profiles', 'meal_slots', 'drink_containers', 'foods']) {
    check(count(requests, `GET ${table}`) === 0, `ritorno nell'app: ${table} non si riscarica`)
  }

  // Tocco su un tipo di giorno: non servono né il profilo né le pesate di nuovo.
  requests.length = 0
  await page.getByRole('button', { name: /Giorno:/ }).click()
  await page.getByRole('button', { name: 'Palestra', exact: true }).click()
  await expect(page.getByRole('button', { name: /Giorno: Palestra/ })).toBeVisible()
  await settle(page)
  check(count(requests, 'GET profiles') === 0 && count(requests, 'GET weight_logs') === 0, `tipo di giorno: niente profilo né pesate da riscaricare (${requests.join(', ')})`)
  check(requests.length <= 5, `tipo di giorno: al massimo 5 richieste (${requests.length})`)

  // Una nuova pesata non riesegue la valutazione settimanale della ricalibrazione (7 richieste).
  requests.length = 0
  await page.getByRole('button', { name: /^75(,0)? kg|modifica il peso/ }).first().click()
  await page.getByLabel('Peso', { exact: true }).fill('75,5')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await settle(page)
  check(count(requests, 'GET tdee_estimates') === 0, `nuova pesata: la ricalibrazione non si riesegue subito (${count(requests, 'GET tdee_estimates')})`)
  await ctx.close()
})

// Revisione #15: se il secondo passo di un salvataggio fallisce, il primo è comunque salvato e la schermata lo mostra.
test('Step 31 · profilo salvato a metà: la schermata si aggiorna comunque', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  const { ctx, page } = await openApp(browser)
  await login(page)
  // Il ricalcolo del target (secondo passo) fallisce.
  await ctx.route('**/rest/v1/daily_targets**', (route) => (route.request().method() === 'PATCH' ? route.abort('failed') : route.fallback()))
  await page.goto(`${APP_URL}/profilo`)
  await page.getByLabel('Altezza').fill('182')
  await page.getByRole('button', { name: 'Salva dati personali' }).click()
  await expect.poll(() => sql('select height_cm from public.profiles')).toBe('182.0')
  await page.waitForTimeout(500)
  // Si esce e si rientra: il modulo si ricarica dalla cache dei dati (non da ciò che si era appena scritto).
  await page.getByRole('link', { name: 'Oggi', exact: true }).click()
  await page.getByRole('heading', { name: 'Oggi', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Profilo', exact: true }).click()
  await expect(page.getByLabel('Altezza')).toBeVisible()
  check((await page.getByLabel('Altezza').inputValue()).startsWith('182'), 'rientrando, la schermata mostra il dato salvato anche se il ricalcolo è fallito')
  await ctx.close()
})

// Revisione #36: la voce trascinata compare subito nel nuovo pasto, senza aspettare il database.
test('Step 31 · spostare una voce è immediato', async ({ browser }) => {
  resetDatabase()
  seedProfile()
  // Schermo alto: Colazione e Pranzo devono essere entrambi in vista per trascinare senza scorrere.
  const today = sql("select (now() at time zone 'Europe/Rome')::date")
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g)
    values ('${USERS.a!.id}', '${today}', 'breakfast', 'Yogurt di prova', 150, 100, 8, 10, 3), ('${USERS.a!.id}', '${today}', 'breakfast', 'Pane di prova', 50, 130, 4, 25, 1)`)
  const { ctx, page } = await openApp(browser, 1200)
  await login(page)
  // Il salvataggio arriva dopo 2 secondi.
  await ctx.route('**/rest/v1/meal_entries**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return route.fallback()
  })

  await page.getByRole('region', { name: 'Colazione' }).getByText('Yogurt di prova').waitFor()
  await settle(page) // la pagina smette di spostarsi prima di misurare dove trascinare
  const entry = page.getByRole('region', { name: 'Colazione' }).getByRole('listitem').filter({ hasText: 'Yogurt di prova' })
  const box = (await entry.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(500)
  // Il bersaglio si misura dopo aver sollevato la voce: la pagina può spostarsi mentre la si solleva.
  const target = (await page.getByRole('link', { name: /Pranzo/ }).boundingBox())!
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 })
  await page.waitForTimeout(200) // il pasto sotto il dito si evidenzia prima del rilascio
  await page.mouse.up()

  await page.getByRole('region', { name: 'Pranzo' }).getByText('Yogurt di prova').waitFor({ timeout: 1200 })
  check(sql("select meal_type from public.meal_entries where food_name = 'Yogurt di prova'") === 'breakfast', 'la voce è già nel nuovo pasto mentre il database ha ancora il vecchio')
  await expect.poll(() => sql("select meal_type from public.meal_entries where food_name = 'Yogurt di prova'"), { timeout: 8000 }).toBe('lunch')
  await ctx.close()
})
