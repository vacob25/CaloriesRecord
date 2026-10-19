import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
// Correzione #18 (migrazione 009): sport azzerati, scelta alla prossima apertura, target di riposo nel frattempo.

test('Step 24 · sport azzerati da scegliere (correzione #18)', async () => {
  resetDatabase();

  sql("delete from public.daily_targets; delete from public.weight_logs");
  seedProfile();
  const today = sql("select (now() at time zone 'Europe/Rome')::date");
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}','${today}',75) on conflict do nothing`);
  // Stato prima della 009: Palestra + Calcio messi dalla 006 e il target di oggi con i due sport.
  sql(`update public.profiles set sports = '["Palestra", "Calcio"]'::jsonb, sports_choice_pending = false`);
  sql(`insert into public.daily_targets (user_id, target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal) values ('${A}','${today}','sport_1+sport_2',3860,150,75,640,2848), ('${A}',(date '${today}' - 1),'sport_1',3410,150,75,530,2848)`);
  // La parte della 009 che azzera (la colonna esiste già in locale).
  sql(`with reset as (update public.profiles set sports = '[]'::jsonb, sports_choice_pending = true where sports = '["Palestra", "Calcio"]'::jsonb returning user_id) delete from public.daily_targets as t using reset as r where t.user_id = r.user_id and t.target_date >= (now() at time zone 'Europe/Rome')::date`);
  check(sql("select sports::text || ' ' || sports_choice_pending from public.profiles") === '[] true', '009: sport azzerati e scelta in attesa');
  check(sql(`select count(*) from public.daily_targets where target_date = '${today}'`) === '0', '009: target di oggi tolto');
  check(sql(`select target_kcal from public.daily_targets where target_date < '${today}'`) === '3410', '009: i giorni passati restano come erano');

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  const sheet = p.getByRole('dialog', { name: 'Scegli i tuoi sport' });
  await sheet.waitFor();
  check(true, 'alla prima apertura dopo la 009 il pannello si apre da solo');
  check((await sheet.textContent()).includes('Finché non scegli, ogni giorno conta come riposo'), 'il pannello spiega cosa succede al target');
  const close = await sheet.getByRole('button', { name: 'Più tardi' }).boundingBox();
  check(close && close.y + close.height <= 667, 'su uno schermo piccolo (iPhone SE) si arriva a "Più tardi"');
  await p.screenshot({ path: test.info().outputPath('fix18-pannello.png') });
  await sheet.getByRole('button', { name: 'Più tardi' }).click();
  await sheet.waitFor({ state: 'detached' });
  const notice = p.getByRole('region', { name: 'Sport da scegliere' });
  check(await notice.isVisible(), 'dopo "Più tardi" resta l’avviso in Oggi');
  // Target ricreato come riposo: 3130 con il profilo di esempio, niente calorie di sport.
  const card = p.getByRole('region', { name: 'Riepilogo del giorno' });
  await card.getByText('3.130 kcal').first().waitFor();
  check(sql(`select training_type || ' ' || target_kcal from public.daily_targets where target_date = '${today}'`) === 'rest 3130', 'nel frattempo oggi è riposo: 3130 kcal, senza calorie di sport');
  check((await card.textContent()).includes('aggiungi i tuoi sport'), 'il giorno mostra Riposo senza scelta di sport');
  // Navigando nell'app non si riapre da solo; riaprendo l'app sì.
  await p.getByRole('link', { name: 'Cibi', exact: true }).click();
  await p.getByRole('link', { name: 'Oggi', exact: true }).click();
  await notice.waitFor();
  check(await sheet.count() === 0, 'nella stessa apertura non si ripropone da solo');
  await p.reload();
  await sheet.waitFor();
  check(true, 'alla riapertura dell’app si ripropone');
  check((await sheet.getByRole('button', { name: 'Non faccio sport' }).count()) === 1, 'senza sport il pulsante dice "Non faccio sport"');
  await sheet.getByLabel('Nome dello sport').fill('Nuoto');
  await sheet.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await sheet.getByRole('button', { name: 'Salva i miei sport' }).click();
  await sheet.waitFor({ state: 'detached' });
  await notice.waitFor({ state: 'detached' });
  check(sql("select sports::text || ' ' || sports_choice_pending from public.profiles") === '["Nuoto"] false', 'sport scelti salvati, richiesta chiusa');
  await p.getByRole('button', { name: /Giorno:/ }).click();
  check(await p.getByRole('button', { name: 'Nuoto', exact: true }).count() === 1, 'il nuovo sport si può segnare nel giorno');
  // "Non faccio sport"
  sql("update public.profiles set sports = '[]'::jsonb, sports_choice_pending = true");
  await p.reload();
  await sheet.waitFor();
  await sheet.getByRole('button', { name: 'Non faccio sport' }).click();
  await sheet.waitFor({ state: 'detached' });
  check(sql("select sports::text || ' ' || sports_choice_pending from public.profiles") === '[] false', '"Non faccio sport": nessuno sport, richiesta chiusa');
  // Il pannello non si apre sopra il tutorial
  sql("update public.profiles set sports_choice_pending = true, tutorial_done_at = null");
  await p.reload();
  await p.getByRole('dialog', { name: 'Tutorial' }).waitFor();
  check(await sheet.count() === 0, 'con il tutorial aperto il pannello degli sport non si sovrappone');
  sql("update public.profiles set sports_choice_pending = false, tutorial_done_at = now(), sports = '[\"Palestra\",\"Calcio\"]'::jsonb");
  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
