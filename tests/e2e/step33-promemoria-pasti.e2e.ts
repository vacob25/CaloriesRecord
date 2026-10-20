import { chromium, expect, test } from '@playwright/test'

import { sendReminders, type DueReminder } from '../../supabase/functions/_shared/sendReminders'
import { addDays, localDate } from '../../src/lib/dates'
import { check, login, lit, resetDatabase, seedProfile, sql, USERS, wire } from './support/harness'

// Fase 2 notifiche (ADR-087): impostazioni dei promemoria nel Profilo, invio (STESSA logica della funzione send-reminders,
// con due_reminders() del database a un istante scelto), "pasto fatto" segnato dal trigger, proposta di sospendere.
// Il cron e il vero servizio push non ci sono: si provano a mano sull'iPhone (vedi docs/ROADMAP.md, step 33).

const ENDPOINT = 'https://push.example.test/dispositivo-di-prova-1'
const KEYS = { p256dh: 'p'.repeat(40), auth: 'a'.repeat(16) }
const A = () => USERS.a!.id

const FAKE_PUSH = `
  (() => {
    // L'iscrizione sopravvive al ricaricamento come nel browser vero.
    const makeSub = () => ({ endpoint: ${JSON.stringify(ENDPOINT)}, toJSON() { return { endpoint: ${JSON.stringify(ENDPOINT)}, keys: ${JSON.stringify(KEYS)} } }, async unsubscribe() { sessionStorage.removeItem('sub'); return true } })
    const pushManager = { async getSubscription() { return sessionStorage.getItem('sub') ? makeSub() : null }, async subscribe() { sessionStorage.setItem('sub', '1'); return makeSub() } }
    const registration = { pushManager }
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(registration), async getRegistration() { return registration } }, configurable: true })
    window.PushManager = window.PushManager || function PushManager() {}
    window.Notification = { get permission() { return sessionStorage.getItem('perm') ?? 'default' }, async requestPermission() { sessionStorage.setItem('perm', 'granted'); return 'granted' } }
  })()
`

/** Un giro di send-reminders all'istante `at`: stessa logica della funzione, dati letti e scritti con psql. */
async function runReminders(at: string, pushed: string[]) {
  return sendReminders({
    listDue: async () =>
      sql(`select reminder_user || '|' || reminder_slot || '|' || reminder_day from public.due_reminders(${lit(at)}::timestamptz)`)
        .split('\n')
        .filter(Boolean)
        .map((line): DueReminder => {
          const [reminder_user = '', reminder_slot = '', reminder_day = ''] = line.split('|')
          return { reminder_user, reminder_slot, reminder_day }
        }),
    listSubscriptions: async (userId) =>
      sql(`select endpoint || '|' || p256dh_key || '|' || auth_secret from public.push_subscriptions where user_id = ${lit(userId)}`)
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [endpoint = '', p256dh_key = '', auth_secret = ''] = line.split('|')
          return { endpoint, p256dh_key, auth_secret }
        }),
    send: async (target, payload) => {
      pushed.push(`${target.endpoint} ${JSON.parse(payload).body}`)
      return { statusCode: 201 }
    },
    deleteSubscription: async () => {},
    deleteUserSubscription: async (userId, endpoint) => void sql(`delete from public.push_subscriptions where user_id = ${lit(userId)} and endpoint = ${lit(endpoint)}`),
    recordSent: async (r, accepted) =>
      void sql(`insert into public.reminder_log (user_id, slot, day, accepted) values (${lit(r.reminder_user)}, ${lit(r.reminder_slot)}, ${lit(r.reminder_day)}, ${accepted}) on conflict do nothing`),
  })
}

test('Step 33 · promemoria dei pasti: impostazioni, invio, pasto fatto, proposta', async () => {
  resetDatabase()
  seedProfile()
  const pushed: string[] = []

  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome' })
  await wire(ctx)
  await ctx.addInitScript(FAKE_PUSH)
  const p = await ctx.newPage()
  const errs: string[] = []
  p.on('pageerror', (e) => errs.push(e.message))
  await login(p)
  await p.getByRole('link', { name: 'Profilo', exact: true }).click()

  const section = p.getByRole('region', { name: 'Notifiche' })
  await section.getByRole('button', { name: 'Attiva le notifiche' }).click()
  await section.getByRole('heading', { name: 'Promemoria dei pasti' }).waitFor()
  check(sql('select count(*) from public.reminder_settings') === '0', 'prima di scegliere nulla non c’è nessuna impostazione')

  // Attiva il pranzo: orario suggerito 12:30.
  const lunch = section.getByRole('group', { name: 'Promemoria Pranzo' })
  await lunch.getByRole('checkbox', { name: 'Pranzo' }).check()
  await expect(lunch.getByLabel('Ogni giorno')).toHaveValue('12:30')
  check(
    sql(`select enabled || '|' || time_weekday || '|' || coalesce(time_weekend::text, 'null') from public.reminder_settings where user_id = ${lit(A())} and slot = 'meal:lunch'`) === 'true|12:30:00|null',
    'il pranzo è attivo alle 12:30, senza orario weekend',
  )

  // Un orario non a passi di 5 minuti viene riportato al passo (iOS non rispetta lo step del campo).
  await lunch.getByLabel('Ogni giorno').fill('13:07')
  await lunch.getByLabel('Ogni giorno').blur()
  await expect(lunch.getByLabel('Ogni giorno')).toHaveValue('13:05')
  check(sql(`select time_weekday from public.reminder_settings where slot = 'meal:lunch'`) === '13:05:00', '13:07 diventa 13:05')

  // Orario diverso nel weekend.
  await lunch.getByRole('checkbox', { name: 'Orario diverso nel weekend' }).check()
  await expect(lunch.getByText('Lun–ven')).toBeVisible()
  await lunch.getByLabel('Sab–dom').fill('10:00')
  await lunch.getByLabel('Sab–dom').blur()
  await expect.poll(() => sql(`select coalesce(time_weekend::text, 'null') from public.reminder_settings where slot = 'meal:lunch'`)).toBe('10:00:00')

  // Ricaricando le impostazioni restano.
  await p.reload()
  const lunchAfter = p.getByRole('region', { name: 'Notifiche' }).getByRole('group', { name: 'Promemoria Pranzo' })
  await expect(lunchAfter.getByLabel('Lun–ven')).toHaveValue('13:05')
  await expect(lunchAfter.getByLabel('Sab–dom')).toHaveValue('10:00')

  // Invio. Martedì 20/10/2026 il pranzo è alle 13:05 CEST = 11:05 UTC; la cena (non attivata) non parte.
  check(JSON.stringify(await runReminders('2026-10-20 11:04:00+00', pushed)) === '{"due":0,"delivered":0,"notDelivered":0}', 'un minuto prima non parte niente')
  const sent = await runReminders('2026-10-20 11:05:00+00', pushed)
  check(sent.delivered === 1 && pushed.length === 1, 'all’ora giusta parte un promemoria')
  check(pushed[0]?.startsWith(ENDPOINT) === true && !/pranzo|kcal|kg/i.test(pushed[0] ?? ''), 'al dispositivo giusto, con testo generico')
  check(sql(`select accepted from public.reminder_log where slot = 'meal:lunch' and day = '2026-10-20'`) === '1', 'il registro dice 1 dispositivo')
  check((await runReminders('2026-10-20 11:10:00+00', pushed)).due === 0, 'cinque minuti dopo non si ripete')

  // Sabato 24/10/2026: orario del weekend, 10:00 CEST = 08:00 UTC. Se il pranzo è già registrato non parte.
  sql(`insert into public.meal_entries (user_id, entry_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g)
       values (${lit(A())}, '2026-10-24', 'lunch', 'Cibo di prova', 100, 100, 1, 1, 1)`)
  check(sql(`select count(*) from public.reminder_status where slot = 'meal:lunch' and day = '2026-10-24'`) === '1', 'registrare una voce segna il pasto come fatto')
  check((await runReminders('2026-10-24 08:00:00+00', pushed)).due === 0, 'pasto già registrato: nessun promemoria')
  check((await runReminders('2026-10-25 09:00:00+00', pushed)).delivered === 1, 'domenica del cambio d’ora: parte alle 10:00 CET (09:00 UTC)')

  // Proposta di sospendere: 5 giorni di fila mandati e non registrati (oggi non conta).
  const today = localDate(new Date())
  for (let back = 1; back <= 5; back += 1) {
    sql(`insert into public.reminder_log (user_id, slot, day, accepted) values (${lit(A())}, 'meal:lunch', ${lit(addDays(today, -back))}, 1) on conflict do nothing`)
  }
  sql(`delete from public.reminder_status`)
  await p.reload()
  const proposalSection = p.getByRole('region', { name: 'Notifiche' })
  await proposalSection.getByText('Da 5 giorni il promemoria di “Pranzo” parte').waitFor()
  await proposalSection.getByRole('button', { name: 'Continua' }).click()
  await proposalSection.getByText('Da 5 giorni il promemoria').waitFor({ state: 'hidden' })
  check(sql(`select proposal_dismissed_day from public.reminder_settings where slot = 'meal:lunch'`) === today, '“Continua” ricorda il giorno')
  await p.reload()
  await p.getByRole('region', { name: 'Notifiche' }).getByRole('heading', { name: 'Promemoria dei pasti' }).waitFor()
  check((await p.getByText('Da 5 giorni il promemoria').count()) === 0, 'dopo “Continua” la proposta non torna subito')

  // Un altro utente non vede né modifica le impostazioni di A (la RLS è in supabase/checks/rls_two_users.sql).
  check(sql(`select count(*) from public.reminder_settings where user_id = ${lit(USERS.b!.id)}`) === '0', 'l’altro utente non ha impostazioni')

  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`)
  await b.close()
})
