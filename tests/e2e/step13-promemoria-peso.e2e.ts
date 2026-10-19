import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
const T = "(now() at time zone 'Europe/Rome')::date";

test('Step 13 · promemoria del peso', async () => {
  resetDatabase();

  sql("delete from public.tdee_estimates; delete from public.meal_entries; delete from public.daily_targets; delete from public.weight_logs; delete from public.profiles");
  sql(`insert into public.profiles (user_id, sports, tutorial_done_at, sex, birth_date, height_cm)values ('${A}',jsonb_build_array('Palestra','Calcio'), now(),'male','2006-01-15',180)`);
  // 5 giorni prima: 75,0 (T-9) e 75,2 (T-6); ultima pesata 6 giorni fa.
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}', ${T} - 9, 75.0), ('${A}', ${T} - 6, 75.2)`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await login(p);
  const reminder = p.getByRole('region', { name: 'Promemoria peso' });
  await reminder.waitFor();
  check((await reminder.textContent()).includes('Ultima pesata: 6 giorni fa'), 'promemoria: "Pesati oggi · Ultima pesata: 6 giorni fa"');
  await p.screenshot({ path: test.info().outputPath('step13-promemoria.png') });
  await reminder.getByRole('button', { name: 'Registra peso' }).click();
  await p.getByLabel('Peso', { exact: true }).fill('75,6');
  await p.getByRole('dialog').getByRole('button', { name: 'Salva' }).click();
  await reminder.waitFor({ state: 'detached', timeout: 8000 });
  check(true, 'ACCETTAZIONE: registrato il peso, il promemoria sparisce');

  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) values ('${A}', ${T} - 2, 75.4)`);
  await p.getByRole('link', { name: 'Statistiche' }).click();
  await p.getByRole('link', { name: /^Peso/ }).click();
  await p.getByRole('heading', { name: 'Peso', exact: true }).waitFor();
  check(true, 'Statistiche → Peso: la voce si trova anche da lì');
  const recent = (await p.getByRole('region', { name: 'Ultimi 5 giorni' }).textContent()).replace(/\s+/g, ' ');
  // Ultimi 5 giorni: 75,4 (T-2) e 75,6 (oggi) → media 75,5; 5 giorni prima (T-9..T-5): 75,0 e 75,2 → 75,1; variazione +0,4
  check(/2 pesate, media 75,5 kg/.test(recent) && /\+0,4 kg rispetto ai 5 giorni prima/.test(recent), 'ACCETTAZIONE: riepilogo a mano: 2 pesate, media 75,5, +0,4 kg → ' + recent);
  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});
