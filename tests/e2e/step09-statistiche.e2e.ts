import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';

test('Step 9 · statistiche', async () => {
  resetDatabase();

  seedProfile();
  sql("delete from public.meal_entries; delete from public.daily_targets");
  // Settimana scorsa (lun-dom) rispetto a oggi a Roma.
  const monday = sql("select (date_trunc('week', (now() at time zone 'Europe/Rome')::date) - interval '7 days')::date");
  const day = (i) => sql(`select ('${monday}'::date + ${i})::text`);
  // Target 3000 tutti i giorni; kcal: 3000, 2900, 3100, 3200, 3300 (rispettati), 2000 (sotto), domenica nessuna voce.
  const kcal = [3000, 2900, 3100, 3200, 3300, 2000];
  for (let i = 0; i < 7; i++) sql(`insert into public.daily_targets (user_id, target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal) values ('${A}','${day(i)}','rest',3000,150,400,75,2700)`);
  kcal.forEach((k, i) => {
    sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) values ('${A}','${day(i)}','lunch','Pasta',300,${k - 500},20,100,10), ('${A}','${day(i)}','breakfast','${i < 2 ? 'Biscotti' : 'Yogurt'}',100,500,10,50,5)`);
  });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);

  await p.getByRole('link', { name: 'Statistiche' }).click();
  await p.getByRole('heading', { name: 'Statistiche' }).waitFor();
  // Settimana attuale: nessuna voce → stato vuoto
  await p.getByText(/Nessun giorno registrato in questo periodo/).waitFor();
  check((await p.locator('.recharts-wrapper').count()) === 0, 'ACCETTAZIONE: periodo vuoto → stato vuoto, nessun grafico a zero');

  await p.getByRole('button', { name: 'Periodo precedente' }).click();
  await p.getByText('Media giornaliera').waitFor();
  const numbers = (await p.locator('dl').first().textContent()).replace(/\s+/g, ' ');
  // Media dei 6 giorni registrati: 17500 / 6 = 2916,7 → "2.917"
  check(/2\.917\s*kcal/.test(numbers) && numbers.includes('su 6 giorni registrati'), 'ACCETTAZIONE: media = 17500 / 6 = 2.917 kcal (domenica non registrata esclusa)');
  check(numbers.includes('5 su 6'), 'ACCETTAZIONE: giorni rispettati 5 su 6');
  check((await p.locator('.recharts-bar-rectangle').count()) >= 6, 'grafico a barre con i giorni registrati');

  await p.getByText('Vedi i giorni in tabella').click();
  const rows = await p.locator('tbody tr').allTextContents();
  check(rows.length === 7 && rows[5].includes('Sotto target') && rows[6].includes('Non registrato') && rows[0].includes('Rispettato'), 'tabella dei giorni con lo stato scritto (alternativa ai colori)');

  const meals = (await p.getByRole('region', { name: 'Calorie per pasto' }).textContent()).replace(/\s+/g, ' ');
  // Colazione 6 × 500 = 3000 su 17500 = 17%; Pranzo 14500 = 83%
  check(/Colazione\s*17%/.test(meals) && /Pranzo\s*83%/.test(meals), 'distribuzione per pasto: colazione 17%, pranzo 83%');
  check(/P 30 g · C 150 g · G 15 g/.test(meals), 'macro medie al giorno: (20+10) / (100+50) / (10+5) = 30/150/15');
  const foods = await p.getByRole('region', { name: 'Cibi più frequenti' }).locator('li').allTextContents();
  check(foods[0].includes('Pasta') && foods[0].includes('6 volte') && foods[1].includes('Yogurt') && foods[1].includes('4 volte') && foods[2].includes('Biscotti'), 'cibi più frequenti per numero di voci: Pasta 6, Yogurt 4, Biscotti 2');
  await p.screenshot({ path: test.info().outputPath('step9-settimana.png'), fullPage: true });

  await p.getByRole('button', { name: 'Mese' }).click();
  await p.waitForTimeout(800);
  check(await p.getByRole('button', { name: 'Mese' }).getAttribute('aria-pressed') === 'true', 'vista mese selezionabile');
  check(await p.getByRole('button', { name: 'Periodo successivo' }).isDisabled(), 'non si va oltre il periodo attuale');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
