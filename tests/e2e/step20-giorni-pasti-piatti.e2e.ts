import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
// Step 20: giorni passati, pasti su misura (ingranaggio), piatti nel catalogo.

test('Step 20 · giorni passati, pasti su misura, piatti', async () => {
  resetDatabase();

  sql("delete from public.meal_entries; delete from public.foods; delete from public.meal_slots; delete from public.daily_targets");
  seedProfile();
  sql(`insert into public.meal_slots (user_id, slot_key, name, position) values ('${A}','breakfast','Colazione',0),('${A}','morning_snack','Snack',1),('${A}','lunch','Pranzo',2),('${A}','dinner','Cena',3),('${A}','snack','Spuntino',4) on conflict do nothing`);
  sql(`insert into public.foods (user_id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, last_used_at) values ('${A}','Pasta',350,12,72,1.5,now())`);
  const today = sql("select (now() at time zone 'Europe/Rome')::date");
  const yesterday = sql("select (now() at time zone 'Europe/Rome')::date - 1");
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}','${yesterday}',75) on conflict do nothing`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  const h1 = p.getByRole('heading', { level: 1 });

  // ─── Giorni passati ───
  check(await p.getByRole('button', { name: 'Giorno successivo' }).isDisabled(), 'oggi: la freccia avanti è disattivata');
  await p.getByRole('button', { name: 'Giorno precedente' }).click();
  await p.getByRole('heading', { name: 'Ieri', level: 1 }).waitFor();
  check(p.url().includes('data=' + yesterday), 'ieri: il giorno è nell’indirizzo (?data=)');
  check(await p.getByText('Stai modificando un giorno passato').isVisible(), 'ieri: avviso del giorno passato');
  await p.getByRole('region', { name: 'Colazione' }).count();
  await p.getByRole('link', { name: /Colazione/ }).click();
  await p.getByRole('heading', { name: 'Aggiungi a colazione' }).waitFor();
  check(p.url().includes('pasto=breakfast') && p.url().includes('data=' + yesterday), 'Aggiungi: pasto e giorno nell’indirizzo');
  check(await p.getByText(/^Per /).isVisible(), 'Aggiungi: dice per quale giorno si registra');
  await p.getByRole('button', { name: /^Pasta/ }).first().click();
  await p.getByRole('button', { name: 'Aggiungi a colazione' }).click();
  await p.getByRole('heading', { name: 'Ieri', level: 1 }).waitFor();
  check(sql("select entry_date||' '||meal_type||' '||grams from public.meal_entries") === `${yesterday} breakfast 100.0`, 'ACCETTAZIONE: la voce è registrata su ieri, in Colazione');
  await p.getByRole('region', { name: 'Colazione' }).getByText('Pasta').waitFor();
  await p.screenshot({ path: test.info().outputPath('step20-ieri.png'), fullPage: true });
  await p.getByRole('button', { name: 'Torna a oggi' }).click();
  await p.getByRole('heading', { name: 'Oggi', level: 1 }).waitFor();
  check(await p.getByRole('region', { name: 'Colazione' }).count() === 0, 'oggi: la voce di ieri non c’è');
  await p.goto('http://localhost:4180/?data=2020-01-01');
  await p.getByRole('heading', { name: 'Oggi', level: 1 }).waitFor();
  check(true, 'giorno troppo vecchio nell’indirizzo: si torna a oggi');
  await p.goto('http://localhost:4180/?data=' + today);
  await p.getByRole('heading', { name: 'Oggi', level: 1 }).waitFor();

  // ─── Swipe tra i giorni (touch sintetici sul contenitore) ───
  const swipe = (dx, dy = 0, x0 = 200) =>
    p.evaluate(({ dx, dy, x0 }) => {
      const el = document.querySelector('[data-day-swipe]');
      const mk = (type, x, y) => {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      };
      mk('touchstart', x0, 300); mk('touchmove', x0 + dx / 2, 300 + dy / 2); mk('touchmove', x0 + dx, 300 + dy); mk('touchend', x0 + dx, 300 + dy);
    }, { dx, dy, x0 });
  await swipe(-120);
  await p.waitForTimeout(400);
  check(await h1.textContent() === 'Oggi', 'swipe a sinistra a oggi: resta su oggi (non c’è il futuro)');
  await swipe(120);
  await p.getByRole('heading', { name: 'Ieri', level: 1 }).waitFor();
  check(p.url().includes('data=' + yesterday), 'swipe a destra: va al giorno precedente');
  await swipe(30);
  await p.waitForTimeout(300);
  check(await h1.textContent() === 'Ieri', 'swipe troppo corto: non cambia giorno');
  await swipe(100, 160);
  await p.waitForTimeout(300);
  check(await h1.textContent() === 'Ieri', 'gesto soprattutto verticale: non cambia giorno');
  await swipe(120, 0, 10);
  await p.waitForTimeout(300);
  check(await h1.textContent() === 'Ieri', 'partenza dal bordo sinistro (gesto "indietro" di iOS): ignorato');
  await swipe(-120);
  await p.getByRole('heading', { name: 'Oggi', level: 1 }).waitFor();
  check(!p.url().includes('data='), 'swipe a sinistra da ieri: torna a oggi');

  // ─── Pasti su misura ───
  await p.getByRole('button', { name: 'Gestisci i pasti' }).click();
  const dlg = p.getByRole('dialog', { name: 'I tuoi pasti' });
  await dlg.waitFor();
  check(await dlg.getByRole('listitem').count() === 5, 'ingranaggio: 5 pasti di partenza');
  await dlg.getByLabel('Nome del nuovo pasto').fill('dopo allenamento');
  await dlg.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await dlg.getByText('Dopo allenamento').waitFor();
  check(sql("select (slot_key like 'custom_%')::int ||' '|| name ||' '|| position from public.meal_slots where name = 'Dopo allenamento'") === '1 Dopo allenamento 5', 'pasto nuovo salvato (nome pulito, in fondo)');
  await dlg.getByLabel('Nome del nuovo pasto').fill('PRANZO');
  await dlg.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await dlg.getByText('Hai già un pasto con questo nome.').waitFor();
  check(true, 'nome doppione rifiutato');
  await dlg.getByRole('button', { name: 'Rinomina Spuntino' }).click();
  await dlg.getByLabel('Nome del pasto').fill('Merenda');
  await dlg.getByRole('button', { name: 'Salva' }).click();
  await dlg.getByText('Merenda').waitFor();
  check(sql("select name from public.meal_slots where slot_key = 'snack'") === 'Merenda', 'rinominato: stessa chiave, nome nuovo');
  // Riordino: tenendo premuto la riga (mouse = stesso gesto del dito), o dalle due linee, o con le frecce.
  const order = () => sql("select string_agg(slot_key, ',' order by position) from public.meal_slots");
  const rowBox = async (name) => (await dlg.getByRole('listitem').filter({ hasText: name }).boundingBox());
  const dragRow = async (name, steps, viaHandle) => {
    const box = await rowBox(name);
    const x = viaHandle ? box.x + box.width - 22 : box.x + 60;
    const y = box.y + box.height / 2;
    await p.mouse.move(x, y);
    await p.mouse.down();
    if (!viaHandle) await p.waitForTimeout(500);
    for (let i = 1; i <= 8; i++) await p.mouse.move(x, y + (steps * 49 * i) / 8);
    return { up: () => p.mouse.up() };
  };
  // 1) Un tocco veloce sul nome non solleva niente.
  const first = await rowBox('Colazione');
  await p.mouse.click(first.x + 60, first.y + first.height / 2);
  check(await dlg.locator('li[style*="scale"]').count() === 0, 'tocco veloce: il pasto non si solleva');
  // 2) Tenere premuto "Dopo allenamento" e portarlo su di una riga.
  const held = await dragRow('Dopo allenamento', -1, false);
  check(await dlg.locator('li[style*="scale"]').count() === 1, 'tenendo premuto: il pasto si solleva (in primo piano)');
  await p.screenshot({ path: test.info().outputPath('step20-trascina.png') });
  await held.up();
  await p.waitForFunction(() => document.querySelectorAll('[role=dialog] li[style*="scale"]').length === 0);
  await p.waitForTimeout(600);
  check(order().startsWith('breakfast,morning_snack,lunch,dinner,custom_') && order().endsWith(',snack'), 'tenere premuto e trascinare su: ordine salvato');
  // 3) Dalle due linee: si solleva subito; portare Colazione in fondo (5 righe sotto).
  const handle = await dragRow('Colazione', 5, true);
  await handle.up();
  await p.waitForTimeout(700);
  check(order().endsWith(',breakfast') && order().startsWith('morning_snack,'), 'dalle due linee: Colazione portata in fondo');
  // 4) Un movimento prima del tempo = scorrimento, non spostamento.
  const early = await rowBox('Pranzo');
  await p.mouse.move(early.x + 60, early.y + early.height / 2);
  await p.mouse.down();
  await p.mouse.move(early.x + 60, early.y + early.height / 2 + 30, { steps: 4 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  check(order().endsWith(',breakfast') && order().startsWith('morning_snack,'), 'muoversi prima del tempo: non sposta il pasto');
  // 5) Tastiera / VoiceOver: frecce sulle due linee.
  await dlg.getByRole('button', { name: /^Riordina Colazione/ }).focus();
  await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(500);
  check(order().endsWith(',breakfast,snack') || order().endsWith(',breakfast,snack'.replace(',breakfast,snack', ',breakfast,snack')), 'frecce su: Colazione sale di una posizione');
  for (let i = 0; i < 5; i++) { await p.keyboard.press('ArrowUp'); await p.waitForTimeout(450); }
  check(await p.evaluate(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Riordina Colazione')), 'frecce: il focus resta sulle due linee dopo ogni spostamento');
  check(order().startsWith('breakfast,'), 'frecce: Colazione di nuovo in cima');
  // Eliminare un pasto con voci: rifiutato; uno vuoto: ok.
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) values ('${A}','${today}','dinner','Cena di prova',100,500,20,50,10)`);
  await dlg.getByRole('button', { name: 'Elimina Cena' }).click();
  await dlg.getByRole('button', { name: 'Elimina davvero' }).click();
  await dlg.getByText(/ha già delle voci registrate/).waitFor();
  check(sql("select count(*) from public.meal_slots where slot_key = 'dinner'") === '1', 'ACCETTAZIONE: un pasto con voci non si elimina (messaggio chiaro)');
  await p.screenshot({ path: test.info().outputPath('step20-pasti.png') });
  await dlg.getByRole('button', { name: 'Elimina Dopo allenamento' }).click();
  await dlg.getByRole('button', { name: 'Elimina davvero' }).click();
  await dlg.getByText('Dopo allenamento').waitFor({ state: 'detached' });
  check(sql("select count(*) from public.meal_slots") === '5', 'un pasto vuoto si elimina');
  await dlg.getByRole('button', { name: 'Chiudi' }).click();
  // Il nome nuovo compare in Oggi e in Aggiungi.
  await p.getByRole('link', { name: /Merenda/ }).waitFor();
  check(true, 'Oggi mostra "Merenda" al posto di "Spuntino"');
  await p.getByRole('link', { name: /Merenda/ }).click();
  await p.getByRole('heading', { name: 'Aggiungi a merenda' }).waitFor();
  check(await p.getByLabel('Merenda', { exact: true }).count() === 1, 'Aggiungi: il selettore dei pasti usa i nomi dell’utente');

  // ─── Piatti nel catalogo ───
  await p.getByRole('tab', { name: 'Catalogo' }).click();
  await p.getByRole('button', { name: /Piatti comuni/ }).waitFor();
  const tileCount = await p.getByRole('region', { name: 'Catalogo degli ingredienti' }).getByRole('listitem').count();
  check(tileCount === 13, `catalogo: 13 categorie (trovate ${tileCount})`);
  await p.getByRole('button', { name: /Piatti comuni/ }).click();
  await p.getByRole('heading', { name: 'Piatti comuni' }).waitFor();
  const items = await p.getByRole('region', { name: 'Catalogo: Piatti comuni' }).getByRole('listitem').count();
  check(items === 23, `Piatti comuni: 23 voci (trovate ${items})`);
  await p.screenshot({ path: test.info().outputPath('step20-piatti.png'), fullPage: true });
  await p.getByRole('button', { name: /^Pizza margherita/ }).click();
  await p.getByRole('button', { name: /Aggiungi a merenda/ }).waitFor();
  check(sql("select kcal_100g from public.foods where name = 'Pizza margherita'") === '226.00', 'Pizza margherita salvata tra i propri cibi (226 kcal/100 g)');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
