import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'

test('Step 4 · cibi e ricette', async () => {
  resetDatabase();

  seedProfile();
  sql("delete from public.recipe_items; delete from public.foods");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  // Step 17: in Cibi si modifica con la matita; un cibo non preferito né recente si trova con la ricerca.
  const openFood = async (name) => { await p.getByLabel('Cerca nei tuoi cibi').fill(name); await p.getByRole('link', { name: 'Modifica ' + name, exact: true }).click(); };

  await p.getByRole('link', { name: 'Cibi' }).click();
  await p.getByText('Non hai ancora nessun cibo').waitFor();
  check(true, 'Cibi vuoto: stato vuoto con invito');

  async function newFood(v) {
    await p.goto('http://localhost:4180/cibi');
    await p.getByRole('link', { name: 'Nuovo cibo' }).click();
    await p.getByLabel('Nome').fill(v.name);
    if (v.serving) { await p.getByText('Una porzione', { exact: true }).click(); await p.getByLabel('Grammi della porzione').fill(v.serving); }
    await p.getByLabel(/^Kcal/).fill(v.kcal);
    await p.getByLabel('Proteine').fill(v.p); await p.getByLabel('Carboidrati').fill(v.c); await p.getByLabel('Grassi').fill(v.f);
    if (v.barcode) await p.getByLabel('Codice a barre (facoltativo)').fill(v.barcode);
    await p.getByRole('button', { name: 'Salva' }).click();
  }

  // Validazione §9
  await newFood({ name: 'Impossibile', kcal: '570', p: '60', c: '60', f: '10' });
  await p.getByText(/superano 100 g/).waitFor();
  check(sql("select count(*) from public.foods") === '0', 'P60+C60+G10 rifiutato con messaggio, nulla salvato');

  await newFood({ name: 'Pasta', kcal: '350', p: '12', c: '72', f: '1,5', barcode: '8001234567890' });
  await p.waitForURL('http://localhost:4180/cibi');
  await newFood({ name: 'Ragù', kcal: '120', p: '8', c: '6', f: '7' });
  await p.waitForURL('http://localhost:4180/cibi');
  await newFood({ name: 'Olio', kcal: '884', p: '0', c: '0', f: '100' });
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select string_agg(name||':'||kcal_100g||'/'||fat_100g, ' ' order by name) from public.foods") === 'Olio:884.00/100.00 Pasta:350.00/1.50 Ragù:120.00/7.00', 'tre cibi salvati con virgola decimale convertita');

  // Avviso incoerenza: secondo tocco salva
  await newFood({ name: 'Strano', kcal: '400', p: '10', c: '10', f: '80' });
  await p.getByText(/Valori incoerenti/).waitFor();
  check(sql("select count(*) from public.foods where name='Strano'") === '0', 'kcal incoerenti: avviso, non salvato al primo tocco');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select count(*) from public.foods where name='Strano'") === '1', 'secondo tocco su Salva: salvato');

  // Per porzione
  await newFood({ name: 'Crackers', serving: '30', kcal: '120', p: '3', c: '21', f: '2,4' });
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select kcal_100g||' '||serving_g from public.foods where name='Crackers'") === '400.00 30.0', 'valori per porzione salvati per 100 g, con serving_g');

  // Barcode duplicato
  await newFood({ name: 'Pasta 2', kcal: '350', p: '12', c: '72', f: '1,5', barcode: '8001234567890' });
  await p.getByText('Hai già un cibo con questo codice a barre.').waitFor();
  check(true, 'barcode duplicato: messaggio chiaro');

  // Ricetta Pasta al ragù
  await p.goto('http://localhost:4180/cibi/ricette/nuova');
  await p.getByLabel('Nome della ricetta').fill('Pasta al ragù');
  const add = async (name, grams) => {
    if (!(await p.getByLabel('Cerca un ingrediente').isVisible())) await p.getByRole('button', { name: '+ Aggiungi ingrediente' }).click();
    await p.getByLabel('Cerca un ingrediente').fill(name);
    await p.getByRole('button', { name: new RegExp('^' + name) }).first().click();
    await p.getByLabel(`Grammi di ${name}`).fill(grams);
  };
  await add('Pasta', '200'); await add('Ragù', '250'); await add('Olio', '10');
  await p.getByLabel('Peso totale cotto').fill('800');
  const preview = await p.getByText(/kcal · P/).textContent();
  check(preview.includes('136') && preview.includes('5,5') && preview.includes('19,9') && preview.includes('3,8'), 'anteprima per 100 g dal vivo: ' + preview.trim());
  await p.getByRole('button', { name: 'Usa il peso crudo (460 g)' }).waitFor();
  check(true, 'proposta "Usa il peso crudo (460 g)"');
  await p.screenshot({ path: test.info().outputPath('step4-ricetta.png'), fullPage: true });
  await p.getByRole('button', { name: 'Salva ricetta' }).click();
  await p.waitForURL('http://localhost:4180/cibi');
  const r = sql("select kcal_100g||' '||protein_100g||' '||carbs_100g||' '||fat_100g||' '||cooked_weight_g||' '||(select count(*) from public.recipe_items ri where ri.recipe_food_id=f.id) from public.foods f where source='recipe'");
  check(r === '136.05 5.50 19.88 3.81 800.0 3', 'ACCETTAZIONE: Pasta al ragù = 136,05 kcal, P 5,5, C 19,88, G 3,81 per 100 g (calcolo a mano), 3 ingredienti → ' + r);
  await p.getByLabel('Cerca nei tuoi cibi').fill('Pasta al ragù');
  await p.getByText(/· Ricetta/).waitFor({ timeout: 5000 });
  check(true, 'la ricetta compare in elenco con etichetta "Ricetta"');
  await p.getByLabel('Cerca nei tuoi cibi').fill('');
  await p.screenshot({ path: test.info().outputPath('step4-elenco.png'), fullPage: true });

  // Eliminare un ingrediente usato
  await openFood('Olio');
  await p.getByRole('button', { name: 'Elimina cibo' }).click();
  await p.getByRole('button', { name: 'Elimina davvero' }).click();
  await p.getByText(/è un ingrediente di "Pasta al ragù"/).waitFor();
  check(sql("select count(*) from public.foods where name='Olio'") === '1', 'ACCETTAZIONE: eliminare un ingrediente usato è bloccato con messaggio chiaro');

  // Modificare un ingrediente ricalcola la ricetta
  await p.goto('http://localhost:4180/cibi');
  await openFood('Ragù');
  await p.getByLabel(/^Kcal/).fill('140');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select kcal_100g from public.foods where source='recipe'") === '142.30', 'modificare il Ragù ricalcola la ricetta (1138,4/8 = 142,30)');

  // Modifica ricetta: tolgo l'olio
  await openFood('Pasta al ragù');
  await p.getByRole('button', { name: 'Togli Olio' }).click();
  await p.getByRole('button', { name: 'Salva ricetta' }).click();
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select count(*) from public.recipe_items") === '2', 'modifica ricetta: ingrediente tolto (transazione save_recipe)');

  // Preferiti e ricerca
  await p.getByLabel('Cerca nei tuoi cibi').fill('Pasta');
  await p.getByRole('button', { name: 'Aggiungi Pasta ai preferiti' }).click();
  await p.getByRole('button', { name: 'Togli Pasta dai preferiti' }).waitFor();
  check(sql("select is_favorite from public.foods where name='Pasta'") === 't', 'stella: preferito salvato');
  await p.getByLabel('Cerca nei tuoi cibi').fill('ragu');
  const names = await p.locator('main ul li > div > span:first-child').allTextContents();
  check(JSON.stringify(names) === JSON.stringify(['Pasta al ragù', 'Ragù']), 'ricerca "ragu" senza accento: ' + JSON.stringify(names));

  // Eliminare un cibo non usato
  await p.getByLabel('Cerca nei tuoi cibi').fill('');
  await openFood('Crackers');
  await p.getByRole('button', { name: 'Elimina cibo' }).click();
  await p.getByRole('button', { name: 'Elimina davvero' }).click();
  await p.waitForURL('http://localhost:4180/cibi');
  check(sql("select count(*) from public.foods where name='Crackers'") === '0', 'cibo non usato eliminato');

  // RLS dall'app: l'utente B non vede niente
  await p.getByRole('link', { name: 'Profilo' }).click();
  await p.getByRole('button', { name: 'Esci' }).click();
  await p.waitForURL('**/login');
  sql("insert into public.profiles (user_id, sex, birth_date, height_cm) values ('00000000-0000-0000-0000-00000000000b','female','1996-01-01',165) on conflict do nothing");
  sql("insert into public.weight_logs (user_id, log_date, weight_kg) values ('00000000-0000-0000-0000-00000000000b',(now() at time zone 'Europe/Rome')::date,60) on conflict do nothing");
  await login(p, 'b');
  await p.getByRole('link', { name: 'Cibi' }).click();
  await p.getByText('Non hai ancora nessun cibo').waitFor();
  check(true, 'utente B non vede i cibi di A (RLS attraverso PostgREST)');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
