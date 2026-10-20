import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
// Step 21: fino a 4 sport con giorni a più sport; voci trascinate tra i pasti.

test('Step 21-22 · più sport e voci trascinabili', async () => {
  resetDatabase();

  sql("delete from public.meal_entries; delete from public.daily_targets; delete from public.weight_logs; delete from public.meal_slots");
  seedProfile();
  sql(`insert into public.meal_slots (user_id, slot_key, name, position) values ('${A}','breakfast','Colazione',0),('${A}','morning_snack','Snack',1),('${A}','lunch','Pranzo',2),('${A}','dinner','Cena',3),('${A}','snack','Spuntino',4) on conflict do nothing`);
  sql(`update public.profiles set sports = '["Palestra","Calcio","Nuoto"]'::jsonb`);
  const today = sql("select (now() at time zone 'Europe/Rome')::date");
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}','${today}',75) on conflict do nothing`);
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) values ('${A}','${today}','breakfast','Yogurt di prova',150,100,8,10,3),('${A}','${today}','breakfast','Pane di prova',50,130,4,26,1)`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  const training = () => sql("select training_type from public.daily_targets order by target_date desc limit 1");

  // ─── Sport multipli ───
  await p.getByRole('button', { name: /Giorno:/ }).click();
  for (const name of ['Riposo', 'Palestra', 'Calcio', 'Nuoto']) {
    check(await p.getByRole('button', { name, exact: true }).count() === 1, `scelta "${name}"`);
  }
  await p.getByRole('button', { name: 'Palestra', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Palestra ▴/ }).waitFor();
  await p.getByRole('button', { name: 'Nuoto', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Palestra \+ nuoto/ }).waitFor();
  check(training() === 'sport_1+sport_3', 'Palestra poi Nuoto → sport_1+sport_3 (combinazione creata dai tocchi)');
  await p.getByText('Bonus di oggi: +481 kcal (Palestra 281 + Nuoto 200)').waitFor();
  check(true, 'si vede il bonus del giorno: Palestra 281 (tabella, 75 kg) + Nuoto 200 (riserva) = 481');
  await p.getByRole('button', { name: 'Calcio', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Palestra \+ calcio \+ nuoto/ }).waitFor();
  check(training() === 'sport_1+sport_2+sport_3', 'tre sport insieme');
  check(await p.getByRole('button', { name: 'Calcio', exact: true }).getAttribute('aria-pressed') === 'true', 'gli sport scelti risultano premuti');
  await p.getByRole('button', { name: 'Palestra', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Calcio \+ nuoto/ }).waitFor();
  check(training() === 'sport_2+sport_3', 'toccare di nuovo uno sport lo toglie');
  const kcal = sql("select target_kcal from public.daily_targets order by target_date desc limit 1");
  await p.getByText('Bonus di oggi: +650 kcal (Calcio 450 + Nuoto 200)').waitFor();
  await p.getByRole('button', { name: 'Riposo', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Riposo/ }).waitFor();
  check(training() === 'rest' && Math.abs(Number(kcal) - Number(sql("select target_kcal from public.daily_targets order by target_date desc limit 1")) - 650) <= 10, 'Riposo toglie tutto: il target scende della somma (Calcio 450 + Nuoto 200 = 650)');

  // ─── Fino a 4 sport nel profilo ───
  await p.getByRole('link', { name: 'Profilo', exact: true }).click();
  const goal = p.locator('[data-tour="profile-goal"]');
  await goal.waitFor();
  await goal.getByLabel('Nome dello sport').fill('Corsa');
  await goal.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await goal.getByRole('button', { name: 'Togli Corsa' }).waitFor();
  check(await goal.getByLabel('Nome dello sport').isDisabled(), 'con 4 sport non se ne aggiungono altri');
  await p.getByRole('button', { name: 'Salva obiettivo e sport' }).click();
  await p.getByText('Salvato. Vale da oggi').first().waitFor();
  check(sql("select jsonb_array_length(sports) from public.profiles") === '4', 'salvati 4 sport');
  let rejected = false;
  try { sql(`update public.profiles set sports = '["a","b","c","d","e"]'::jsonb`); } catch { rejected = true; }
  check(rejected, 'il database rifiuta il quinto sport');
  let badType = false;
  try { sql(`update public.daily_targets set training_type = 'sport_5'`); } catch { badType = true; }
  check(badType, 'il database rifiuta tipi di giorno non validi');

  // ─── Trascinare una voce in un altro pasto ───
  await p.getByRole('link', { name: 'Oggi', exact: true }).click();
  await p.getByRole('region', { name: 'Colazione' }).waitFor();
  const entry = (name) => p.getByRole('region', { name: 'Colazione' }).getByRole('listitem').filter({ hasText: name });
  const centerOf = async (loc) => { const bx = await loc.boundingBox(); return { x: bx.x + bx.width / 2, y: bx.y + bx.height / 2, bx }; };
  const hold = async (name) => { const c = await centerOf(entry(name)); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.waitForTimeout(500); return c; };
  const moveTo = async (x, y) => { await p.mouse.move(x, y, { steps: 10 }); };

  // 1) tocco veloce: apre la modifica, non sposta
  await entry('Yogurt di prova').click();
  await p.getByRole('dialog').waitFor();
  check(true, 'tocco veloce su una voce: si apre la modifica');
  await p.getByRole('button', { name: 'Chiudi' }).click();
  // 2) tenere premuto: si solleva
  await hold('Yogurt di prova');
  check(await p.locator('li[data-entry-id][style*="scale"]').count() === 1, 'tenendo premuto la voce si solleva');
  // 3) trascinare su Pranzo (pasto vuoto, riquadro tratteggiato): si evidenzia
  const pranzo = await centerOf(p.getByRole('link', { name: /Pranzo/ }));
  await moveTo(pranzo.x, pranzo.y);
  await p.waitForTimeout(150);
  check(await p.locator('[data-meal-key="lunch"].border-green').count() === 1, 'il pasto sotto il dito si evidenzia');
  await p.screenshot({ path: test.info().outputPath('step21-trascina-voce.png'), fullPage: false });
  await p.mouse.up();
  await p.getByRole('region', { name: 'Pranzo' }).getByText('Yogurt di prova').waitFor();
  check(sql("select meal_type from public.meal_entries where food_name = 'Yogurt di prova'") === 'lunch', 'ACCETTAZIONE: la voce è passata da Colazione a Pranzo');
  check(sql("select grams||' '||kcal from public.meal_entries where food_name = 'Yogurt di prova'") === '150.0 100.0', 'grammi e calorie invariati');
  check(await p.getByRole('region', { name: 'Colazione' }).getByText('Pane di prova').isVisible(), 'l’altra voce resta in Colazione');
  check(await p.getByRole('dialog').count() === 0, 'dopo il trascinamento non si apre la modifica');
  // 4) trascinare su un pasto che ha già voci (Colazione → Pranzo con card piena)
  await hold('Pane di prova');
  const lunchCard = await centerOf(p.getByRole('region', { name: 'Pranzo' }));
  await moveTo(lunchCard.x, lunchCard.y);
  await p.mouse.up();
  await p.getByRole('region', { name: 'Pranzo' }).getByText('Pane di prova').waitFor();
  check(sql("select string_agg(meal_type, ',' order by food_name) from public.meal_entries") === 'lunch,lunch', 'anche su un pasto che ha già voci');
  await p.getByRole('link', { name: /Colazione/ }).waitFor();
  check(true, 'Colazione, ora vuota, torna al riquadro tratteggiato');
  // 5) rilasciare fuori da un pasto: torna al suo posto
  const lunchEntry = p.getByRole('region', { name: 'Pranzo' }).getByRole('listitem').filter({ hasText: 'Pane di prova' });
  await p.mouse.up();
  await p.waitForTimeout(100);
  const c4 = await centerOf(lunchEntry);
  await p.mouse.move(c4.x, c4.y);
  await p.mouse.down();
  await p.waitForTimeout(500);
  await p.mouse.move(c4.x, 60, { steps: 10 }); // sull'intestazione
  await p.mouse.up();
  await p.waitForTimeout(400);
  check(sql("select meal_type from public.meal_entries where food_name = 'Pane di prova'") === 'lunch', 'rilasciata fuori da un pasto: resta dov’era');
  // 6) rilasciare sul proprio pasto: niente cambia
  const c5 = await centerOf(lunchEntry);
  await p.mouse.move(c5.x, c5.y);
  await p.mouse.down();
  await p.waitForTimeout(500);
  await p.mouse.move(c5.x + 5, c5.y + 20, { steps: 4 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  check(sql("select meal_type from public.meal_entries where food_name = 'Pane di prova'") === 'lunch', 'rilasciata sul proprio pasto: resta dov’era');
  // 7) un movimento prima del tempo non sposta niente
  const c6 = await centerOf(lunchEntry);
  await p.mouse.move(c6.x, c6.y);
  await p.mouse.down();
  await p.mouse.move(c6.x, c6.y - 200, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  check(sql("select count(*) from public.meal_entries where meal_type = 'lunch'") === '2', 'movimento prima del tempo: non sposta');
  check(!(await p.evaluate(() => document.body.hasAttribute('data-entry-dragging'))), 'a fine trascinamento lo swipe tra i giorni è di nuovo attivo');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
