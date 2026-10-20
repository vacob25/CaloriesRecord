import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'

test('Step 14 · porzioni e liquidi in ml', async () => {
  resetDatabase();

  sql("delete from public.recipe_items; delete from public.meal_entries; delete from public.foods");
  seedProfile();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  // Step 17: in Cibi si modifica con la matita; un cibo non preferito né recente si trova con la ricerca.
  const openFood = async (name) => { await p.getByLabel('Cerca nei tuoi cibi').fill(name); await p.getByRole('link', { name: 'Modifica ' + name, exact: true }).click(); };

  // Uovo (valori di prova) con porzione "1 uovo medio" = 50 g
  await p.goto('http://localhost:4180/cibi/nuovo');
  await p.getByLabel('Nome', { exact: true }).fill('Uovo');
  await p.getByLabel(/^Kcal/).fill('128');
  await p.getByLabel('Proteine').fill('12,4'); await p.getByLabel('Carboidrati').fill('0'); await p.getByLabel('Grassi').fill('8,7');
  await p.getByRole('button', { name: '+ Aggiungi porzione' }).click();
  await p.getByLabel('Nome della porzione 1').fill('1 uovo medio');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.getByText('Scrivi la quantità della porzione.').waitFor();
  check(true, 'porzione senza quantità: errore sulla riga, non si salva');
  await p.getByLabel('Quantità della porzione 1 in g').fill('50');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.getByRole('link', { name: 'Nuovo cibo' }).waitFor();
  check(sql("select unit || ' ' || portions::text from public.foods where name='Uovo'") === 'g [{"name": "1 uovo medio", "amount": 50}]', 'salvati unit=g e la porzione nel database');

  // Latte in ml
  await p.getByRole('link', { name: 'Nuovo cibo' }).click();
  await p.getByLabel('Nome', { exact: true }).fill('Latte');
  await p.getByText('Millilitri (ml)').click();
  check(await p.getByText('100 ml', { exact: true }).isVisible(), 'con ml la base diventa "100 ml"');
  await p.getByLabel('Kcal per 100 ml').fill('64');
  await p.getByLabel('Proteine').fill('3,3'); await p.getByLabel('Carboidrati').fill('4,9'); await p.getByLabel('Grassi').fill('3,6');
  await p.getByRole('button', { name: '+ Aggiungi porzione' }).click();
  await p.getByLabel('Nome della porzione 1').fill('1 tazza');
  await p.getByLabel('Quantità della porzione 1 in ml').fill('200');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.getByRole('link', { name: 'Nuovo cibo' }).waitFor();
  await p.getByLabel('Cerca nei tuoi cibi').fill('Latte');
  check((await p.getByRole('link', { name: 'Modifica Latte' }).locator('..').textContent()).includes('per 100 ml'), 'elenco Cibi: "per 100 ml"');

  // ACCETTAZIONE 1: 2 uova medie = 100 g
  await p.goto('http://localhost:4180/aggiungi?pasto=breakfast');
  await p.getByRole('tab', { name: 'I miei cibi' }).click();
  await p.getByRole('button', { name: /^Uovo/ }).click();
  await p.getByRole('button', { name: '1 uovo medio (50 g)' }).click();
  await p.getByRole('button', { name: 'Mezza porzione in più' }).click();
  await p.getByRole('button', { name: 'Mezza porzione in più' }).click();
  const grams = p.getByLabel('Grammi', { exact: true });
  check(await grams.inputValue() === '100', '2 × 1 uovo medio → 100 g nel campo');
  check((await p.getByRole('dialog').textContent()).includes('128 kcal'), 'anteprima 128 kcal');
  await p.getByRole('button', { name: 'Mezza porzione in meno' }).click();
  check(await grams.inputValue() === '75' && (await p.getByRole('dialog').textContent()).includes('1½ × 1 uovo medio'), 'mezza porzione: 1½ → 75 g');
  await p.getByRole('button', { name: 'Mezza porzione in più' }).click();
  await p.getByRole('button', { name: /^Aggiungi a / }).click();
  await p.getByText(/^Aggiunto a /).waitFor();
  check(sql("select grams || ' ' || unit || ' ' || kcal from public.meal_entries where food_name='Uovo'") === '100.0 g 128.0', 'ACCETTAZIONE: "2 uova medie" registra 100 g con 128 kcal');

  // Scrivere a mano azzera la porzione scelta
  await p.goto('http://localhost:4180/aggiungi?pasto=lunch');
  await p.getByRole('tab', { name: 'I miei cibi' }).click();
  await p.getByRole('button', { name: /^Uovo/ }).click();
  await p.getByRole('button', { name: '1 uovo medio (50 g)' }).click();
  await p.getByLabel('Grammi', { exact: true }).fill('60');
  check(await p.getByRole('button', { name: '1 uovo medio (50 g)' }).getAttribute('aria-pressed') === 'false' && !(await p.getByRole('button', { name: 'Mezza porzione in più' }).isVisible()), 'quantità scritta a mano: porzione deselezionata');
  await p.getByRole('button', { name: 'Chiudi' }).click();

  // ACCETTAZIONE 2: latte 200 ml
  await p.goto('http://localhost:4180/aggiungi?pasto=breakfast');
  await p.getByRole('tab', { name: 'I miei cibi' }).click();
  check((await p.getByRole('button', { name: /^Latte/ }).textContent()).includes('kcal/100 ml'), 'Aggiungi pasto: "kcal/100 ml"');
  await p.getByRole('button', { name: /^Latte/ }).click();
  const ml = p.getByLabel('Millilitri', { exact: true });
  await ml.fill('0');
  await p.getByRole('button', { name: /^Aggiungi a / }).click();
  check(await p.getByText('I ml devono essere più di 0.').isVisible(), 'errore in ml');
  await p.getByRole('button', { name: 'Aggiungi 10 ml' }).waitFor();
  await p.getByRole('button', { name: '1 tazza (200 ml)' }).click();
  check(await ml.inputValue() === '200', '1 tazza → 200 ml');
  await p.getByRole('button', { name: /^Aggiungi a / }).click();
  await p.getByText(/^Aggiunto a /).waitFor();
  check(sql("select grams || ' ' || unit || ' ' || kcal || ' ' || protein_g || ' ' || carbs_g || ' ' || fat_g from public.meal_entries where food_name='Latte'") === '200.0 ml 128.0 6.6 9.8 7.2', 'ACCETTAZIONE: latte 200 ml con i valori per 100 ml (128 kcal, P 6,6 C 9,8 G 7,2)');
  await p.goto('http://localhost:4180/');
  await p.getByText('200 ml', { exact: true }).waitFor();
  check(true, 'Oggi mostra "200 ml"');
  await p.getByRole('button', { name: /^Latte/ }).click();
  check(await p.getByLabel('Millilitri', { exact: true }).inputValue() === '200', 'modifica voce: campo in ml');
  await p.screenshot({ path: test.info().outputPath('step14-modifica-ml.png') });
  await p.getByRole('button', { name: 'Chiudi' }).click();

  // Modifica del cibo: la porzione si ricarica e si può togliere
  await p.goto('http://localhost:4180/cibi');
  await openFood('Uovo');
  check(await p.getByLabel('Nome della porzione 1').inputValue() === '1 uovo medio', 'modifica: porzione ricaricata');
  await p.screenshot({ path: test.info().outputPath('step14-cibo.png'), fullPage: true });
  await p.getByRole('button', { name: 'Togli la porzione 1 uovo medio' }).click();
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.getByRole('link', { name: 'Nuovo cibo' }).waitFor();
  check(sql("select portions::text from public.foods where name='Uovo'") === '[]', 'porzione tolta e salvata');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
});
