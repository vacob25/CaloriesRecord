import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'

test('Step 5 · aggiungi pasto e modifica delle voci', async () => {
  resetDatabase();

  seedProfile();
  sql("delete from public.meal_entries; delete from public.recipe_items; delete from public.foods");
  sql("insert into public.foods (user_id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, serving_g) values ('00000000-0000-0000-0000-00000000000a','Pasta',350,12,72,1.5,null), ('00000000-0000-0000-0000-00000000000a','Yogurt',60,4,5,2.5,125)");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  // Step 17: in Cibi si modifica con la matita; un cibo non preferito né recente si trova con la ricerca.
  const openFood = async (name) => { await p.getByLabel('Cerca nei tuoi cibi').fill(name); await p.getByRole('link', { name: 'Modifica ' + name, exact: true }).click(); };

  await p.getByRole('link', { name: /Colazione/ }).waitFor();
  check((await p.locator('a', { hasText: '+ Aggiungi' }).count()) === 5, 'Oggi vuoto: 5 card tratteggiate "+ Aggiungi" (step 17: Snack e Spuntino)');
  await p.screenshot({ path: test.info().outputPath('step5-vuoto.png'), fullPage: true });

  // Prima registrazione da Pranzo
  await p.getByRole('link', { name: /Pranzo/ }).click();
  await p.getByRole('heading', { name: 'Aggiungi a pranzo' }).waitFor();
  check(await p.getByRole('tab', { name: 'I miei cibi' }).getAttribute('aria-selected') === 'true', 'senza recenti si apre "I miei cibi"');
  await p.getByRole('button', { name: /^Pasta/ }).click();
  const grams = p.getByLabel('Grammi', { exact: true });
  check(await grams.inputValue() === '100', 'cibo mai usato e senza porzione: 100 g proposti');
  await p.getByRole('button', { name: 'Aggiungi 10 grammi' }).click();
  check(await grams.inputValue() === '110', '+ → 110 g');
  await p.getByRole('button', { name: 'Togli 10 grammi' }).click();
  check((await p.getByRole('dialog').textContent()).includes('350 kcal'), 'anteprima 350 kcal per 100 g');
  await p.screenshot({ path: test.info().outputPath('step5-pannello.png') });
  await p.getByRole('button', { name: 'Aggiungi a pranzo' }).click();
  await p.getByText('Aggiunto a pranzo').waitFor();
  check(sql("select meal_type||' '||food_name||' '||grams||' '||kcal||' '||entry_date from public.meal_entries") === `lunch Pasta 100.0 350.0 ${sql("select (now() at time zone 'Europe/Rome')::date")}`, 'voce salvata con snapshot e giorno locale di Roma');
  check(sql("select last_used_at is not null from public.foods where name='Pasta'") === 't', 'last_used_at aggiornato');

  // ACCETTAZIONE: cibo recente in al massimo 3 tocchi
  await p.waitForTimeout(300);
  let taps = 0;
  await p.getByRole('link', { name: /Aggiungi/ }).first().click(); taps++; // dal pasto in Oggi (la barra non ha più il "+")
  await p.getByRole('tab', { name: 'Recenti' }).waitFor();
  check(await p.getByRole('tab', { name: 'Recenti' }).getAttribute('aria-selected') === 'true', 'con recenti si apre "Recenti"');
  await p.getByRole('button', { name: /^Pasta/ }).click(); taps++;
  check(await p.getByLabel('Grammi', { exact: true }).inputValue() === '100', 'proposti gli ultimi grammi usati (100)');
  await p.getByRole('button', { name: /^Aggiungi a / }).click(); taps++;
  await p.getByText(/^Aggiunto a /).waitFor();
  check(taps === 3 && sql("select count(*) from public.meal_entries") === '2', `ACCETTAZIONE: cibo recente registrato in ${taps} tocchi`);

  // Annulla
  await p.getByRole('button', { name: 'Annulla', exact: true }).click();
  await p.waitForTimeout(800);
  check(sql("select count(*) from public.meal_entries") === '1', '"Annulla" toglie la voce appena aggiunta');

  // Porzione
  await p.screenshot({ path: test.info().outputPath('step5-dopo-annulla.png'), fullPage: true });
  check(p.url() === 'http://localhost:4180/', 'URL pulito dopo l’avviso: ' + p.url());
  const dateEl = p.locator('header p').first();
  check(/^[a-zì]+ \d+ [a-z]+$/.test(await dateEl.textContent()) && (await dateEl.evaluate((el) => getComputedStyle(el, '::first-letter').textTransform)) === 'uppercase', 'data: mese minuscolo, prima lettera maiuscola via CSS: ' + await dateEl.textContent());
  await p.getByRole('link', { name: /Colazione/ }).click();
  check(await p.getByRole('tab', { name: 'Recenti' }).getAttribute('aria-selected') === 'true' && !(await p.getByRole('button', { name: /^Yogurt/ }).isVisible()), 'Yogurt (mai usato) non è tra i Recenti');
  await p.getByLabel('Cerca un cibo').fill('yog');
  await p.getByRole('button', { name: /^Yogurt/ }).click();
  check(await p.getByLabel('Grammi', { exact: true }).inputValue() === '125', 'cibo con porzione: proposti i grammi della porzione');
  await p.getByLabel('Grammi', { exact: true }).fill('0');
  await p.getByRole('button', { name: 'Aggiungi a colazione' }).click();
  check(await p.getByText('I grammi devono essere più di 0.').isVisible(), '0 g rifiutato con messaggio');
  await p.getByRole('button', { name: '1 porzione (125 g)' }).click();
  await p.getByRole('button', { name: 'Aggiungi a colazione' }).click();
  await p.getByText('Aggiunto a colazione').waitFor();
  check(sql("select grams||' '||kcal||' '||protein_g from public.meal_entries where food_name='Yogurt'") === '125.0 75.0 5.0', 'Yogurt 125 g → 75 kcal, P 5 (snapshot)');

  // Totali del giorno
  await p.waitForTimeout(500);
  const totalText = (await p.getByRole('region', { name: 'Riepilogo del giorno' }).textContent()).replace(/\s+/g, ' ');
  check(/Mangiate\s*425 kcal/.test(totalText), 'mangiate oggi 350 + 75 = 425 kcal');

  // Modifica grammi (snapshot scalato)
  await p.getByRole('button', { name: /^Pasta/ }).click();
  await p.getByLabel('Grammi', { exact: true }).fill('150');
  await p.getByRole('dialog').getByText('Cena', { exact: true }).click();
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.waitForTimeout(800);
  check(sql("select meal_type||' '||grams||' '||kcal from public.meal_entries where food_name='Pasta'") === 'dinner 150.0 525.0', 'modifica: 150 g → 525 kcal e spostata a cena');

  // ACCETTAZIONE: modificare il cibo non cambia le voci
  await p.goto('http://localhost:4180/cibi');
  await openFood('Pasta');
  await p.getByLabel(/^Kcal/).fill('400');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select kcal from public.meal_entries where food_name='Pasta'") === '525.0', 'ACCETTAZIONE: cambiare le kcal del cibo NON cambia la voce registrata');

  // ACCETTAZIONE: cancellare il cibo lascia la voce con il nome
  await openFood('Pasta');
  await p.getByRole('button', { name: 'Elimina cibo' }).click();
  await p.getByRole('button', { name: 'Elimina davvero' }).click();
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select food_name||' '||coalesce(food_id::text,'NULL')||' '||kcal from public.meal_entries where food_name='Pasta'") === 'Pasta NULL 525.0', 'ACCETTAZIONE: cibo cancellato, la voce resta con nome e valori');
  await p.getByRole('link', { name: 'Oggi' }).click();
  await p.getByRole('button', { name: /^Pasta/ }).waitFor();
  check(true, 'la voce "Pasta" è ancora visibile in Oggi');
  await p.screenshot({ path: test.info().outputPath('step5-oggi.png'), fullPage: true });

  // Eliminare una voce
  await p.getByRole('button', { name: /^Yogurt/ }).click();
  await p.getByRole('button', { name: 'Elimina voce' }).click();
  await p.getByRole('button', { name: 'Elimina davvero' }).click();
  await p.waitForTimeout(800);
  check(sql("select count(*) from public.meal_entries where food_name='Yogurt'") === '0', 'voce eliminata (due tocchi)');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
