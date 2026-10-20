import { chromium, test } from '@playwright/test'

import { check, resetDatabase, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';

test('Step 6 · Benvenuto, target del giorno e profilo', async () => {
  resetDatabase();

  sql("delete from public.meal_entries; delete from public.recipe_items; delete from public.foods; delete from public.daily_targets; delete from public.weight_logs; delete from public.profiles");
  const today = sql("select (now() at time zone 'Europe/Rome')::date");
  const yesterday = sql("select (now() at time zone 'Europe/Rome')::date - 1");
  // Un giorno passato già registrato: non deve mai cambiare.
  sql(`insert into public.daily_targets (user_id, target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal) values ('${A}','${yesterday}','rest',3000,140,450,70,2700)`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  // Login senza profilo → Benvenuto
  await p.goto('http://localhost:4180/login');
  await p.getByLabel('Email').fill('utente@example.com');
  await p.getByLabel('Password', { exact: true }).fill('password-di-prova');
  await p.getByRole('button', { name: 'Accedi' }).click();
  await p.getByRole('heading', { name: 'Benvenuto' }).waitFor();
  check(p.url().endsWith('/benvenuto'), 'senza profilo: prima apertura → /benvenuto');

  await p.getByRole('button', { name: 'Avanti' }).click();
  check((await p.locator('p:has-text("⚠︎")').count()) >= 3, 'campi vuoti: errori per sesso, data, altezza, peso');
  await p.getByText('Uomo', { exact: true }).click();
  await p.getByLabel('Data di nascita').fill('2006-01-15');
  await p.getByLabel('Altezza').fill('99');
  await p.getByLabel('Peso di oggi').fill('75');
  await p.getByRole('button', { name: 'Avanti' }).click();
  await p.getByText('L’altezza deve essere tra 100 e 250 cm.').waitFor();
  check(sql("select count(*) from public.profiles") === '0', 'altezza 99 cm rifiutata, niente salvato');
  await p.getByLabel('Altezza').fill('180');
  await p.screenshot({ path: test.info().outputPath('step6-benvenuto.png'), fullPage: true });
  await p.getByRole('button', { name: 'Avanti' }).click();
  await p.getByText('Mettere massa').click();
  await p.getByRole('button', { name: 'Avanti' }).click();
  await p.getByText('Medio', { exact: true }).click();
  await p.getByLabel('Nome dello sport').fill('Palestra');
  await p.getByRole('button', { name: 'Aggiungi' }).click();
  await p.getByLabel('Nome dello sport').fill('Calcio');
  await p.getByRole('button', { name: 'Aggiungi' }).click();
  await p.getByRole('button', { name: 'Inizia' }).click();
  await p.getByRole('heading', { name: 'Oggi', exact: true, level: 1 }).waitFor();
  check(sql("select sex||' '||birth_date||' '||height_cm||' '||activity_factor||' '||surplus_pct||' '||goal from public.profiles") === 'male 2006-01-15 180.0 1.550 0.100 bulk', 'profilo creato dal wizard (bulk, attività media)');
  // I numeri di accettazione sono del profilo con fattore 1,6: lo imposto, segno il tutorial come visto e ricalcolo.
  await p.getByRole('region', { name: 'Riepilogo del giorno' }).getByText('Obiettivo').waitFor();
  await p.waitForTimeout(800);
  sql(`update public.profiles set activity_factor = 1.6, tutorial_done_at = now(); delete from public.daily_targets`);
  await p.reload();
  await p.getByRole('heading', { name: 'Oggi', exact: true, level: 1 }).waitFor();
  await p.getByRole('region', { name: 'Riepilogo del giorno' }).waitFor();
  sql(`insert into public.daily_targets (user_id, target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal) values ('${A}','${yesterday}','rest',3000,140,450,70,2700)`);
  check(sql(`select weight_kg from public.weight_logs where log_date='${today}'`) === '75.0', 'peso di oggi salvato come prima pesata');

  // ACCETTAZIONE: target 3130 e macro 150/75/464
  const card = p.getByRole('region', { name: 'Riepilogo del giorno' });
  await card.waitFor();
  const cardText = (await card.textContent()).replace(/\s+/g, ' ');
  check(cardText.includes('3.130 kcal') && cardText.includes('/ 150 g') && cardText.includes('/ 464 g') && cardText.includes('/ 75 g'), 'ACCETTAZIONE: riposo → 3130 kcal, P 150, C 464, G 75');
  check(sql(`select training_type||' '||target_kcal||' '||protein_g||' '||carbs_g||' '||fat_g||' '||maintenance_kcal from public.daily_targets where target_date='${today}'`) === 'rest 3130 150 464 75 2848', 'daily_targets di oggi creato: mantenimento 2848');
  check(/3\.130\s*kcal restanti/.test(cardText), 'anello: 3.130 kcal restanti (punto delle migliaia in italiano)');
  await p.screenshot({ path: test.info().outputPath('step6-oggi-riposo.png'), fullPage: true });

  // Tipo di giorno → Calcio
  await p.getByRole('button', { name: /Giorno: Riposo/ }).click();
  await p.getByRole('button', { name: 'Calcio', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Calcio/ }).waitFor();
  const calcio = (await card.textContent()).replace(/\s+/g, ' ');
  check(calcio.includes('3.580 kcal') && calcio.includes('/ 576 g'), 'ACCETTAZIONE: calcio (450 kcal a 75 kg) → 3580 kcal, C 576');
  check(sql(`select target_kcal||' '||carbs_g from public.daily_targets where target_date='${today}'`) === '3580 576', 'cambio tipo di giorno: aggiorna solo la riga di oggi');

  // ACCETTAZIONE: oltre il target
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) values ('${A}','${today}','dinner','Cena abbondante',1000,3700,150,400,120)`);
  await p.reload();
  await card.waitFor();
  const over = (await card.textContent()).replace(/\s+/g, ' ');
  check(/oltre di\s*120\s*kcal/.test(over) && !over.includes('-120'), 'ACCETTAZIONE: oltre il target l’anello dice "oltre di 120 kcal", nessun negativo');
  await p.screenshot({ path: test.info().outputPath('step6-oltre.png'), fullPage: true });

  // ACCETTAZIONE: cambiare un parametro non modifica i giorni passati
  await p.getByRole('link', { name: 'Profilo', exact: true }).click();
  await p.getByLabel('Surplus').fill('15');
  await p.getByRole('button', { name: 'Salva parametri' }).click();
  await p.getByText('Salvato. Vale da oggi').waitFor();
  check(sql("select surplus_pct from public.profiles") === '0.150', 'surplus salvato (15% → 0,150)');
  check(sql(`select target_kcal from public.daily_targets where target_date='${yesterday}'`) === '3000', 'ACCETTAZIONE: il giorno passato resta 3000 kcal');
  check(sql(`select target_kcal from public.daily_targets where target_date='${today}'`) === '3730', 'oggi ricalcolato: 2848 · 1,15 + 450 = 3725,2 → 3730 (tipo calcio mantenuto)');

  // Avviso surplus > 20%
  await p.getByLabel('Surplus').fill('25');
  await p.getByRole('button', { name: 'Salva parametri' }).click();
  await p.getByText(/Surplus oltre il 20%/).waitFor();
  check(true, 'surplus 25%: avviso (non blocco)');

  // Avviso carboidrati bassi
  await p.getByLabel('Surplus').fill('10');
  await p.getByLabel('Proteine').fill('7');
  await p.getByRole('button', { name: 'Salva parametri' }).click();
  await p.getByText('Salvato. Vale da oggi').waitFor();
  await p.getByRole('link', { name: 'Oggi' }).click();
  await p.getByText(/carboidrati sotto 3 g per kg/).waitFor();
  check(true, 'proteine 7 g/kg → carboidrati < 3 g/kg: avviso in Oggi');

  // Dati personali: modifica altezza
  await p.getByRole('link', { name: 'Profilo', exact: true }).click();
  await p.getByLabel('Altezza').fill('181');
  await p.getByRole('button', { name: 'Salva dati personali' }).click();
  await p.getByText('Salvato. Vale da oggi').first().waitFor();
  check(sql("select height_cm from public.profiles") === '181.0', 'dati personali aggiornati');
  await p.screenshot({ path: test.info().outputPath('step6-profilo.png'), fullPage: true });

  // Peso: pill e salto > 2 kg
  await p.getByRole('link', { name: 'Oggi' }).click();
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}','${yesterday}',75) on conflict do nothing`);
  await p.reload();
  await p.getByRole('button', { name: '75 kg' }).click();
  await p.getByLabel('Peso', { exact: true }).fill('78');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.getByText(/più di 2 kg di differenza da ieri/).waitFor();
  check(sql(`select weight_kg from public.weight_logs where log_date='${today}'`) === '75.0', 'salto > 2 kg: chiede conferma, non salva subito');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.getByRole('button', { name: '78 kg' }).waitFor();
  check(sql(`select count(*)||' '||max(weight_kg) from public.weight_logs where log_date='${today}'`) === '1 78.0', 'seconda pesata dello stesso giorno sostituisce la prima');

  // Utente B senza profilo
  await p.getByRole('link', { name: 'Profilo', exact: true }).click();
  await p.getByRole('button', { name: 'Esci' }).click();
  await p.waitForURL('**/login');
  await p.getByLabel('Email').fill('altro@example.com');
  await p.getByLabel('Password', { exact: true }).fill('password-di-prova');
  await p.getByRole('button', { name: 'Accedi' }).click();
  await p.getByRole('heading', { name: 'Benvenuto' }).waitFor();
  check(true, 'utente B: non vede il profilo di A, va a /benvenuto');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
