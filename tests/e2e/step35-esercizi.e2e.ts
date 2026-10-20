import { chromium, expect, test } from '@playwright/test'

import { check, lit, login, resetDatabase, seedProfile, sql, USERS, wire } from './support/harness'

// Fase 3 (ADR-089): libreria esercizi. Catalogo globale in sola lettura + copia personale creata alla prima modifica.

const A = () => USERS.a!.id

test('Step 35 · libreria esercizi: cerca, filtra, note, modifica, nascondi, crea', async () => {
  resetDatabase()
  seedProfile()
  const total = Number(sql('select count(*) from public.exercise_catalog'))
  check(total > 600, `il catalogo ha ${total} esercizi`)

  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  const p = await ctx.newPage()
  const errs: string[] = []
  p.on('pageerror', (e) => errs.push(e.message))
  await login(p)

  await p.getByRole('link', { name: 'Palestra', exact: true }).click()
  await p.getByRole('link', { name: /^Esercizi/ }).click()
  await p.getByRole('heading', { name: 'Esercizi', exact: true }).waitFor()
  await expect(p.getByRole('status')).toHaveText(`${total} esercizi`)
  check((await p.locator('main ul li a').count()) === 60, 'si vedono i primi 60, con "Mostra altri"')
  await p.getByRole('button', { name: /^Mostra altri/ }).click()
  check((await p.locator('main ul li a').count()) === 120, '"Mostra altri" ne aggiunge 60')

  // Ricerca: anche con il nome inglese originale.
  await p.getByLabel('Cerca un esercizio').fill('lat pulldown')
  await expect(p.getByRole('status')).not.toHaveText(`${total} esercizi`)
  check((await p.getByRole('link', { name: /Lat machine/ }).count()) > 0, 'cercando "lat pulldown" compare "Lat machine"')
  await p.getByLabel('Cerca un esercizio').fill('xyzxyz')
  await p.getByText('Nessun esercizio con questa ricerca').waitFor()
  await p.getByLabel('Cerca un esercizio').fill('')

  // Filtri.
  await p.getByLabel('Gruppo muscolare').selectOption('chest')
  await p.getByLabel('Attrezzo').selectOption('dumbbell')
  const dbChest = Number(sql("select count(*) from public.exercise_catalog where equipment = 'dumbbell' and ('chest' = any (primary_muscles) or 'chest' = any (secondary_muscles))"))
  await expect(p.getByRole('status')).toHaveText(dbChest === 1 ? '1 esercizio' : `${dbChest} esercizi`)

  // Scheda: nota → nasce la copia personale.
  await p.getByLabel('Cerca un esercizio').fill('Panca piana con manubri')
  await p.getByRole('link', { name: /^Panca piana con manubri/ }).first().click()
  await p.getByRole('heading', { name: 'Panca piana con manubri', level: 1 }).waitFor()
  check(sql(`select count(*) from public.user_exercises where user_id = ${lit(A())}`) === '0', 'guardare un esercizio non crea niente')
  await p.getByLabel('Note sull’esercizio').fill('Panca a 30°, spalle indietro')
  await p.getByRole('button', { name: 'Salva la nota' }).click()
  await expect(p.getByRole('button', { name: 'Salva la nota' })).toBeDisabled()
  check(sql(`select notes from public.user_exercises where catalog_id is not null`) === 'Panca a 30°, spalle indietro', 'la nota è salvata nella copia personale')
  check(sql(`select name is null and equipment is null and primary_muscles is null from public.user_exercises where catalog_id is not null`) === 't', 'la copia personale non duplica i dati del catalogo')

  // Modifica del nome: salva solo il campo cambiato.
  await p.getByRole('button', { name: 'Modifica' }).click()
  await p.getByLabel('Nome').fill('Panca manubri (la mia)')
  await p.getByRole('button', { name: 'Salva' }).click()
  await p.getByRole('heading', { name: 'Panca manubri (la mia)', level: 1 }).waitFor()
  check(sql(`select name || '|' || coalesce(equipment, 'null') from public.user_exercises where catalog_id is not null`) === 'Panca manubri (la mia)|null', 'cambiato solo il nome: gli altri campi restano "come nel catalogo"')
  await p.getByText('Nome originale').waitFor()
  check(sql("select count(*) from public.exercise_catalog where name_it = 'Panca manubri (la mia)'") === '0', 'il catalogo globale non è stato toccato')

  // Ripristina i valori originali: il nome torna, la nota resta.
  await p.getByRole('button', { name: 'Ripristina i valori originali' }).click()
  await p.getByRole('heading', { name: 'Panca piana con manubri', level: 1 }).waitFor()
  check(sql(`select name is null and notes is not null from public.user_exercises where catalog_id is not null`) === 't', 'ripristinato il nome, la nota resta')

  // Nascondi: sparisce dall'elenco, ricompare con "Mostra anche i nascosti".
  await p.getByRole('button', { name: 'Nascondi' }).click()
  await p.getByRole('button', { name: 'Mostra di nuovo' }).waitFor()
  await p.getByRole('link', { name: 'Indietro' }).click()
  await p.getByLabel('Cerca un esercizio').fill('Panca piana con manubri')
  check((await p.getByRole('link', { name: /^Panca piana con manubri/ }).count()) === 0, 'l’esercizio nascosto non è nell’elenco')
  await p.getByLabel('Mostra anche i nascosti').check()
  await p.getByRole('link', { name: /^Panca piana con manubri.*Nascosto/ }).first().waitFor()

  // Esercizio creato da te.
  await p.getByRole('link', { name: '+ Nuovo' }).click()
  await p.getByRole('button', { name: 'Salva' }).click()
  await p.getByText('Scrivi il nome dell’esercizio.').waitFor()
  await p.getByText('Scegli almeno un gruppo muscolare principale.').waitFor()
  await p.getByLabel('Nome').fill('Rematore al cavo basso')
  await p.getByLabel('Attrezzo').selectOption('cable')
  await p.locator('#primary-lats').check()
  await p.locator('#secondary-biceps').check()
  await p.getByRole('button', { name: 'Salva' }).click()
  await p.getByRole('heading', { name: 'Rematore al cavo basso', level: 1 }).waitFor()
  check(sql("select name || '|' || equipment || '|' || array_to_string(primary_muscles, ',') from public.user_exercises where catalog_id is null") === 'Rematore al cavo basso|cable|lats', 'esercizio creato con attrezzo e gruppi')
  // Doppione di nome: rifiutato.
  await p.getByRole('link', { name: 'Indietro' }).click()
  await p.getByRole('link', { name: '+ Nuovo' }).click()
  await p.getByLabel('Nome').fill('rematore AL cavo basso')
  await p.locator('#primary-lats').check()
  await p.getByRole('button', { name: 'Salva' }).click()
  await p.getByText('Hai già un esercizio con questo nome.').waitFor()

  // Elimina (due tocchi).
  await p.getByRole('link', { name: 'Indietro' }).click()
  await p.getByLabel('Cerca un esercizio').fill('Rematore al cavo basso')
  await p.getByRole('link', { name: /^Rematore al cavo basso/ }).click()
  await p.getByRole('button', { name: 'Elimina questo esercizio' }).click()
  await p.getByRole('button', { name: 'Tocca ancora per eliminare davvero' }).click()
  await p.getByRole('heading', { name: 'Esercizi', exact: true }).waitFor()
  check(sql('select count(*) from public.user_exercises where catalog_id is null') === '0', 'esercizio creato eliminato')

  // Privacy: l'altro utente non vede niente di A, ma il catalogo sì.
  check(sql(`select count(*) from public.user_exercises where user_id = ${lit(USERS.b!.id)}`) === '0', 'l’altro utente non ha esercizi personali')
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`)
  await b.close()
})
