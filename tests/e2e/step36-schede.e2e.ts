import { chromium, expect, test } from '@playwright/test'

import { check, lit, login, resetDatabase, seedProfile, sql, USERS, wire } from './support/harness'

// Fase 4 (ADR-090): schede di allenamento. Scheda → giorni → esercizi (serie, ripetizioni, pesi per serie, recupero, nota).

const A = () => USERS.a!.id

test('Step 36 · schede: crea, aggiungi esercizi, modifica, riordina, duplica, archivia', async () => {
  resetDatabase()
  seedProfile()
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  const p = await ctx.newPage()
  const errs: string[] = []
  p.on('pageerror', (e) => errs.push(e.message))
  await login(p)

  await p.getByRole('link', { name: 'Palestra', exact: true }).click()
  await p.getByRole('link', { name: /^Schede/ }).click()
  await p.getByText('Nessuna scheda').waitFor()
  await p.getByRole('link', { name: '+ Nuova scheda' }).click()

  // Validazione: nome vuoto.
  await p.getByRole('button', { name: 'Crea la scheda' }).click()
  await p.getByText('Scrivi il nome della scheda.').waitFor()
  await p.getByLabel('Nome della scheda').fill('Push Pull')
  await p.getByRole('button', { name: 'Un giorno in meno' }).click()
  await expect(p.getByRole('group', { name: 'Giorni di allenamento' })).toContainText('2')
  await p.locator('#day-name-0').fill('Push')
  await p.locator('#day-weekday-0').selectOption('1')
  await p.locator('#day-name-1').fill('Gambe')
  await p.getByRole('button', { name: 'Crea la scheda' }).click()
  await p.getByRole('heading', { name: 'Push Pull', level: 1 }).waitFor()
  check(sql(`select string_agg(name || coalesce(weekday::text, '-'), ',' order by position) from public.workout_days`) === 'Push1,Gambe-', 'giorni creati con nome, giorno della settimana e ordine')

  // Giorno Push: aggiungi esercizi dal selettore per gruppo.
  await p.getByRole('link', { name: /^Push/ }).click()
  await p.getByText('Nessun esercizio in questo giorno').waitFor()
  await p.getByRole('button', { name: '+ Aggiungi esercizio' }).click()
  const chestGroup = p.getByRole('button', { name: /^Petto \(/ })
  await chestGroup.click()
  check((await chestGroup.getAttribute('aria-expanded')) === 'true', 'il gruppo Petto si apre')
  // Filtro per attrezzo nel selettore: con "Cavo" non resta nessun esercizio a manubri.
  await p.getByLabel('Attrezzo').selectOption('cable')
  check((await p.getByRole('button', { name: /^Panca piana con manubri/ }).count()) === 0, 'il filtro attrezzo nasconde gli esercizi con altri attrezzi')
  await p.getByLabel('Attrezzo').selectOption('dumbbell')
  await p.getByRole('button', { name: /^Panca piana con manubri/ }).first().waitFor()
  await p.getByRole('button', { name: /^Panca piana con manubri/ }).first().click()
  await p.getByText('Aggiunto: Panca piana con manubri').waitFor()
  await p.getByLabel('Attrezzo').selectOption({ label: 'Tutti' })
  await p.getByLabel('Cerca').fill('lat pulldown')
  await p.getByRole('button', { name: /^Lat machine/ }).first().click()
  await p.getByText('Aggiunto: Lat machine').waitFor()
  await p.getByRole('button', { name: 'Chiudi' }).click()
  check(sql('select count(*) from public.workout_day_exercises') === '2', 'due esercizi nel giorno')
  check(sql('select string_agg(sets || \'x\' || reps_min || \'|\' || array_to_string(reps_per_set, \',\'), \';\' order by position) from public.workout_day_exercises') === '3x10|10,10,10;3x10|10,10,10', 'valori di partenza: 3 serie da 10 ripetizioni (segnaposto modificabili)')

  // Modifica del primo esercizio: una riga per serie, ripetizioni a sinistra e chili a destra.
  const first = p.getByRole('heading', { name: 'Panca piana con manubri', level: 3 }).locator('xpath=ancestor::li')
  await expect(first.getByLabel(/^Ripetizioni serie/)).toHaveCount(3)
  await first.getByRole('button', { name: '+ Aggiungi serie' }).click()
  await expect(first.getByLabel(/^Ripetizioni serie/)).toHaveCount(4)
  await expect(first.getByText('4×10')).toBeVisible()
  await first.getByLabel('Ripetizioni serie 1').fill('abc')
  await first.getByLabel('Ripetizioni serie 1').blur()
  await first.getByText('Le ripetizioni vanno da 1 a 100.').waitFor()
  check(sql('select min(reps_min) from public.workout_day_exercises') === '10', 'ripetizioni non valide non si salvano')
  await first.getByLabel('Ripetizioni serie 1').fill('12')
  await first.getByLabel('Ripetizioni serie 1').blur()
  await first.getByLabel('Ripetizioni serie 3').fill('8')
  await first.getByLabel('Ripetizioni serie 3').blur()
  await first.getByLabel('Recupero').fill('1:30')
  await first.getByLabel('Recupero').blur()
  await first.getByLabel('Chili serie 1').fill('60,5')
  await first.getByLabel('Chili serie 1').blur()
  await first.getByLabel('Chili serie 3').fill('62')
  await first.getByLabel('Chili serie 3').blur()
  await first.getByLabel('Nota').fill('Spalle indietro')
  await first.getByLabel('Nota').blur()
  await expect.poll(() => sql(`select sets || '|' || reps_min || '-' || reps_max || '|' || rest_seconds || '|' || array_to_string(reps_per_set, ',') || '|' || array_to_string(weights_kg, ',', '_') || '|' || note from public.workout_day_exercises where position = 0`)).toBe('4|8-12|90|12,10,8,10|60.5,_,62.0|Spalle indietro')
  await expect(first.getByText('12/10/8/10 · 60,5–62 kg')).toBeVisible()

  // Togliere una serie toglie le sue ripetizioni e il suo peso; "Aggiungi serie" copia l'ultima.
  await first.getByRole('button', { name: /^Togli serie 4 di/ }).click()
  await first.getByRole('button', { name: /^Togli serie 3 di/ }).click()
  await expect.poll(() => sql(`select sets || '|' || array_to_string(reps_per_set, ',') || '|' || array_to_string(weights_kg, ',', '_') from public.workout_day_exercises where position = 0`)).toBe('2|12,10|60.5')
  await expect(first.getByLabel('Chili serie 1')).toHaveValue('60,5')
  await first.getByRole('button', { name: '+ Aggiungi serie' }).click()
  await expect.poll(() => sql(`select sets || '|' || array_to_string(reps_per_set, ',') from public.workout_day_exercises where position = 0`)).toBe('3|12,10,10')
  await first.getByRole('button', { name: /^Togli serie 3 di/ }).click()
  await expect.poll(() => sql(`select sets from public.workout_day_exercises where position = 0`)).toBe('2')

  // Riordino.
  await first.getByRole('button', { name: /Sposta Panca piana con manubri giù/ }).click()
  await expect.poll(() => sql(`select name_it from public.exercise_catalog c join public.workout_day_exercises e on e.catalog_id = c.id order by e.position limit 1`)).toBe('Lat machine a un braccio')

  // Un esercizio rinominato resta nella scheda col nuovo nome (la scheda punta al catalogo).
  const catalogId = sql(`select id from public.exercise_catalog where name_it = 'Lat machine a un braccio'`)
  sql(`insert into public.user_exercises (user_id, catalog_id, name) values (${lit(A())}, ${lit(catalogId)}, 'Lat machine presa larga')`)
  await p.reload()
  await p.getByRole('heading', { name: 'Lat machine presa larga', level: 3 }).waitFor()

  // Togli (due tocchi).
  await p.getByRole('button', { name: /^Togli Lat machine presa larga/ }).click()
  await p.getByRole('button', { name: 'Tocca ancora per togliere' }).click()
  await expect.poll(() => sql('select count(*) from public.workout_day_exercises')).toBe('1')

  // Duplica giorno.
  await p.getByRole('button', { name: 'Duplica il giorno' }).click()
  await p.getByRole('heading', { name: 'Push (copia)', level: 1 }).waitFor()
  await p.getByRole('heading', { name: 'Panca piana con manubri', level: 3 }).waitFor()
  check(sql(`select count(*) from public.workout_days where weekday is null and name = 'Push (copia)'`) === '1', 'il giorno duplicato non ha giorno della settimana')

  // Duplica scheda e archivia.
  await p.getByRole('link', { name: 'Indietro' }).click()
  await p.getByRole('button', { name: 'Duplica scheda' }).click()
  await p.getByRole('heading', { name: 'Push Pull (copia)', level: 1 }).waitFor()
  check(sql(`select count(*) from public.workout_days d join public.workout_plans pl on pl.id = d.plan_id where pl.name = 'Push Pull (copia)'`) === '3', 'la scheda duplicata ha i 3 giorni')
  await p.getByRole('button', { name: 'Archivia la scheda' }).click()
  await p.getByRole('heading', { name: 'Schede', level: 1 }).waitFor()
  await expect(p.getByRole('link', { name: /^Push Pull \(copia\)/ })).toHaveCount(0)
  await p.getByLabel('Mostra anche le archiviate').check()
  await p.getByRole('link', { name: /^Push Pull \(copia\).*archiviata/ }).waitFor()

  // Un esercizio usato in una scheda non si elimina: messaggio chiaro.
  sql(`insert into public.user_exercises (user_id, name, equipment, primary_muscles) values (${lit(A())}, 'Mio esercizio', 'cable', array['lats'])`)
  const customId = sql(`select id from public.user_exercises where name = 'Mio esercizio'`)
  const dayId = sql(`select id from public.workout_days where name = 'Gambe' limit 1`)
  sql(`insert into public.workout_day_exercises (user_id, day_id, user_exercise_id) values (${lit(A())}, ${lit(dayId)}, ${lit(customId)})`)
  await p.goto(`http://localhost:4180/palestra/esercizi/${encodeURIComponent('u:' + customId)}`)
  await p.getByRole('button', { name: 'Elimina questo esercizio' }).click()
  await p.getByRole('button', { name: 'Tocca ancora per eliminare davvero' }).click()
  await p.getByText('Questo esercizio è usato in una scheda: puoi nasconderlo invece di eliminarlo.').waitFor()

  // Eliminare la scheda cancella giorni ed esercizi.
  await p.goto('http://localhost:4180/palestra/schede')
  await p.getByRole('link', { name: /^Push Pull \d? ?giorni|^Push Pull/ }).first().click()
  await p.getByRole('button', { name: 'Elimina la scheda' }).click()
  await p.getByRole('button', { name: 'Tocca ancora per eliminare davvero' }).click()
  await p.getByRole('heading', { name: 'Schede', level: 1 }).waitFor()
  check(sql(`select count(*) from public.workout_plans where name = 'Push Pull'`) === '0', 'scheda eliminata')

  check(sql(`select count(*) from public.workout_plans where user_id = ${lit(USERS.b!.id)}`) === '0', 'l’altro utente non ha schede')
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`)
  await b.close()
})
