import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
const T = "(now() at time zone 'Europe/Rome')::date";

test('Step 7 · peso', async () => {
  resetDatabase();

  sql("delete from public.meal_entries; delete from public.daily_targets; delete from public.weight_logs; delete from public.profiles");
  sql(`insert into public.profiles (user_id, sports, tutorial_done_at, sex, birth_date, height_cm, goal_weight_kg)values ('${A}',jsonb_build_array('Palestra','Calcio'), now(),'male','2006-01-15',180,80)`);
  // 3 pesate: niente media
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) select '${A}', ${T} - g, 75 + g*0.1 from generate_series(0,2) g`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);

  await p.getByRole('button', { name: '75 kg' }).click();
  await p.getByRole('link', { name: 'Vedi l’andamento del peso' }).click();
  await p.getByRole('heading', { name: 'Peso', exact: true }).waitFor();
  check(await p.getByText('Conta la tendenza, non la singola pesata.').first().isVisible(), 'nota fissa "Conta la tendenza"');
  const stats3 = (await p.locator('dl').first().textContent()).replace(/\s+/g, ' ');
  check(stats3.includes('servono 4 pesate') && stats3.includes('servono 10 pesate'), 'ACCETTAZIONE: con 3 pesate niente media né pendenza');
  check(await p.getByText(/3 pesate nel periodo: servono almeno 4/).first().isVisible(), 'testo alternativo: spiega che mancano dati');
  await p.locator('.recharts-symbols').first().waitFor();
  check((await p.locator('.recharts-symbols').count()) === 3 && (await p.locator('.recharts-line-curve').first().getAttribute('d')) === null, 'ACCETTAZIONE grafico: 3 punti, nessuna linea della media');

  // 28 giorni in salita di 0,25 kg/sett.
  sql("delete from public.weight_logs");
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) select '${A}', ${T} - g, round((75 + (27-g)*0.25/7)::numeric, 1) from generate_series(0,27) g`);
  await p.reload();
  await p.getByRole('heading', { name: 'Peso', exact: true }).waitFor();
  await p.locator('.recharts-line-curve').first().waitFor();
  const stats = (await p.locator('dl').first().textContent()).replace(/\s+/g, ' ');
  check(/\+0,2[4-6] kg\/sett\./.test(stats), 'pendenza ≈ +0,25 kg/sett.: ' + stats.match(/[+−-]?\d,\d+ kg\/sett\./)?.[0]);
  check(/Media 7 giorni\s*75,\d kg/.test(stats) || /Media 7 giorni\s*76,\d kg/.test(stats), 'media 7 giorni mostrata');
  check(/Al traguardo\s*\+\d,\d kg/.test(stats), 'distanza dal traguardo (80 kg) mostrata: ' + stats.match(/Al traguardo\s*\S+ kg/)?.[0]);
  check(await p.getByText(/Media in salita di/).first().isVisible(), 'testo alternativo: "Media in salita di …"');
  check((await p.locator('.recharts-reference-line').count()) === 1, 'linea del traguardo nel grafico');
  await p.screenshot({ path: test.info().outputPath('step7-peso.png'), fullPage: true });
  await p.getByRole('button', { name: '3 mesi' }).click();
  await p.waitForTimeout(300);
  check(await p.getByRole('button', { name: '3 mesi' }).getAttribute('aria-pressed') === 'true', 'periodo 3 mesi selezionabile');

  // ACCETTAZIONE: il BMR usa la media mobile
  sql("delete from public.weight_logs; delete from public.daily_targets");
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) select '${A}', ${T} - g, case when g = 0 then 80 else 74 end from generate_series(0,6) g`);
  await p.goto('http://localhost:4180/');
  await p.getByRole('region', { name: 'Riepilogo del giorno' }).waitFor();
  // media = (6·74 + 80)/7 = 74,857 → BMR 1778,57 → ·1,6 = 2845,7 → 2846 (con l'ultima pesata, 80 kg, sarebbe 2928)
  check(sql(`select maintenance_kcal from public.daily_targets where target_date = ${T}`) === '2846', 'ACCETTAZIONE: il BMR usa la media mobile (mantenimento 2846, non 2928)');
  sql("delete from public.weight_logs where weight_kg = 74 and log_date < " + T + " - 2; delete from public.daily_targets");
  await p.reload();
  await p.getByRole('region', { name: 'Riepilogo del giorno' }).waitFor();
  // 3 pesate (74, 74, 80): niente media → ultima pesata 80 → BMR 1830 → 2928
  check(sql(`select maintenance_kcal from public.daily_targets where target_date = ${T}`) === '2928', 'ACCETTAZIONE: senza media usa l’ultima pesata (2928)');

  // Eliminare una pesata
  await p.goto('http://localhost:4180/peso');
  await p.getByRole('button', { name: /^Elimina la pesata del/ }).first().click();
  await p.getByRole('button', { name: 'Elimina', exact: true }).click();
  await p.waitForTimeout(800);
  check(sql("select count(*) from public.weight_logs") === '2', 'pesata eliminata in due tocchi');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
