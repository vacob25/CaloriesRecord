import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
const T = "(now() at time zone 'Europe/Rome')::date";

test('Revisione dell’8/10 · correzioni dell’app', async () => {
  resetDatabase();

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  // 1) Ricalibrazione accettata nel Profilo, poi "Salva parametri": il nuovo fattore NON si perde.
  sql("delete from public.tdee_estimates; delete from public.water_entries; delete from public.recipe_items; delete from public.meal_entries; delete from public.foods; delete from public.daily_targets; delete from public.weight_logs; delete from public.profiles");
  sql(`insert into public.profiles (user_id, sports, tutorial_done_at, sex, birth_date, height_cm)values ('${A}',jsonb_build_array('Palestra','Calcio'), now(),'male','2006-01-15',180)`);
  sql(`insert into public.daily_targets (user_id, target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal) select '${A}', ${T} - g, 'rest', 3130, 150, 464, 75, 2848 from generate_series(1, 28) g`);
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) select '${A}', ${T} - g, 'lunch', 'Pasta', 500, 3200, 150, 460, 75 from generate_series(1, 28) g`);
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) select '${A}', ${T} - g, round((75 + (28 - g) * 0.1 / 7)::numeric, 1) from generate_series(0, 28) g`);
  await login(p);
  await p.goto('http://localhost:4180/profilo');
  const card = p.getByRole('region', { name: 'Ricalibrazione' });
  await card.getByRole('button', { name: 'Accetta' }).click();
  await card.getByText(/accettata: vale da domani/).waitFor();
  const accepted = sql('select activity_factor from public.profiles');
  await p.waitForFunction((v) => document.getElementById('activityFactor')?.value === v, accepted.replace(/0+$/, '').replace('.', ','), { timeout: 5000 });
  check(true, `dopo "Accetta" il campo fattore mostra il nuovo valore (${accepted})`);
  await p.getByLabel('Bonus per gli altri sport').fill('250');
  await p.getByRole('button', { name: 'Salva parametri' }).click();
  await p.getByText('Salvato. Vale da oggi').first().waitFor();
  check(sql('select activity_factor || \' \' || training_bonus_kcal from public.profiles') === `${accepted} 250`, 'BUG RISOLTO: "Salva parametri" dopo la ricalibrazione tiene il fattore accettato');
  check((await p.getByLabel('Bonus per gli altri sport').inputValue()) === '250', 'il modulo non viene riscritto dal profilo ricaricato');

  // 2) Avviso §2: ritmo stimato oltre 0,5 kg/settimana
  await p.getByLabel('Surplus').fill('20');
  await p.getByRole('button', { name: 'Salva parametri' }).click();
  await p.getByText(/ritmo stimato è circa \+0,\d+ kg\/settimana/).waitFor();
  check(true, '§2: avviso sul ritmo stimato oltre +0,5 kg/settimana');

  // 3) Nuovo utente: Aggiungi pasto si apre sul Catalogo; cercando non compare "Non hai ancora nessun cibo"
  sql("delete from public.meal_entries; delete from public.foods");
  await p.goto('http://localhost:4180/aggiungi?pasto=lunch');
  await p.getByRole('tab', { name: 'Catalogo' }).waitFor();
  check(await p.getByRole('tab', { name: 'Catalogo' }).getAttribute('aria-selected') === 'true', 'senza cibi propri si apre il Catalogo');
  await p.getByLabel('Cerca un cibo').fill('riso');
  await p.getByRole('heading', { name: 'Dal catalogo' }).waitFor();
  check(!(await p.getByText('Non hai ancora nessun cibo').isVisible()), 'cercando: niente messaggio "nessun cibo" fuorviante');

  // 4) Catalogo in una ricetta: l'ingrediente scelto diventa un proprio cibo e la sua porzione è proposta
  await p.goto('http://localhost:4180/cibi/ricette/nuova');
  // In una ricetta nuova la ricerca è già aperta; il pulsante c'è solo dopo averla chiusa.
  const addIngredient = p.getByRole('button', { name: '+ Aggiungi ingrediente' });
  if (await addIngredient.isVisible()) await addIngredient.click();
  await p.getByLabel('Cerca un ingrediente').fill('pasta di semola cruda');
  await p.getByRole('button', { name: /^Pasta di semola, cruda/ }).click();
  const grams = p.getByLabel('Grammi di Pasta di semola, cruda');
  await grams.waitFor();
  check(await grams.inputValue() === '80', 'ingrediente dal catalogo: proposta la porzione CREA (80 g)');
  check(sql("select count(*) from public.foods where name = 'Pasta di semola, cruda'") === '1', 'la voce del catalogo è stata copiata tra i propri cibi');
  // scelta di nuovo con maiuscole diverse nel nome già salvato: nessun doppione
  sql("update public.foods set name = 'PASTA DI SEMOLA, CRUDA' where name = 'Pasta di semola, cruda'");
  await p.goto('http://localhost:4180/aggiungi?pasto=lunch');
  await p.getByRole('tab', { name: 'Catalogo' }).click();
  await p.getByRole('button', { name: /^Cereali e derivati/ }).click();
  await p.getByRole('button', { name: /^Pasta di semola, cruda/ }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Chiudi' }).click();
  check(sql("select count(*) from public.foods where lower(name) = 'pasta di semola, cruda'") === '1', 'nessun doppione anche con maiuscole diverse');

  // 5) Uovo dal catalogo: senza storia si apre con 1 porzione già scelta
  await p.getByLabel('Cerca un cibo').fill('uovo intero');
  await p.getByRole('button', { name: /^Uovo di gallina, intero/ }).last().click();
  check(await p.getByLabel('Grammi', { exact: true }).inputValue() === '50' && (await p.getByRole('button', { name: 'Porzione CREA (50 g)' }).getAttribute('aria-pressed')) === 'true', 'senza storia: 1 porzione già selezionata (50 g)');
  await p.getByRole('button', { name: 'Mezza porzione in più' }).click();
  await p.getByRole('button', { name: 'Mezza porzione in più' }).click();
  await p.getByRole('button', { name: /^Aggiungi a / }).click();
  await p.getByText(/^Aggiunto a /).waitFor();
  // modifica della voce: le porzioni del cibo sono disponibili
  await p.getByRole('button', { name: /^Uovo di gallina, intero/ }).click();
  check(await p.getByRole('button', { name: 'Porzione CREA (50 g)' }).isVisible(), 'modifica voce: porzioni disponibili');
  await p.getByRole('dialog').getByRole('button', { name: 'Chiudi' }).click();
  await p.getByRole('dialog').waitFor({ state: 'detached', timeout: 3000 });
  check(true, 'BUG RISOLTO: voce appena aggiunta, avviso ancora visibile → il pannello si chiude e l’app risponde');

  // 6) Statistiche → Peso → indietro torna a Statistiche
  await p.getByRole('link', { name: 'Statistiche' }).click();
  await p.getByRole('link', { name: /^Peso/ }).click();
  await p.getByRole('heading', { name: 'Peso', exact: true }).waitFor();
  await p.getByRole('link', { name: /Indietro|Torna/ }).first().click();
  await p.getByRole('heading', { name: 'Statistiche' }).waitFor();
  check(true, 'Peso aperto da Statistiche: la freccia torna a Statistiche');

  // 7) Quantità quasi zero: errore nel modulo, nessuna chiamata che fallisce nel database
  await p.goto('http://localhost:4180/aggiungi?pasto=lunch');
  await p.getByRole('tab', { name: 'I miei cibi' }).click();
  await p.getByRole('button', { name: /^Uovo di gallina, intero/ }).click();
  await p.getByLabel('Grammi', { exact: true }).fill('0,04');
  await p.getByRole('button', { name: /^Aggiungi a / }).click();
  check(await p.getByText('I grammi devono essere più di 0.').isVisible(), '0,04 g: errore chiaro nel modulo');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await b.close();
});
