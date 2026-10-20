import { chromium, test } from '@playwright/test'

import { USERS, check, login, resetDatabase, seedProfile, signups, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
const T = "(now() at time zone 'Europe/Rome')::date";
const NEW = 'tester.prova@example.com';

test('Step 18 · tester invitati, consenso, esporta, elimina', async () => {
  resetDatabase();

  // Utente A con dati suoi; elenco degli invitati con una sola email di prova.
  sql("delete from public.water_entries; delete from public.drink_containers; delete from public.recipe_items; delete from public.meal_entries; delete from public.foods; delete from public.allowed_emails");
  sql(`delete from auth.users where email like '%tester%'`);
  seedProfile();
  sql(`insert into public.foods (user_id, name, source, kcal_100g, protein_100g, carbs_100g, fat_100g) values ('${A}', 'Cibo di A', 'manual', 100, 10, 10, 2)`);
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) values ('${A}', ${T}, 'lunch', 'Cibo di A', 100, 100, 10, 10, 2)`);
  const aRows = () => sql(`select (select count(*) from public.foods where user_id='${A}') || ' ' || (select count(*) from public.meal_entries where user_id='${A}') || ' ' || (select count(*) from public.weight_logs where user_id='${A}')`);
  const aBefore = aRows();

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  // Privacy pubblica, senza login
  await p.goto('http://localhost:4180/privacy');
  await p.getByRole('heading', { name: 'Privacy', level: 1 }).waitFor();
  const privacy = await p.locator('main').textContent();
  check(privacy.includes('Testo di base da far rivedere') && privacy.includes('Irlanda') && privacy.includes('Contatto non ancora configurato'), 'PRIVACY: pubblica, avviso "da far rivedere", Irlanda, contatto assente gestito');

  // Registrazione
  await p.goto('http://localhost:4180/login');
  await p.getByRole('link', { name: 'Registrati' }).click();
  await p.getByRole('heading', { name: 'Registrati' }).waitFor();
  await p.getByLabel('Email').fill(NEW);
  await p.getByLabel('Password', { exact: true }).fill('corta');
  await p.getByRole('button', { name: 'Registrati' }).click();
  check(await p.getByText('La password deve avere almeno 8 caratteri.').isVisible() && await p.getByText(/devi accettare l’informativa/).isVisible() && signups.length === 0, 'password corta e niente consenso: errori, nessuna richiesta');
  check(await p.getByLabel('Password', { exact: true }).getAttribute('autocomplete') === 'new-password', 'autocomplete new-password (Portachiavi iCloud)');
  await p.getByLabel('Password', { exact: true }).fill('una frase lunga di prova');
  await p.getByRole('checkbox').check();
  await p.getByRole('button', { name: 'Registrati' }).click();
  await p.getByText(/Registrazione solo su invito/).waitFor();
  check(sql(`select count(*) from auth.users where email = '${NEW}'`) === '0', 'ACCETTAZIONE: email non invitata rifiutata (hook vera), nessun utente creato');
  await p.screenshot({ path: test.info().outputPath('step18-non-invitato.png') });

  sql(`insert into public.allowed_emails (email) values ('${NEW}')`);
  await p.getByRole('button', { name: 'Registrati' }).click();
  await p.getByRole('heading', { name: 'Benvenuto' }).waitFor({ timeout: 8000 });
  check(true, 'ACCETTAZIONE: email invitata accettata → Benvenuto (profilo del nuovo utente)');
  const meta = signups.at(-1).data;
  check(meta.health_data_consent === true && /^\d{4}-\d{2}-\d{2}$/.test(meta.privacy_version) && !!meta.privacy_accepted_at, 'consenso salvato nei metadati: versione, data, dati sulla salute');

  // Profilo del nuovo utente
  await p.getByText('Uomo').click();
  await p.getByLabel('Data di nascita').fill('2000-06-15');
  await p.getByLabel('Altezza').fill('170');
  await p.getByLabel('Peso di oggi').fill('65');
  await p.getByRole('button', { name: 'Avanti' }).click();
  await p.getByText('Mantenere il peso').click();
  await p.getByRole('button', { name: 'Avanti' }).click();
  await p.getByText('Leggero', { exact: true }).click();
  await p.getByRole('button', { name: 'Inizia' }).click();
  await p.getByRole('heading', { name: 'Oggi', exact: true, level: 1 }).waitFor({ timeout: 8000 });
  await p.getByRole('dialog', { name: 'Tutorial' }).waitFor();
  await p.getByRole('button', { name: 'Salta' }).click();
  await p.getByRole('dialog', { name: 'Tutorial' }).waitFor({ state: 'detached' });
  const newId = sql(`select id from auth.users where email = '${NEW}'`);
  check(sql(`select tutorial_done_at is not null from public.profiles where user_id = '${newId}'`) === 't', 'nuovo utente: il tutorial si apre da solo e "Salta" lo segna come visto');
  check(sql(`select count(*) from public.profiles where user_id = '${newId}'`) === '1', 'il nuovo utente ha il suo profilo');
  check(!(await p.getByText('Cibo di A').isVisible()), 'ACCETTAZIONE: il nuovo utente non vede i pasti di A');
  await p.goto('http://localhost:4180/cibi');
  await p.getByRole('heading', { name: 'Cibi' }).waitFor();
  check(!(await p.locator('main').textContent()).includes('Cibo di A'), 'e nemmeno i cibi di A');

  // Esporta: in Chromium di prova non c'è la condivisione di file → testo da copiare
  await p.goto('http://localhost:4180/profilo');
  await p.getByRole('button', { name: 'Esporta i miei dati' }).click();
  const box = p.getByLabel(/Il tuo file/);
  await box.waitFor();
  const exported = JSON.parse(await box.inputValue());
  check(exported.account === NEW && exported.tabelle.weight_logs.length === 1 && exported.tabelle.profiles.length === 1 && exported.tabelle.meal_entries.length === 0, 'ESPORTA: JSON con i soli dati del nuovo utente (1 profilo, 1 pesata, 0 pasti)');
  check(Object.keys(exported.tabelle).length === 18, 'ESPORTA: tutte le 18 tabelle');

  // Logout: niente dati del vecchio utente nel browser
  await p.getByRole('button', { name: 'Esci' }).click();
  await p.getByRole('heading', { name: 'Accedi' }).waitFor();
  const leftovers = await p.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => /^(sb-|off\.|caloriesrecord\.)/.test(k)));
  check(leftovers.length === 0, 'LOGOUT: localStorage/sessionStorage senza chiavi dell’utente ' + JSON.stringify(leftovers));
  await login(p);
  await p.getByText('Cibo di A').waitFor();
  check(true, 'dopo il logout, l’utente A rientra e vede solo i suoi dati');
  await p.getByRole('link', { name: 'Profilo', exact: true }).click();
  await p.getByRole('button', { name: 'Esci' }).click();
  await p.getByRole('heading', { name: 'Accedi' }).waitFor();

  // Registrazione con la stessa email: già esistente
  // Elimina account del nuovo utente
  await p.getByLabel('Email').fill(NEW);
  await p.getByLabel('Password', { exact: true }).fill('password-di-prova');
  // il mock di login accetta solo gli utenti noti: si entra col token del nuovo utente
  USERS.nuovo = { id: newId, email: NEW };
  await p.getByRole('button', { name: 'Accedi' }).click();
  await p.getByRole('heading', { name: 'Oggi' }).waitFor({ timeout: 8000 });
  await p.goto('http://localhost:4180/profilo');
  const del = p.getByRole('button', { name: 'Elimina account e dati' });
  check(await del.isDisabled(), 'ELIMINA: pulsante disattivato finché non scrivi ELIMINA');
  await p.getByLabel('Scrivi ELIMINA per confermare').fill('elimina');
  check(await del.isDisabled(), 'minuscolo non basta');
  await p.getByLabel('Scrivi ELIMINA per confermare').fill('ELIMINA');
  await p.screenshot({ path: test.info().outputPath('step18-profilo.png'), fullPage: true });
  await del.click();
  await p.getByRole('heading', { name: 'Accedi' }).waitFor({ timeout: 8000 });
  const gone = sql(`select (select count(*) from auth.users where id='${newId}') + (select count(*) from public.profiles where user_id='${newId}') + (select count(*) from public.weight_logs where user_id='${newId}') + (select count(*) from public.daily_targets where user_id='${newId}')`);
  check(gone === '0', 'ACCETTAZIONE: account eliminato con tutti i suoi dati (delete_my_account)');
  check(aRows() === aBefore, 'ACCETTAZIONE: i dati di A sono intatti (' + aRows() + ')');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await b.close();
});
