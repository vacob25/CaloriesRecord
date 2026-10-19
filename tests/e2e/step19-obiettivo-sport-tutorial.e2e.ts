import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
// Step 19: obiettivo (cut), sport → tipi di giorno, tutorial a popup.

test('Step 19 · obiettivo, sport, tutorial', async () => {
  resetDatabase();

  sql("delete from public.meal_entries; delete from public.daily_targets; delete from public.weight_logs");
  seedProfile();
  const A = '00000000-0000-0000-0000-00000000000a';
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}', (now() at time zone 'Europe/Rome')::date, 75) on conflict do nothing`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  const card = p.getByRole('region', { name: 'Riepilogo del giorno' });
  await card.waitFor();

  // Tipi di giorno dagli sport del profilo (Palestra + Calcio).
  await p.getByRole('button', { name: /Giorno:/ }).click();
  for (const name of ['Riposo', 'Palestra', 'Calcio']) {
    check(await p.getByRole('button', { name, exact: true }).count() === 1, `scelta del giorno "${name}" disponibile`);
  }
  await p.getByRole('button', { name: 'Palestra', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Palestra ▴/ }).waitFor();
  await p.getByRole('button', { name: 'Calcio', exact: true }).click();
  await p.getByRole('button', { name: /Giorno: Palestra \+ calcio/ }).waitFor();
  check(sql("select training_type from public.daily_targets order by target_date desc limit 1") === 'sport_1+sport_2', 'Palestra poi Calcio: salvato come sport_1+sport_2');

  // Obiettivo: cut con peso obiettivo richiesto.
  await p.getByRole('link', { name: 'Profilo', exact: true }).click();
  const goalSection = p.locator('[data-tour="profile-goal"]');
  await goalSection.waitFor();
  await goalSection.getByText('Definizione (cut)').click();
  sql("update public.profiles set goal_weight_kg = null");
  await p.reload();
  await goalSection.getByText('Definizione (cut)').click();
  check((await goalSection.textContent()).includes('serve un peso obiettivo'), 'cut senza peso obiettivo: avviso che serve');
  sql("update public.profiles set goal_weight_kg = 80");
  await p.reload();
  await goalSection.getByText('Definizione (cut)').click();
  await p.getByRole('button', { name: 'Salva obiettivo e sport' }).click();
  check((await goalSection.locator('p:has-text("⚠︎")').count()) >= 1, 'cut con peso obiettivo sopra il peso attuale: rifiutato');
  check(sql("select goal from public.profiles") === 'bulk', 'niente salvato dopo il rifiuto');
  sql("update public.profiles set goal_weight_kg = 70");
  await p.reload();
  await goalSection.getByText('Definizione (cut)').click();
  await p.getByRole('button', { name: 'Salva obiettivo e sport' }).click();
  await p.getByText('Salvato. Vale da oggi').first().waitFor();
  check(sql("select goal||' '||cut_rate_pct||' '||goal_weight_kg from public.profiles") === 'cut 0.005 70.0', 'cut salvato: ritmo graduale 0,5%, peso obiettivo 70');
  // Oggi: target = mantenimento − deficit (75 kg · 0,5% · 7700 / 7 = 412,5 kcal) + bonus palestra+calcio (281 + 450 = 731 a 75 kg), arrotondato a 10.
  const t = sql("select maintenance_kcal||' '||target_kcal||' '||training_type from public.daily_targets order by target_date desc limit 1").split(' ');
  const expected = Math.round((Number(t[0]) - 412.5 + 731) / 10) * 10;
  check(Number(t[1]) === expected && t[2] === 'sport_1+sport_2', `target cut ricalcolato oggi: ${t[0]} − 412,5 + 731 → ${expected} (trovato ${t[1]})`);

  // Sport: tolgo Calcio → restano Riposo e Palestra.
  await p.getByRole('button', { name: 'Togli Calcio' }).click();
  await p.getByRole('button', { name: 'Salva obiettivo e sport' }).click();
  await p.getByText('Salvato. Vale da oggi').first().waitFor();
  check(sql("select sports::text from public.profiles") === '["Palestra"]', 'sport salvati: solo Palestra');
  await p.getByRole('link', { name: 'Oggi', exact: true }).click();
  await card.waitFor();
  check(sql("select training_type from public.daily_targets order by target_date desc limit 1") === 'sport_1', 'giorno Palestra + calcio senza più Calcio → resta Palestra');
  await p.getByRole('button', { name: /Giorno:/ }).click();
  check(await p.getByRole('button', { name: 'Calcio', exact: true }).count() === 0, 'Calcio non è più tra i tipi di giorno');

  // Tutorial: si apre da solo se non è stato visto, 1/8 → 8/8.
  sql("update public.profiles set tutorial_done_at = null");
  await p.reload();
  const dlg = p.getByRole('dialog', { name: 'Tutorial' });
  await dlg.waitFor();
  check((await dlg.textContent()).includes('1/8'), 'tutorial: parte da 1/8');
  await p.waitForTimeout(500);
  check(await p.locator("[data-tour-active='true']").count() === 1, 'tutorial: un solo elemento evidenziato');
  check(await dlg.getByRole('button', { name: 'Indietro' }).isDisabled(), 'tutorial: "Indietro" disattivato al primo passo');
  for (let i = 2; i <= 8; i++) {
    await dlg.getByRole('button', { name: 'Avanti' }).click();
    await p.waitForFunction((n) => document.querySelector('[role=dialog][aria-label=Tutorial]')?.textContent.includes(n + '/8'), i);
  }
  check(p.url().endsWith('/profilo'), 'tutorial: l’ultimo passo porta nel Profilo');
  await p.screenshot({ path: test.info().outputPath('step19-tutorial-8.png') });
  await dlg.getByRole('button', { name: 'Fine' }).click();
  await dlg.waitFor({ state: 'detached' });
  check(sql("select tutorial_done_at is not null from public.profiles") === 't', 'tutorial: "Fine" lo segna come visto');
  await p.reload();
  await p.getByRole('heading', { name: 'Profilo', exact: true, level: 1 }).waitFor();
  check(await dlg.count() === 0, 'tutorial: non si riapre da solo');
  await p.getByRole('button', { name: 'Rivedi il tutorial' }).click();
  await dlg.waitFor();
  check((await dlg.textContent()).includes('1/8'), 'Rivedi il tutorial: riparte da 1/8');
  await dlg.getByRole('button', { name: 'Salta' }).click();
  await dlg.waitFor({ state: 'detached' });

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
