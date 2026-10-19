import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
const T = "(now() at time zone 'Europe/Rome')::date";
// Step 17: catalogo a riquadri con stelle, Cibi con Preferiti e Alimenti recenti (8), promemoria del peso giornaliero, Snack/Spuntino.

test('Step 17 · promemoria, catalogo a riquadri, cibi', async () => {
  resetDatabase();

  sql("delete from public.recipe_items; delete from public.meal_entries; delete from public.foods");
  seedProfile();
  sql(`delete from public.weight_logs; insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}', ${T} - 1, 75)`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);

  // Promemoria del peso: in cima, ieri sì e oggi no → compare; pesata di oggi → sparisce
  const reminder = p.getByRole('region', { name: 'Promemoria peso' });
  await reminder.waitFor();
  const first = await p.locator('[data-day-swipe] > header + *').first().getAttribute('aria-label');
  check(first === 'Promemoria peso', 'RICHIESTA: promemoria del peso in cima a Oggi (subito sotto l’intestazione)');
  check((await reminder.textContent()).includes('Ultima pesata: ieri'), 'promemoria giornaliero: ultima pesata ieri');
  await p.screenshot({ path: test.info().outputPath('step17-promemoria.png') });
  await reminder.getByRole('button', { name: 'Registra peso' }).click();
  await p.getByLabel('Peso', { exact: true }).fill('75,2');
  await p.getByRole('dialog').getByRole('button', { name: 'Salva' }).click();
  await reminder.waitFor({ state: 'detached', timeout: 8000 });
  check(true, 'pesata di oggi registrata: il promemoria sparisce');

  // Catalogo a riquadri
  await p.goto('http://localhost:4180/aggiungi?pasto=morning_snack');
  await p.getByRole('heading', { name: 'Aggiungi a snack' }).waitFor();
  check(await p.getByRole('radio', { name: 'Snack' }).isChecked(), 'RICHIESTA: nuovo pasto "Snack" tra colazione e pranzo');
  await p.getByRole('tab', { name: 'Catalogo' }).click();
  const tiles = p.getByRole('region', { name: 'Catalogo degli ingredienti' }).getByRole('button');
  await tiles.first().waitFor();
  check(await tiles.count() === 13, 'RICHIESTA: 13 categorie a riquadri con icona');
  await p.screenshot({ path: test.info().outputPath('step17-categorie.png') });
  await p.getByRole('button', { name: /^Uova/ }).click();
  const uova = p.getByRole('region', { name: 'Catalogo: Uova' });
  await uova.waitFor();
  const before = await uova.getByRole('listitem').allTextContents();
  check(before[0].startsWith('Uovo di gallina, albume'), 'categoria Uova: ordine di partenza (albume primo)');
  await uova.getByRole('button', { name: 'Aggiungi Uovo di gallina, tuorlo ai preferiti' }).click();
  await uova.getByRole('button', { name: 'Togli Uovo di gallina, tuorlo dai preferiti' }).waitFor();
  const after = await uova.getByRole('listitem').allTextContents();
  check(after[0].startsWith('Uovo di gallina, tuorlo'), 'RICHIESTA: la voce con la stella sale in cima alla categoria');
  check(sql("select is_favorite from public.foods where name = 'Uovo di gallina, tuorlo'") === 't', 'la stella copia la voce tra i propri cibi come preferita');
  await p.screenshot({ path: test.info().outputPath('step17-uova.png') });
  await uova.getByRole('button', { name: /^Uovo di gallina, intero/ }).click();
  await p.getByRole('button', { name: /^Aggiungi a / }).click();
  await p.getByText(/^Aggiunto a /).waitFor();
  check(sql("select meal_type from public.meal_entries") === 'morning_snack', 'voce registrata nello Snack (morning_snack)');
  await p.getByRole('region', { name: 'Snack' }).waitFor();
  check(await p.getByRole('region', { name: 'Spuntino' }).count() === 0 && (await p.getByText('Spuntino').count()) === 1, 'Oggi: "Snack" con la voce, "Spuntino" vuoto');

  // Cibi: Preferiti con matita, Alimenti recenti al massimo 8
  for (let i = 1; i <= 10; i++) {
    sql(`insert into public.foods (user_id, name, source, kcal_100g, protein_100g, carbs_100g, fat_100g, last_used_at) values ('${A}', 'Cibo ${String(i).padStart(2, '0')}', 'manual', 100, 10, 10, 2, now() - interval '${i} hours')`);
  }
  await p.goto('http://localhost:4180/cibi');
  const fav = p.getByRole('region', { name: 'Preferiti' });
  await fav.waitFor();
  check((await fav.textContent()).includes('Uovo di gallina, tuorlo') && await fav.getByRole('link', { name: 'Modifica Uovo di gallina, tuorlo' }).isVisible(), 'RICHIESTA: in Cibi i preferiti, con la matita per modificare');
  const recent = p.getByRole('region', { name: 'Alimenti recenti' });
  check(await recent.getByRole('listitem').count() === 8, 'RICHIESTA: "Alimenti recenti" al massimo 8');
  check((await recent.getByRole('listitem').first().textContent()).startsWith('Uovo di gallina, intero'), 'il più recente per primo');
  check(await p.getByRole('link', { name: 'Nuovo cibo' }).isVisible() && await p.getByRole('link', { name: 'Nuova ricetta' }).isVisible(), 'i due pulsanti in alto restano');
  await p.screenshot({ path: test.info().outputPath('step17-cibi.png'), fullPage: true });
  await fav.getByRole('link', { name: 'Modifica Uovo di gallina, tuorlo' }).click();
  await p.getByRole('heading', { name: 'Modifica cibo' }).waitFor();
  check(true, 'la matita apre la pagina del cibo (porzione abituale, porzioni…)');
  await p.goBack();
  await p.getByRole('button', { name: /Tutti i tuoi cibi \(12\)/ }).click();
  check(await p.getByRole('region', { name: 'Tutti i tuoi cibi' }).getByRole('listitem').count() === 12, '"Tutti i tuoi cibi": l’elenco completo resta raggiungibile');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await b.close();
});
