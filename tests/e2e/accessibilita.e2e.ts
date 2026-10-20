import { chromium, test } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

import { check, login, resetDatabase, seedProfile, sql, wire } from './support/harness'
// Controllo accessibilità (axe-core, WCAG 2.1 A/AA) e aree toccabili ≥ 44 px su ogni schermata.
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a';

test('Accessibilità · axe su tutte le schermate', async () => {
  resetDatabase();

  seedProfile();
  sql("delete from public.meal_entries; delete from public.recipe_items; delete from public.foods; delete from public.tdee_estimates");
  sql(`insert into public.foods (user_id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, is_favorite, last_used_at) values ('${A}','Pasta',350,12,72,1.5,true,now())`);
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g) values ('${A}',(now() at time zone 'Europe/Rome')::date,'lunch','Pasta',100,350,12,72,1.5)`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  async function audit(name) {
    await p.waitForTimeout(800);
    await p.addScriptTag({ content: AXE });
    const res = await p.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')) }));
    });
    const small = await p.evaluate(() =>
      [...document.querySelectorAll('a, button, [role=tab], label:has(input[type=radio]), summary')]
        .filter((el) => el.offsetParent !== null && !el.closest('.sr-only'))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 44))
        .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    check(res.length === 0, `${name}: nessuna violazione WCAG 2.1 A/AA (${res.map((v) => `${v.id}: ${v.nodes.join(' | ')}`).join('; ')})`);
    check(small.length === 0, `${name}: aree toccabili almeno 44 px (${small.join('; ')})`);
  }
  await p.goto('http://localhost:4180/login'); await audit('login');
  await p.goto('http://localhost:4180/registrati'); await audit('registrati');
  await p.goto('http://localhost:4180/privacy'); await audit('privacy');
  await login(p); await audit('oggi');
  await p.getByRole('button', { name: /Imposta un obiettivo/ }).click(); await audit('oggi: obiettivo acqua'); await p.getByRole('button', { name: 'Chiudi' }).click();
  await p.getByRole('button', { name: 'Gestisci i pasti' }).click(); await audit('oggi: pasti su misura'); await p.getByRole('button', { name: 'Chiudi' }).click();
  await p.getByRole('button', { name: 'Giorno precedente' }).click(); await audit('ieri'); await p.getByRole('button', { name: 'Torna a oggi' }).click();
  await p.getByRole('button', { name: /^Pasta/ }).click(); await audit('oggi: modifica voce'); await p.getByRole('button', { name: 'Chiudi' }).click();
  for (const [path, name] of [['/aggiungi', 'aggiungi'], ['/cibi', 'cibi'], ['/cibi/nuovo', 'nuovo cibo'], ['/cibi/ricette/nuova', 'nuova ricetta'], ['/palestra', 'palestra'], ['/palestra/allenamento/nuovo', 'inizia allenamento'], ['/palestra/allenamenti', 'allenamenti'], ['/palestra/schede', 'schede'], ['/palestra/schede/nuova', 'nuova scheda'], ['/palestra/esercizi', 'esercizi'], ['/palestra/esercizi/nuovo', 'nuovo esercizio'], ['/statistiche', 'statistiche'], ['/peso', 'peso'], ['/profilo', 'profilo'], ['/aggiungi/scanner', 'scanner']]) {
    await p.goto('http://localhost:4180' + path); await audit(name);
  }
  sql("update public.profiles set goal = 'cut', goal_weight_kg = 70");
  await p.goto('http://localhost:4180/profilo'); await audit('profilo (cut)');
  sql("update public.profiles set tutorial_done_at = null");
  await p.goto('http://localhost:4180/'); await p.getByRole('dialog', { name: 'Tutorial' }).waitFor(); await audit('oggi con tutorial');
  sql("delete from public.profiles");
  await p.goto('http://localhost:4180/benvenuto'); await audit('benvenuto passo 1');
  await p.getByText('Uomo', { exact: true }).click();
  await p.getByLabel('Data di nascita').fill('2000-06-15');
  await p.getByLabel('Altezza').fill('170');
  await p.getByLabel('Peso di oggi').fill('65');
  await p.getByRole('button', { name: 'Avanti' }).click();
  await p.getByText('Definizione (cut)').click();
  await audit('benvenuto passo 2 (cut)');
  await p.getByLabel('Peso che vuoi raggiungere').fill('60');
  await p.getByRole('button', { name: 'Avanti' }).click();
  await p.getByLabel('Nome dello sport').fill('Palestra'); await p.getByRole('button', { name: 'Aggiungi' }).click();
  await audit('benvenuto passo 3');
  await b.close();
});
