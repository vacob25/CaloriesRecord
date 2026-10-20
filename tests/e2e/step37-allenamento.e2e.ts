import { chromium, expect, test } from '@playwright/test'

import { check, lit, login, resetDatabase, seedProfile, sql, USERS, wire } from './support/harness'

// Fase 5a (ADR-091): sessione di allenamento. Da scheda, checklist da fare/fatto/saltato, serie, ultima volta, riepilogo.

const A = () => USERS.a!.id

test('Step 37 · allenamento: inizia, spunta, salta, termina, ultima volta, elimina', async () => {
  resetDatabase()
  seedProfile()
  // Scheda di prova: giorno "Push" con due esercizi del catalogo.
  sql(`insert into public.workout_plans (user_id, name) values (${lit(A())}, 'Push Pull')`)
  const plan = sql('select id from public.workout_plans')
  sql(`insert into public.workout_days (user_id, plan_id, name, position) values (${lit(A())}, ${lit(plan)}, 'Push', 0)`)
  const day = sql(`select id from public.workout_days where name = 'Push'`)
  sql(`insert into public.workout_day_exercises (user_id, day_id, catalog_id, position, sets, reps_min, reps_max, weights_kg, rest_seconds)
    select ${lit(A())}, ${lit(day)}, id, 0, 3, 8, 12, array[50.0], 90 from public.exercise_catalog where name_it = 'Panca piana con manubri'`)
  sql(`insert into public.workout_day_exercises (user_id, day_id, catalog_id, position, sets, reps_min)
    select ${lit(A())}, ${lit(day)}, id, 1, 2, 10 from public.exercise_catalog where name_it = 'Calf raise in piedi con manubri'`)

  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  const p = await ctx.newPage()
  const errs: string[] = []
  p.on('pageerror', (e) => errs.push(e.message))
  await login(p)

  await p.getByRole('link', { name: 'Palestra', exact: true }).click()
  await p.getByRole('link', { name: 'Inizia allenamento' }).click()
  await p.getByRole('button', { name: /^Push Pull/ }).click()
  await p.getByRole('button', { name: /^Push/ }).click()
  await p.getByRole('heading', { name: 'Push', level: 1 }).waitFor()
  check(sql('select count(*) from public.workout_sessions where ended_at is null') === '1', 'sessione creata')
  check(sql(`select string_agg(exercise_name || ':' || planned_sets, ',' order by position) from public.workout_session_exercises`) === 'Panca piana con manubri:3,Calf raise in piedi con manubri:2', 'istantanea di nome e serie previste')
  check(sql(`select count(*) from public.reminder_status where slot = 'workout'`) === '1', 'iniziare la sessione segna lo stato "workout" del giorno')
  check(sql(`select string_agg(coalesce(weight_kg::text, '-') || 'x' || reps, ',' order by set_number) from public.workout_sets s join public.workout_session_exercises e on e.id = s.session_exercise_id where e.position = 0`) === '50.0x8,-x8,-x8', 'serie precompilate dalla scheda (peso della prima, ripetizioni minime)')

  // Serie 1: scrivi e spunta.
  const panca = p.getByRole('heading', { name: /^Panca piana con manubri/, level: 3 }).locator('xpath=ancestor::li[1]')
  await panca.getByLabel(/^kg serie 1/).fill('60,5')
  await panca.getByLabel(/^kg serie 1/).blur()
  await panca.getByLabel(/^rip\. serie 1/).fill('9')
  await panca.getByLabel(/^rip\. serie 1/).blur()
  await panca.getByRole('button', { name: /^Segna fatta la serie 1/ }).click()
  await expect.poll(() => sql(`select weight_kg || 'x' || reps || ':' || done from public.workout_sets s join public.workout_session_exercises e on e.id = s.session_exercise_id where e.position = 0 and set_number = 1`)).toBe('60.5x9:true')
  await expect.poll(() => sql(`select status from public.workout_session_exercises where position = 0`)).toBe('done') // spuntare una serie porta l’esercizio a "fatto"
  check(sql(`select completed_at is not null from public.workout_sets where done`) === 't', 'la serie fatta ha l’ora')
  await expect(p.getByRole('group', { name: 'Tempi' })).toContainText('Recupero')
  check(!((await p.getByRole('group', { name: 'Tempi' }).textContent()) ?? '').includes('Recupero–'), 'il timer di recupero è partito')

  // Tipo di serie, aggiungi e togli.
  await panca.getByLabel(/^Tipo della serie 2/).selectOption('warmup')
  await expect.poll(() => sql(`select kind from public.workout_sets s join public.workout_session_exercises e on e.id = s.session_exercise_id where e.position = 0 and set_number = 2`)).toBe('warmup')
  await panca.getByRole('button', { name: '+ Aggiungi serie' }).click()
  await expect.poll(() => sql(`select count(*) from public.workout_sets s join public.workout_session_exercises e on e.id = s.session_exercise_id where e.position = 0`)).toBe('4')
  await panca.getByRole('button', { name: /^Togli serie 4/ }).click()
  await expect.poll(() => sql(`select count(*) from public.workout_sets s join public.workout_session_exercises e on e.id = s.session_exercise_id where e.position = 0`)).toBe('3')

  // Salta il secondo esercizio: resta ben visibile.
  const calf = p.getByRole('heading', { name: /^Calf raise/, level: 3 }).locator('xpath=ancestor::li[1]')
  await calf.getByRole('button', { name: 'Saltato' }).click()
  await expect.poll(() => sql(`select status from public.workout_session_exercises where position = 1`)).toBe('skipped')
  await expect(calf.getByText('Saltato', { exact: true }).first()).toBeVisible()

  // Aggiungi un esercizio non previsto.
  await p.getByRole('button', { name: '+ Aggiungi un esercizio' }).click()
  await p.getByLabel('Cerca').fill('lat pulldown')
  await p.getByRole('button', { name: /^Lat machine/ }).first().click()
  await p.getByRole('button', { name: 'Chiudi' }).click()
  await expect.poll(() => sql('select count(*) from public.workout_session_exercises')).toBe('3')

  // Ricarica: tutto com'era.
  await p.reload()
  await p.getByRole('heading', { name: 'Push', level: 1 }).waitFor()
  await expect(p.getByRole('heading', { level: 3 })).toHaveCount(3)
  await expect(p.getByLabel(/^kg serie 1 di Panca/)).toHaveValue('60,5')

  // Termina: l'avviso elenca i saltati e si può terminare lo stesso.
  await p.getByRole('button', { name: 'Termina allenamento' }).click()
  await expect(p.getByRole('region', { name: 'Termina allenamento' })).toContainText('Saltati: Calf raise in piedi con manubri')
  await p.getByRole('button', { name: 'Termina', exact: true }).click()
  await p.getByRole('region', { name: 'Riepilogo' }).waitFor()
  check(sql('select count(*) from public.workout_sessions where ended_at is not null') === '1', 'sessione terminata')
  await expect(p.getByRole('region', { name: 'Riepilogo' })).toContainText('Saltati: Calf raise in piedi con manubri')
  await expect(p.getByRole('region', { name: 'Riepilogo' })).toContainText('1 serie di lavoro')

  // Rinominare l'esercizio non cambia lo storico.
  sql(`insert into public.user_exercises (user_id, catalog_id, name) select ${lit(A())}, catalog_id, 'Nome nuovo' from public.workout_session_exercises where position = 0`)
  check(sql(`select exercise_name from public.workout_session_exercises where position = 0`) === 'Panca piana con manubri', 'l’istantanea non cambia dopo la rinomina')

  // Secondo allenamento: "ultima volta" e serie precompilate.
  await p.goto('http://localhost:4180/palestra/allenamento/nuovo')
  await p.getByRole('button', { name: /^Push Pull/ }).click()
  await p.getByRole('button', { name: /^Push/ }).click()
  await p.getByRole('heading', { name: 'Push', level: 1 }).waitFor()
  await expect(p.getByText('Ultima volta: 1×9 a 60,5 kg')).toBeVisible()
  await expect(p.getByLabel(/^kg serie 3 di Nome nuovo/)).toHaveValue('60,5') // il nome nuovo vale per la sessione nuova, non per la vecchia

  // Con un allenamento in corso non se ne inizia un altro.
  await p.goto('http://localhost:4180/palestra/allenamento/nuovo')
  await p.getByText('Hai già un allenamento in corso').waitFor()
  await p.getByRole('link', { name: 'Riprendi allenamento' }).click()
  await p.getByRole('heading', { name: 'Push', level: 1 }).waitFor()

  // Elimina (due tocchi): l'altro, terminato, resta.
  await p.getByRole('button', { name: 'Elimina questo allenamento' }).click()
  await p.getByRole('button', { name: /^Tocca ancora/ }).click()
  await p.getByRole('heading', { name: 'Palestra', level: 1 }).waitFor()
  check(sql('select count(*) from public.workout_sessions') === '1', 'eliminata solo la sessione in corso')

  // Elenco.
  await p.getByRole('link', { name: /^Allenamenti/ }).click()
  await expect(p.getByRole('link', { name: /Push/ })).toHaveCount(1)
  check(sql(`select count(*) from public.workout_sessions where user_id = ${lit(USERS.b!.id)}`) === '0', 'l’altro utente non ha sessioni')
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`)
  await b.close()
})
