import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, sql, wire } from './support/harness'
const A = '00000000-0000-0000-0000-00000000000a';
const T = "(now() at time zone 'Europe/Rome')::date";
function seed({ days = 28, slopeWeek = 0.1, intake = 3200 }) {
  sql("delete from public.tdee_estimates; delete from public.meal_entries; delete from public.daily_targets; delete from public.weight_logs; delete from public.profiles");
  sql(`insert into public.profiles (user_id, sports, tutorial_done_at, sex, birth_date, height_cm)values ('${A}',jsonb_build_array('Palestra','Calcio'), now(),'male','2006-01-15',180)`);
  // Giorni d'uso: da T - days a T - 1, una voce al giorno e il target 3130; una pesata al giorno con la pendenza voluta.
  sql(`insert into public.daily_targets (user_id, target_date, training_type, target_kcal, protein_g, carbs_g, fat_g, maintenance_kcal) select '${A}', ${T} - g, 'rest', 3130, 150, 464, 75, 2848 from generate_series(1, ${days}) g`);
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) select '${A}', ${T} - g, 'lunch', 'Pasta', 500, ${intake}, 150, 460, 75 from generate_series(1, ${days}) g`);
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg) select '${A}', ${T} - g, round((75 + (${days} - g) * ${slopeWeek} / 7)::numeric, 1) from generate_series(0, ${days}) g`);
}

test('Step 10 · ricalibrazione', async () => {
  resetDatabase();

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  // 1) Proposta (+0,10 kg/sett., sotto la banda) → Accetta
  seed({ slopeWeek: 0.1 });
  await login(p);
  await p.getByRole('link', { name: 'Nuova proposta di ricalibrazione' }).waitFor({ timeout: 10000 });
  check(sql("select count(*)||' '||status from public.tdee_estimates group by status") === '1 pending', 'prima apertura della settimana: una proposta salvata (pending)');
  const todayTarget = sql(`select target_kcal||' '||maintenance_kcal from public.daily_targets where target_date = ${T}`);
  await p.getByRole('link', { name: 'Nuova proposta di ricalibrazione' }).click();
  const card = p.getByRole('region', { name: 'Ricalibrazione' });
  await card.getByText(/Proposta: mantenimento/).waitFor();
  const text = (await card.textContent()).replace(/\s+/g, ' ');
  const current = Number(text.match(/Attuale: ([\d.]+) kcal/)[1].replace('.', ''));
  const proposed = Number(text.match(/Proposta: mantenimento ([\d.]+) kcal/)[1].replace('.', ''));
  check(/in media 3\.200 kcal/.test(text) && /\+0,1\d? kg\/settimana/.test(text), 'la scheda spiega i numeri: media 3.200 kcal e pendenza ≈ +0,10 kg/sett.');
  check(proposed === Math.floor((current * 1.05) / 10) * 10 && proposed <= current * 1.05, `ACCETTAZIONE: stimato ≈ 3090 > tetto +5% → proposto ${proposed} = multiplo di 10 sotto il tetto (${current} · 1,05, mai oltre)`);
  await card.getByRole('button', { name: 'Accetta' }).click();
  await card.getByText(/accettata: vale da domani/).waitFor();
  const factor = Number(sql("select activity_factor from public.profiles"));
  const bmr = 10 * Number(sql(`select round(avg(weight_kg), 4) from public.weight_logs where log_date > ${T} - 7`)) + 6.25 * 180 - 5 * 20 + 5;
  check(Math.abs(factor * bmr - proposed) < 3 && factor !== 1.6, `ACCETTAZIONE: activity_factor = proposto / BMR attuale = ${factor}`);
  check(sql(`select target_kcal||' '||maintenance_kcal from public.daily_targets where target_date = ${T}`) === todayTarget, 'ACCETTAZIONE: il target di oggi non cambia (vale da domani)');
  check(sql("select status from public.tdee_estimates") === 'accepted', 'proposta segnata come accettata');
  await p.reload();
  await card.getByText(/accettata/).waitFor();
  check(sql("select count(*) from public.tdee_estimates") === '1', 'al massimo una proposta a settimana: riaprendo non se ne crea un’altra');

  // 2) Rifiuta → niente cambia
  seed({ slopeWeek: 0.6 });
  await p.goto('http://localhost:4180/profilo');
  await card.getByText(/Proposta: mantenimento/).waitFor({ timeout: 10000 });
  check(await card.getByText(/l’eccesso è soprattutto grasso/).isVisible(), '+0,60 kg/sett.: avviso che l’eccesso è soprattutto grasso');
  await card.getByRole('button', { name: 'Rifiuta' }).click();
  await card.getByText(/rifiutata/).waitFor();
  check(sql("select activity_factor||' '||(select status from public.tdee_estimates) from public.profiles") === '1.600 rejected', 'ACCETTAZIONE: rifiutare non cambia nulla');

  // 3) In banda
  seed({ slopeWeek: 0.28 });
  await p.goto('http://localhost:4180/profilo');
  await card.getByText(/Sei nel ritmo voluto/).waitFor({ timeout: 10000 });
  check(sql("select status||' '||coalesce(proposed_maintenance_kcal::text,'NULL') from public.tdee_estimates") === 'none NULL', 'ACCETTAZIONE: pendenza in banda → nessuna proposta');

  // 4) Pochi dati
  seed({ days: 12 });
  await p.goto('http://localhost:4180/profilo');
  await card.getByText('Servono più dati.').waitFor({ timeout: 10000 });
  const reasons = (await card.textContent()).replace(/\s+/g, ' ');
  check(reasons.includes('almeno 21 giorni di uso (ora 12)'), 'ACCETTAZIONE: < 21 giorni → "servono più dati" con il motivo');
  check(sql("select status from public.tdee_estimates") === 'none', 'nessuna proposta salvata');
  await p.goto('http://localhost:4180/');
  await p.getByRole('region', { name: 'Riepilogo del giorno' }).waitFor();
  check(!(await p.getByRole('link', { name: 'Nuova proposta di ricalibrazione' }).isVisible()), 'senza proposta nessun avviso in Oggi');

  check(errs.length === 0, 'nessun errore JS: ' + JSON.stringify(errs));
  await b.close();
});

// Revisione #11: lunedì mancavano i dati (riga "nessuna"), giovedì la pendenza è fuori banda → la proposta compare.
test('Step 10 · riga "nessuna" di inizio settimana e poi una proposta', async () => {
  resetDatabase();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  seed({ slopeWeek: 0.6 });
  sql(`insert into public.tdee_estimates (user_id, week_start, window_days, status) values ('${A}', date_trunc('week', ${T})::date, 21, 'none')`);
  await login(p);
  await p.goto('http://localhost:4180/profilo');
  const card = p.getByRole('region', { name: 'Ricalibrazione' });
  await card.getByText(/Proposta: mantenimento/).waitFor({ timeout: 10000 });
  check(!(await card.getByText(/Sei nel ritmo voluto/).isVisible()), 'con pendenza fuori banda la scheda non dice "Sei nel ritmo voluto"');
  check(sql("select count(*)||' '||status from public.tdee_estimates group by status") === '1 pending', 'la riga della settimana è diventata la proposta (una sola riga, in attesa)');
  check(sql("select proposed_maintenance_kcal is not null from public.tdee_estimates") === 't', 'la proposta ha il mantenimento proposto');
  await p.reload();
  await card.getByText(/Proposta: mantenimento/).waitFor();
  check(sql("select count(*) from public.tdee_estimates") === '1', 'riaprendo non nascono altre righe');
  await b.close();
});
