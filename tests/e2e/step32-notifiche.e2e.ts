import { readFileSync } from 'node:fs'

import { chromium, expect, test, type BrowserContext } from '@playwright/test'

import { sendTestPush } from '../../supabase/functions/_shared/sendTestPush'
import { APP_URL, check, login, lit, resetDatabase, seedProfile, sql, SUPABASE_URL, USERS, wire } from './support/harness'

// Fase 1 notifiche (ADR-086): sezione del Profilo, salvataggio della subscription con la RLS, prova, uscita.
// Il browser non ha un vero servizio push: PushManager e Notification sono simulati nella pagina, e la Edge Function
// è emulata eseguendo la STESSA logica (supabase/functions/_shared/sendTestPush.ts) con le subscription lette dal DB.

const ENDPOINT = 'https://push.example.test/dispositivo-di-prova-1'
const KEYS = { p256dh: 'p'.repeat(40), auth: 'a'.repeat(16) }

/** Simula service worker + Push + Notification nella pagina (con serviceWorkers: 'block' non ce n'è uno vero). */
const FAKE_PUSH = `
  (() => {
    let sub = null
    const makeSub = () => ({ endpoint: ${JSON.stringify(ENDPOINT)}, toJSON() { return { endpoint: ${JSON.stringify(ENDPOINT)}, keys: ${JSON.stringify(KEYS)} } }, async unsubscribe() { sub = null; return true } })
    const pushManager = { async getSubscription() { return sub }, async subscribe(options) { window.__subscribeOptions = options; sub = makeSub(); return sub } }
    const registration = { pushManager }
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(registration), async getRegistration() { return registration } }, configurable: true })
    window.PushManager = window.PushManager || function PushManager() {}
    // Il permesso sopravvive al ricaricamento come nel browser vero.
    window.Notification = { get permission() { return sessionStorage.getItem('perm') ?? 'default' }, async requestPermission() { const answer = window.__answer ?? 'granted'; sessionStorage.setItem('perm', answer); return answer } }
  })()
`

async function emulateFunction(ctx: BrowserContext, pushed: string[]) {
  await ctx.route(`${SUPABASE_URL}/functions/v1/send-test-push`, async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const token = (route.request().headers().authorization ?? '').replace('Bearer ', '')
    const sub = (JSON.parse(Buffer.from(token.split('.')[1] ?? 'e30', 'base64url').toString()) as { sub?: string }).sub ?? ''
    const result = await sendTestPush({
      // La funzione vera usa il client dell'utente (RLS); qui la stessa condizione scritta a mano.
      listSubscriptions: async () =>
        sql(`select endpoint || '|' || p256dh_key || '|' || auth_secret from public.push_subscriptions where user_id = ${lit(sub)}`)
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [endpoint = '', p256dh_key = '', auth_secret = ''] = line.split('|')
            return { endpoint, p256dh_key, auth_secret }
          }),
      send: async (target) => {
        pushed.push(target.endpoint)
        return { statusCode: 201 }
      },
      deleteSubscription: async (endpoint) => void sql(`delete from public.push_subscriptions where endpoint = ${lit(endpoint)}`),
    })
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(result) })
  })
}

test('Step 32 · notifiche: attiva, prova, disattiva, uscita', async () => {
  resetDatabase()
  seedProfile()
  const pushed: string[] = []

  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  await emulateFunction(ctx, pushed)
  await ctx.addInitScript(FAKE_PUSH)
  const p = await ctx.newPage()
  const errs: string[] = []
  p.on('pageerror', (e) => errs.push(e.message))
  await login(p)
  await p.getByRole('link', { name: 'Profilo', exact: true }).click()

  const section = p.getByRole('region', { name: 'Notifiche' })
  await section.getByRole('button', { name: 'Attiva le notifiche' }).waitFor()
  check(sql('select count(*) from public.push_subscriptions') === '0', 'prima dell’attivazione non c’è nessuna subscription')
  check(((await section.textContent()) ?? '').includes('mai peso, calorie o cibi'), 'la sezione dice che il testo non contiene dati personali')

  await section.getByRole('button', { name: 'Attiva le notifiche' }).click()
  await section.getByRole('button', { name: 'Invia notifica di prova' }).waitFor()
  check(sql(`select count(*) from public.push_subscriptions where user_id = '${USERS.a!.id}' and endpoint = ${lit(ENDPOINT)}`) === '1', 'la subscription è salvata per l’utente')
  const keyLength = await p.evaluate(() => (window as unknown as { __subscribeOptions: { applicationServerKey: Uint8Array; userVisibleOnly: boolean } }).__subscribeOptions)
  check(keyLength.userVisibleOnly === true, 'iscrizione con userVisibleOnly (obbligatorio su iOS)')
  check(Object.keys(keyLength.applicationServerKey).length === 65, 'la chiave VAPID pubblica arriva come 65 byte')

  await section.getByRole('button', { name: 'Invia notifica di prova' }).click()
  await section.getByText('Notifica inviata').waitFor()
  check(pushed.length === 1 && pushed[0] === ENDPOINT, 'la funzione ha spedito a questo dispositivo')

  // Un altro utente non ha nessuna riga di A: la RLS (verificata in supabase/checks/rls_two_users.sql) vale anche qui.
  check(sql(`select count(*) from public.push_subscriptions where user_id = '${USERS.b!.id}'`) === '0', 'l’altro utente non ha subscription')

  // Disattiva: riga cancellata, bottone di nuovo "Attiva".
  await section.getByRole('button', { name: 'Disattiva' }).click()
  await section.getByRole('button', { name: 'Attiva le notifiche' }).waitFor()
  check(sql('select count(*) from public.push_subscriptions') === '0', 'disattivando la riga sparisce')

  // Riattiva e poi esci: l'uscita toglie la subscription di questo dispositivo.
  await section.getByRole('button', { name: 'Attiva le notifiche' }).click()
  await section.getByRole('button', { name: 'Invia notifica di prova' }).waitFor()
  sql(`insert into public.push_subscriptions (user_id, endpoint, p256dh_key, auth_secret) values ('${USERS.a!.id}', 'https://push.example.test/altro-dispositivo', '${'q'.repeat(30)}', '${'z'.repeat(12)}')`)
  await p.getByRole('button', { name: 'Esci' }).click()
  await p.getByRole('button', { name: 'Accedi' }).waitFor()
  check(sql(`select string_agg(endpoint, ',') from public.push_subscriptions`) === 'https://push.example.test/altro-dispositivo', 'all’uscita sparisce solo la subscription di questo dispositivo')
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`)
  await b.close()
})

test('Step 32 · notifiche: permesso negato e iPhone non installata', async () => {
  resetDatabase()
  seedProfile()
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  await ctx.addInitScript(FAKE_PUSH)
  const p = await ctx.newPage()
  await login(p)
  await p.getByRole('link', { name: 'Profilo', exact: true }).click()
  const section = p.getByRole('region', { name: 'Notifiche' })
  await p.evaluate(() => { (window as unknown as { __answer: string }).__answer = 'denied' })
  await section.getByRole('button', { name: 'Attiva le notifiche' }).click()
  await section.getByText('Permesso negato').waitFor()
  check(sql('select count(*) from public.push_subscriptions') === '0', 'permesso negato: nessuna subscription salvata')
  await p.reload()
  await p.getByRole('region', { name: 'Notifiche' }).getByText('Impostazioni di iPhone → Notifiche → Calorie').waitFor()
  check(true, 'dopo il rifiuto la sezione spiega dove riattivare il permesso')
  await ctx.close()

  // iPhone con Safari (non installata): niente PushManager, la sezione spiega come installare l'app.
  const ios = await b.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })
  await wire(ios)
  const q = await ios.newPage()
  await login(q)
  await q.getByRole('link', { name: 'Profilo', exact: true }).click()
  await q.getByRole('region', { name: 'Notifiche' }).getByText('Aggiungi alla schermata Home').waitFor()
  check((await q.getByRole('button', { name: 'Attiva le notifiche' }).count()) === 0, 'su iPhone non installata non c’è il pulsante di attivazione')
  await b.close()
})

test('Step 32 · il service worker mostra la notifica e il tocco apre la pagina giusta', async () => {
  resetDatabase()
  seedProfile()
  // Il "headless shell" di default non supporta le notifiche: serve il Chromium completo in modalità headless nuova.
  const b = await chromium.launch({ channel: 'chromium' })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  await ctx.grantPermissions(['notifications'], { origin: APP_URL })
  const p = await ctx.newPage()
  await login(p)
  await p.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  const scripts = await p.evaluate(async () => (await (await fetch('/sw.js')).text()).includes('push-handler.js'))
  check(scripts, 'il service worker generato carica push-handler.js')

  const cdp = await ctx.newCDPSession(p)
  const ids = new Map<string, string>()
  cdp.on('ServiceWorker.workerRegistrationUpdated', (event: { registrations: { registrationId: string; scopeURL: string }[] }) => {
    for (const r of event.registrations) ids.set(r.scopeURL, r.registrationId)
  })
  await cdp.send('ServiceWorker.enable')
  const registration = await p.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  await expect.poll(() => ids.has(registration)).toBe(true)
  const registrationId = () => ids.get(registration)!
  const payload = (title: string, url: string, tag: string) => JSON.stringify({ title, body: 'corpo', url, tag })
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: APP_URL, registrationId: registrationId(), data: payload('Calorie', '/profilo', 'uno') })
  const count = () => p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length)
  await expect.poll(count).toBe(1)
  const shown = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, url: (n.data as { url: string }).url })))
  check(shown[0]?.title === 'Calorie' && shown[0]?.url === '/profilo', 'push ricevuto: notifica mostrata con il percorso interno')

  await b.close()
})

test('Step 32 · push-handler.js: percorsi interni, click che apre o riusa la finestra', async () => {
  // Il file è lo stesso che il service worker carica; qui gira in un contesto finto per provare anche i casi che il
  // browser non permette di forzare in modo affidabile (indirizzi esterni nel payload, click senza finestre aperte).
  const code = readFileSync(new URL('../../public/push-handler.js', import.meta.url), 'utf8')
  const listeners: Record<string, (event: unknown) => void> = {}
  const shown: { title: string; options: { data: { url: string }; body: string } }[] = []
  const opened: string[] = []
  const navigated: string[] = []
  let focused = 0
  let windows: { focus: () => Promise<void>; navigate: (url: string) => Promise<void> }[] = []
  const self = {
    location: { origin: 'https://app.example.test' },
    addEventListener: (name: string, fn: (event: unknown) => void) => void (listeners[name] = fn),
    registration: { showNotification: async (title: string, options: { data: { url: string }; body: string }) => void shown.push({ title, options }) },
    clients: {
      matchAll: async () => windows,
      openWindow: async (url: string) => void opened.push(url),
    },
  }
  new Function('self', 'URL', code)(self, URL)
  const push = async (payload: unknown) => {
    let pending: Promise<unknown> = Promise.resolve()
    listeners.push!({ data: { json: () => payload }, waitUntil: (promise: Promise<unknown>) => void (pending = promise) })
    await pending
  }

  await push({ title: 'Calorie', body: 'ciao', url: '/profilo' })
  await push({ title: 'Altra', url: 'https://evil.example.test/' })
  await push({ title: 'Altra', url: '//evil.example.test/' })
  await push({})
  check(shown.map((n) => n.options.data.url).join(',') === '/profilo,/,/,/', 'solo percorsi interni: gli indirizzi esterni diventano "/"')
  check(shown[3]?.title === 'Calorie', 'senza titolo si usa "Calorie"')

  const click = async (url: string) => {
    let pending: Promise<unknown> = Promise.resolve()
    listeners.notificationclick!({ notification: { close: () => {}, data: { url } }, waitUntil: (promise: Promise<unknown>) => void (pending = promise) })
    await pending
  }
  await click('/profilo')
  check(opened.join() === 'https://app.example.test/profilo', 'senza finestre aperte il tocco apre la pagina giusta')
  windows = [{ focus: async () => void (focused += 1), navigate: async (url) => void navigated.push(url) }]
  await click('/profilo')
  check(focused === 1 && navigated.join() === 'https://app.example.test/profilo', 'con l’app aperta riusa la finestra e va alla pagina giusta')
})
