import { defineConfig } from '@playwright/test'

/**
 * Test end-to-end (README in questa cartella). L'app è la build di produzione con un URL di Supabase finto
 * (`npm run build:e2e`), servita da `vite preview`; Postgres e PostgREST li avvia chi lancia i test (o la CI).
 * I test condividono un solo database: girano uno alla volta.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report' }]] : 'list',
  outputDir: '../../test-results',
  // Come negli script originali: ogni attesa al massimo 30 s, così un errore dice quale passo non è arrivato.
  use: { trace: 'retain-on-failure', actionTimeout: 30_000, navigationTimeout: 30_000 },
  webServer: {
    command: 'npx vite preview --outDir dist-e2e --port 4180 --strictPort',
    cwd: '../..',
    url: 'http://localhost:4180',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
