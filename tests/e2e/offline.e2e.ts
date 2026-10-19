import { chromium, test } from '@playwright/test'

import { check, login, resetDatabase, seedProfile, wire } from './support/harness'

test('Senza rete · avviso', async () => {
  resetDatabase();

  seedProfile();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await wire(ctx);
  const p = await ctx.newPage();
  await login(p);
  check(!(await p.getByText(/Serve la connessione: i dati/).isVisible()), 'online: nessun banner');
  await ctx.setOffline(true);
  await p.getByText(/Serve la connessione: i dati/).waitFor();
  check(true, 'offline: banner "Serve la connessione" in tutte le schermate');
  await ctx.setOffline(false);
  await p.waitForTimeout(300);
  check(!(await p.getByText(/Serve la connessione: i dati/).isVisible()), 'torna la rete: banner sparito');
  await b.close();
});
