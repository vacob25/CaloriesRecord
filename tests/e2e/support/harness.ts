// Collega l'app (build con URL di Supabase finto) a PostgREST + Postgres locali con le migrazioni vere.
// L'autenticazione di Supabase è simulata qui: login con password, registrazione (con la hook vera della migrazione 005),
// lettura dell'utente e logout. Nessun segreto reale e nessun accesso al progetto Supabase reale.
import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

import { expect, type BrowserContext, type Page } from '@playwright/test'

/** Uguale al `PGRST_JWT_SECRET` con cui si avvia PostgREST nei test (vedi tests/e2e/README.md). Non è un segreto. */
export const JWT_SECRET = process.env.E2E_JWT_SECRET ?? 'segreto-solo-per-i-test-locali-0123456789'
const SUPABASE_URL = 'https://progetto-finto.supabase.co'
const REST_URL = process.env.E2E_REST_URL ?? 'http://localhost:3001'
export const APP_URL = 'http://localhost:4180'
export const PASSWORD = 'password-di-prova'

interface TestUser {
  id: string
  email: string
}

/** Due utenti FITTIZI fissi: A ha il profilo di esempio di DOMAIN_RULES, B serve per i controlli tra utenti. */
export const USERS: Record<string, TestUser> = {
  a: { id: '00000000-0000-0000-0000-00000000000a', email: 'utente@example.com' },
  b: { id: '00000000-0000-0000-0000-00000000000b', email: 'altro@example.com' },
}

/** Corpo delle registrazioni ricevute dalla finta Auth (lo controlla il test dello step 18). */
export const signups: { email: string; password: string; data?: Record<string, unknown> }[] = []

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

function jwt(user: TestUser): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

/** Letterale SQL sicuro per i valori di prova. */
export const lit = (value: unknown) => `'${String(value).replace(/'/g, "''")}'`

/**
 * Esegue SQL sul database dei test con psql (variabili PGHOST, PGPORT, PGUSER, PGPASSWORD dell'ambiente) e restituisce
 * il risultato senza intestazioni. Solo per preparare e controllare i dati di prova.
 */
export function sql(query: string): string {
  return execFileSync('psql', ['-At', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    env: { ...process.env, PGDATABASE: process.env.E2E_DATABASE ?? 'e2e' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString()
    .trim()
}

/** Controllo con etichetta in italiano: non ferma il test, ma lo fa fallire alla fine (expect.soft). */
export function check(condition: unknown, label: string): void {
  expect.soft(Boolean(condition), label).toBe(true)
}

const sessionBody = (user: TestUser, metadata: Record<string, unknown> = {}) => {
  const now = Math.floor(Date.now() / 1000)
  return JSON.stringify({
    access_token: jwt(user),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `r-${user.id}`,
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: metadata, created_at: '2026-01-01T00:00:00Z' },
  })
}

/** Instrada le chiamate dell'app: REST → PostgREST locale, Auth → simulazione qui sotto. */
export async function wire(ctx: BrowserContext): Promise<void> {
  await ctx.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const request = route.request()
    const url = request.url().replace(`${SUPABASE_URL}/rest/v1`, REST_URL)
    const headers = { ...request.headers() }
    delete headers.host
    const response = await route.fetch({ url, headers })
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' },
    })
  })
  await ctx.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password') {
      const body = request.postDataJSON() as { email: string; password: string }
      const user = Object.values(USERS).find((candidate) => candidate.email === body.email)
      if (!user || body.password !== PASSWORD) {
        return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      }
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: sessionBody(user) })
    }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors })
    // Registrazione (step 18): come Supabase, prima di creare l'utente si chiama la hook vera della migrazione 005.
    if (url.pathname.endsWith('/signup')) {
      const body = request.postDataJSON() as { email: string; password: string; data?: Record<string, unknown> }
      signups.push(body)
      const hook = JSON.parse(
        sql(`set role supabase_auth_admin; select public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', ${lit(body.email)})))`)
          .split('\n')
          .pop() ?? '{}',
      ) as { error?: { http_code: number; message: string } }
      if (hook.error) return json(hook.error.http_code, { code: hook.error.http_code, msg: hook.error.message })
      const email = body.email.toLowerCase()
      if (sql(`select count(*) from auth.users where email = ${lit(email)}`) !== '0') {
        return json(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' })
      }
      const id = randomUUID()
      sql(`insert into auth.users (id, email, aud, role) values ('${id}', ${lit(email)}, 'authenticated', 'authenticated')`)
      const user = { id, email }
      USERS[id] = user
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: sessionBody(user, body.data ?? {}) })
    }
    if (url.pathname.endsWith('/user') && request.method() === 'GET') {
      const token = (request.headers().authorization ?? '').replace('Bearer ', '')
      const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? 'e30', 'base64url').toString()) as { sub?: string; email?: string }
      return json(200, { id: payload.sub, aud: 'authenticated', role: 'authenticated', email: payload.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
    }
    return json(404, {})
  })
}

export async function login(page: Page, who = 'a'): Promise<void> {
  const user = USERS[who]
  if (!user) throw new Error(`utente di prova sconosciuto: ${who}`)
  await page.goto(`${APP_URL}/login`)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.getByRole('heading', { name: 'Oggi', exact: true }).waitFor({ timeout: 8000 })
}

/**
 * Database pulito prima di ogni test: via i dati di tutte le tabelle dell'app e gli utenti registrati dai test,
 * restano solo i due utenti fissi (senza profilo). Ogni test prepara poi i propri dati.
 */
export function resetDatabase(): void {
  sql(`truncate public.water_entries, public.drink_containers, public.meal_entries, public.recipe_items, public.foods,
    public.daily_targets, public.weight_logs, public.tdee_estimates, public.meal_slots, public.profiles, public.allowed_emails`)
  sql(`delete from auth.users where id not in ('${USERS.a!.id}', '${USERS.b!.id}')`)
  sql(`insert into auth.users (id, email, aud, role) values
    ('${USERS.a!.id}', ${lit(USERS.a!.email)}, 'authenticated', 'authenticated'),
    ('${USERS.b!.id}', ${lit(USERS.b!.email)}, 'authenticated', 'authenticated')
    on conflict do nothing`)
  for (const key of Object.keys(USERS)) if (key !== 'a' && key !== 'b') delete USERS[key]
  signups.length = 0
}

/** Profilo FITTIZIO di DOMAIN_RULES (uomo, 180 cm, nato il 15/1/2006, 75 kg) per l'utente A, con una pesata oggi. */
export function seedProfile(): void {
  sql('delete from public.daily_targets; delete from public.weight_logs; delete from public.profiles')
  sql(`insert into public.profiles (user_id, sports, tutorial_done_at, sex, birth_date, height_cm)
    values ('${USERS.a!.id}', jsonb_build_array('Palestra', 'Calcio'), now(), 'male', '2006-01-15', 180)`)
  sql(`insert into public.weight_logs (user_id, log_date, weight_kg)
    values ('${USERS.a!.id}', (now() at time zone 'Europe/Rome')::date, 75)`)
}
