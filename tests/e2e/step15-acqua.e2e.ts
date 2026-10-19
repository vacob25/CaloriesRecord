import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
const T = "(now() at time zone 'Europe/Rome')::date";
// Acqua: step 15 + contatori dello step 17.

test('Step 15 · acqua e obiettivo', async () => {
  resetDatabase();

  sql("delete from public.water_entries; delete from public.drink_containers");
  seedProfile();
  sql(`insert into public.water_entries (user_id, entry_date, ml, container) values ('${A}', ${T} - 1, 900, 'bottle')`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  const card = p.getByRole('region', { name: 'Acqua' });
  await card.waitFor();
  const text = async () => (await card.textContent()).replace(/\s+/g, ' ');
  check((await text()).includes('0 ml') && (await text()).includes('Imposta un obiettivo'), 'senza obiettivo: 0 ml e invito facoltativo (ieri non conta)');
  check(await card.getByRole('button', { name: 'Togli Bicchiere' }).isDisabled(), 'contatore a 0: il "−" è disattivato');

  await card.getByRole('button', { name: 'Aggiungi Bicchiere' }).click();
  await card.getByText('200 ml', { exact: true }).first().waitFor();
  await card.getByRole('button', { name: 'Aggiungi Bicchiere' }).click();
  await card.getByText('400 ml').waitFor();
  await card.getByRole('button', { name: 'Aggiungi Bottiglietta' }).click();
  await card.getByText('900 ml').waitFor();
  check((await card.getByRole('listitem').filter({ hasText: 'Bicchiere' }).textContent()).includes('2 bicchiere oggi'), 'Bicchiere: contatore 2');

  // Contenitore nuovo: si salva SENZA aggiungere acqua
  await card.getByRole('button', { name: 'Altra quantità o nuovo contenitore' }).click();
  const dlg = p.getByRole('dialog');
  await dlg.getByText('Salva come contenitore').click();
  await dlg.getByLabel('Capienza del contenitore').fill('750');
  await dlg.getByLabel('Nome del contenitore').fill('bicchiere');
  await dlg.getByRole('button', { name: 'Salva contenitore' }).click();
  check(await dlg.getByText('Hai già un contenitore con questo nome.').isVisible(), 'nome già usato rifiutato');
  await dlg.getByLabel('Nome del contenitore').fill('Borraccia');
  await p.screenshot({ path: test.info().outputPath('step17-contenitore.png') });
  await dlg.getByRole('button', { name: 'Salva contenitore' }).click();
  await dlg.waitFor({ state: 'detached' });
  await card.getByRole('button', { name: 'Aggiungi Borraccia' }).waitFor();
  check(sql(`select sum(ml) from public.water_entries where entry_date = ${T}`) === '900', 'RICHIESTA: salvare la borraccia NON aggiunge acqua (resta 900 ml)');
  await card.getByRole('button', { name: 'Aggiungi Borraccia' }).click();
  await card.getByText('1,65 L').waitFor();
  check(true, 'la borraccia si usa col suo "+": 1,65 L');

  // Quantità libera
  await card.getByRole('button', { name: 'Altra quantità o nuovo contenitore' }).click();
  await dlg.getByLabel('Millilitri').fill('0');
  await dlg.getByRole('button', { name: 'Aggiungi' }).click();
  check(await dlg.getByText('I ml devono essere più di 0.').isVisible(), 'quantità libera: 0 ml rifiutato');
  await dlg.getByLabel('Millilitri').fill('200');
  await dlg.getByRole('button', { name: 'Aggiungi' }).click();
  await dlg.waitFor({ state: 'detached' });
  await card.getByText('1,85 L').waitFor();
  check((await card.getByRole('listitem').filter({ hasText: 'Bicchiere' }).textContent()).includes('2 bicchiere oggi'), '200 ml scritti a mano NON contano come bicchiere');
  check(sql(`select string_agg(coalesce(container, 'libera') || ':' || ml, ',' order by created_at) from public.water_entries where entry_date = ${T}`).startsWith('glass:200,glass:200,small-bottle:500,'), 'ogni aggiunta salva il suo contenitore');

  // "−" toglie l'ultima di quel contenitore
  await card.getByRole('button', { name: 'Togli Bicchiere' }).click();
  await card.getByText('1,65 L').waitFor();
  check(sql(`select count(*) from public.water_entries where entry_date = ${T} and container = 'glass'`) === '1', 'RICHIESTA: "−" toglie un bicchiere (contatore 1)');
  await card.getByRole('button', { name: /^Togli l'ultima quantità libera/ }).click();
  await card.getByText('1,45 L').waitFor();
  check(sql(`select sum(ml) from public.water_entries where entry_date = ${T}`) === '1450', 'ACCETTAZIONE: somma nel giorno locale = 200 + 500 + 750 = 1450 ml');
  await p.screenshot({ path: test.info().outputPath('step17-acqua.png'), fullPage: true });

  // Obiettivo dal pop-up in Oggi (step 23): niente viaggio nel Profilo, campo numerico
  await card.getByRole('button', { name: /Imposta un obiettivo/ }).click();
  const goalDlg = p.getByRole('dialog', { name: 'Obiettivo acqua' });
  await goalDlg.waitFor();
  check(p.url().endsWith('/'), 'il pop-up si apre in Oggi, senza cambiare schermata');
  const goalField = goalDlg.getByLabel('Litri al giorno');
  check(await goalField.getAttribute('inputmode') === 'decimal', 'il campo ha la tastiera numerica (cifre e virgola)');
  check(await goalField.evaluate((el) => document.activeElement === el), 'il campo è già attivo (tastiera pronta)');
  await goalField.fill('2 litri e mezzo');
  check(await goalField.inputValue() === '2', 'lettere e spazi non entrano nel campo');
  await goalField.fill('');
  await goalField.pressSequentially('2,5,7a');
  check(await goalField.inputValue() === '2,57', 'solo cifre e una virgola');
  await goalField.fill('0');
  await goalDlg.getByRole('button', { name: 'Salva obiettivo' }).click();
  await goalDlg.getByText('Scrivi l’obiettivo in litri').waitFor();
  check(true, 'valore non valido: messaggio nel pop-up, resta aperto');
  await goalField.fill('2');
  await goalDlg.getByRole('button', { name: 'Salva obiettivo' }).click();
  await goalDlg.waitFor({ state: 'detached' });
  await card.getByText('Mancano 550 ml').waitFor();
  check((await text()).includes('1,45 L di 2 L'), 'con obiettivo "1,45 L di 2 L", mancano 550 ml');
  check(sql("select water_goal_ml from public.profiles") === '2000', 'obiettivo salvato (2000 ml)');
  // Cambiare e togliere
  await card.getByRole('button', { name: 'Cambia obiettivo' }).click();
  await goalDlg.getByLabel('Litri al giorno').fill('3,5');
  await goalDlg.getByRole('button', { name: 'Salva obiettivo' }).click();
  await card.getByText('1,45 L di 3,5 L').waitFor();
  await card.getByRole('button', { name: 'Cambia obiettivo' }).click();
  await goalDlg.getByRole('button', { name: 'Togli l’obiettivo' }).click();
  await card.getByRole('button', { name: /Imposta un obiettivo/ }).waitFor();
  check(sql("select water_goal_ml is null from public.profiles") === 't', 'obiettivo tolto dal pop-up');
  // Anche nel Profilo il campo resta numerico
  await p.getByRole('link', { name: 'Profilo', exact: true }).click();
  await p.getByLabel('Obiettivo giornaliero (facoltativo)').fill('abc1,5kg');
  check(await p.getByLabel('Obiettivo giornaliero (facoltativo)').inputValue() === '1,5', 'Profilo: anche qui solo cifre e virgola');
  await p.getByRole('link', { name: 'Oggi' }).click();

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await b.close();
});
