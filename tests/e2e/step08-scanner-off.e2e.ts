import { chromium, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeBarcodeVideo } from './support/barcodeVideo'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
const fixture = JSON.parse(readFileSync(new URL('../../src/lib/__fixtures__/off-product.json', import.meta.url), 'utf8'));
// Prodotti finti di Open Food Facts (dati INVENTATI).
const product = (code, name, n) => ({ code, product_name: name, brands: 'Marca Inventata', serving_quantity: 40, serving_quantity_unit: 'g', nutriments: n });
const OFF = {
  '8001234567897': product('8001234567897', 'Barretta di prova', { 'energy-kcal_100g': 420, proteins_100g: 20, carbohydrates_100g: 50, fat_100g: 15 }),
  '3000000000017': { ...fixture.product, code: '3000000000017' },
  '3000000000024': { code: '3000000000024', product_name: 'Avena senza tabella', nutriments: { 'energy-kcal_100g': 370 } },
};
let offCalls = [];
async function mockOff(ctx) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  await ctx.route('https://world.openfoodfacts.org/**', (route) => {
    const u = new URL(route.request().url());
    offCalls.push(u.pathname + u.search);
    const code = u.pathname.split('/').pop();
    if (OFF[code]) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ code, status: 'success', result: { id: 'product_found' }, product: OFF[code] }) });
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ code, status: 'failure', result: { id: 'product_not_found' } }) });
  });
  await ctx.route('https://search.openfoodfacts.org/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    offCalls.push('search ' + route.request().postData());
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ hits: [OFF['3000000000017'], OFF['3000000000024'], { product_name: 'senza codice' }], count: 3, page: 1, page_size: 20, page_count: 1 }) });
  });
}

test('Step 8 · scanner e Open Food Facts (simulato)', async () => {
  resetDatabase();
  const video = test.info().outputPath('barcode.y4m');
  writeBarcodeVideo('800123456789', video);

  seedProfile();
  sql("delete from public.meal_entries; delete from public.recipe_items; delete from public.foods");
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['camera'] });
  await wire(ctx); await mockOff(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);

  // Ricerca testuale: niente chiamate mentre si scrive
  await p.goto('http://localhost:4180/aggiungi?pasto=breakfast');
  await p.getByLabel('Cerca un cibo').fill('avena');
  await p.waitForTimeout(700);
  check(offCalls.length === 0, 'scrivere NON chiama Open Food Facts (niente search-as-you-type)');
  await p.getByRole('button', { name: 'Cerca "avena" su Open Food Facts' }).click();
  await p.getByRole('list', { name: /Risultati di Open Food Facts/ }).waitFor();
  check(offCalls.length === 1 && offCalls[0].includes('"langs":["it","en"]'), 'una sola ricerca, POST con lingue it,en');
  check((await p.getByRole('list', { name: /Risultati/ }).getByRole('listitem').count()) === 2, 'risultati validi mostrati (scartato quello senza codice)');
  check(await p.getByText(/dati da completare/).isVisible(), 'prodotto incompleto segnalato in elenco');

  // Scelta di un prodotto completo → salvato tra i propri cibi → pannello grammi
  await p.getByRole('button', { name: /^Fiocchi d'avena di prova/ }).click();
  await p.getByRole('dialog').waitFor();
  check(await p.getByLabel('Grammi', { exact: true }).inputValue() === '40', 'pannello aperto con la porzione di OFF (40 g)');
  check(sql("select source||' '||barcode||' '||kcal_100g||' '||serving_g from public.foods where barcode='3000000000017'") === 'open_food_facts 3000000000017 372.00 40.0', 'ACCETTAZIONE: salvato tra i propri cibi alla prima scelta (fonte OFF)');
  await p.getByRole('button', { name: 'Aggiungi a colazione' }).click();
  await p.getByText('Aggiunto a colazione').waitFor();
  check(sql("select food_name||' '||kcal from public.meal_entries") === "Fiocchi d'avena di prova 148.8", 'voce registrata: 40 g → 148,8 kcal');

  // Prodotto incompleto → modulo precompilato, mai zeri
  await p.goto('http://localhost:4180/aggiungi?pasto=lunch');
  await p.getByLabel('Cerca un cibo').fill('avena');
  await p.getByRole('button', { name: /su Open Food Facts/ }).click();
  await p.getByRole('button', { name: /^Avena senza tabella/ }).click();
  await p.getByRole('heading', { name: 'Nuovo cibo' }).waitFor();
  check(await p.getByText(/Su Open Food Facts mancano: proteine, carboidrati, grassi/).isVisible(), 'ACCETTAZIONE: dati mancanti → proposta di creazione manuale con nota');
  check(await p.getByLabel('Nome').inputValue() === 'Avena senza tabella' && await p.getByLabel(/^Kcal/).inputValue() === '370' && await p.getByLabel('Proteine').inputValue() === '', 'modulo precompilato, campi mancanti VUOTI (niente zeri silenziosi)');
  await p.getByLabel('Proteine').fill('13'); await p.getByLabel('Carboidrati').fill('60'); await p.getByLabel('Grassi').fill('7');
  await p.getByRole('button', { name: 'Salva' }).click();
  await p.getByRole('dialog').waitFor();
  check(p.url().includes('/aggiungi') && sql("select source from public.foods where barcode='3000000000024'") === 'open_food_facts', 'salvato e ritorno ad Aggiungi pasto con il pannello aperto');
  await p.getByRole('button', { name: 'Chiudi' }).click();

  // Scanner con la fotocamera finta: codice EAN-13 vero nel video
  offCalls = [];
  await p.goto('http://localhost:4180/aggiungi?pasto=snack');
  await p.getByRole('link', { name: 'Scansiona un codice a barre' }).click();
  await p.getByRole('button', { name: 'Avvia fotocamera' }).click();
  await p.getByRole('dialog').waitFor({ timeout: 20000 });
  check(offCalls.some((c) => c.includes('/api/v3.4/product/8001234567897') && c.includes('app_name=CaloriesRecord') && c.includes('fields=')), 'ACCETTAZIONE (simulata): zxing ha letto il codice dal video; chiamata v3.4 con fields e app_name');
  check(sql("select name||' '||source from public.foods where barcode='8001234567897'") === 'Barretta di prova open_food_facts', 'prodotto scansionato salvato tra i propri cibi');
  check(p.url().includes('pasto=snack') && await p.getByRole('heading', { name: 'Barretta di prova' }).isVisible(), 'ritorno ad Aggiungi a snack con il pannello del prodotto');
  await p.getByRole('button', { name: 'Chiudi' }).click();

  // Stesso codice scritto a mano: già tra i propri cibi → nessuna chiamata a OFF
  offCalls = [];
  await p.goto('http://localhost:4180/aggiungi/scanner?pasto=snack');
  await p.getByLabel('Oppure scrivi il codice').fill('8001234567897');
  await p.getByRole('button', { name: 'Cerca codice' }).click();
  await p.getByRole('dialog').waitFor();
  check(offCalls.length === 0, 'codice già tra i propri cibi: nessuna chiamata a Open Food Facts');

  // Non trovato
  await p.goto('http://localhost:4180/aggiungi/scanner?pasto=snack');
  await p.getByLabel('Oppure scrivi il codice').fill('8009999999999');
  await p.getByRole('button', { name: 'Cerca codice' }).click();
  await p.getByText(/Non trovato su Open Food Facts \(8009999999999\)/).waitFor();
  await p.getByRole('link', { name: 'Crea a mano' }).click();
  check(await p.getByLabel('Codice a barre (facoltativo)').inputValue() === '8009999999999', 'ACCETTAZIONE: non trovato → "Crealo a mano" con codice già compilato');
  await p.goto('http://localhost:4180/aggiungi/scanner');
  await p.getByLabel('Oppure scrivi il codice').fill('123');
  await p.getByRole('button', { name: 'Cerca codice' }).click();
  check(await p.getByText('Il codice a barre è fatto di 8-14 cifre.').isVisible(), 'codice scritto non valido: messaggio');

  // Limite di ricerca
  await p.goto('http://localhost:4180/aggiungi');
  await p.evaluate(() => sessionStorage.removeItem('off.search'));
  for (let i = 0; i < 11; i++) {
    if (i === 6) await p.reload(); // il conteggio deve resistere al ricaricamento
    await p.getByLabel('Cerca un cibo').fill('prova ' + i);
    await p.getByRole('button', { name: /su Open Food Facts/ }).click();
    await p.waitForTimeout(150);
  }
  check(await p.getByText(/Troppe richieste a Open Food Facts in un minuto/).isVisible(), 'all’11ª ricerca in un minuto l’app si ferma e avvisa, anche dopo un ricaricamento');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();

  // Permesso fotocamera negato
  const b2 = await chromium.launch();
  const ctx2 = await b2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await wire(ctx2); await mockOff(ctx2);
  const p2 = await ctx2.newPage();
  await login(p2);
  await p2.goto('http://localhost:4180/aggiungi/scanner?pasto=lunch');
  await p2.getByRole('button', { name: 'Avvia fotocamera' }).click();
  await p2.getByText(/Accesso alla fotocamera negato|Fotocamera non disponibile/).waitFor({ timeout: 10000 });
  check(await p2.getByRole('link', { name: 'Cerca per nome' }).isVisible() && await p2.getByLabel('Oppure scrivi il codice').isVisible(), 'ACCETTAZIONE: permesso negato gestito, con alternative (codice a mano, ricerca per nome)');
  check(await p2.getByText(/Fotocamera non disponibile/).isVisible(), 'nessuna fotocamera: messaggio "non disponibile" con alternative');
  await p2.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  await p2.goto('http://localhost:4180/aggiungi/scanner?pasto=lunch');
  await p2.getByRole('button', { name: 'Avvia fotocamera' }).click();
  await p2.getByText(/Accesso alla fotocamera negato/).waitFor({ timeout: 10000 });
  check(await p2.getByText(/Impostazioni → Safari → Fotocamera/).isVisible(), 'ACCETTAZIONE: permesso NEGATO → spiegazione su come riattivarlo + alternative');
  await p2.screenshot({ path: test.info().outputPath('step8-negato.png') });
  await b2.close();
});
