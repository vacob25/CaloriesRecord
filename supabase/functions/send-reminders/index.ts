// Edge Function "send-reminders" (Fase 2 delle notifiche, ADR-087).
//
// Chi la chiama: solo il cron del database (pg_cron + pg_net, ogni 5 minuti), con l'intestazione `x-cron-secret`.
// Perché verify_jwt è spento: il cron non ha il JWT di un utente. L'autorizzazione la fa questo codice:
//   1. il segreto dell'intestazione viene confrontato dal database (verify_cron_secret, che lo legge da Vault);
//      senza segreto giusto: 401, e non si legge nessun dato.
//   2. solo dopo si apre il client con la chiave di servizio (che qui è inevitabile: la funzione deve leggere le
//      subscription di TUTTI gli utenti). La chiave sta nelle variabili che Supabase mette da solo in ogni funzione:
//      non è nel repo, non è nell'app.
// Cosa manda: un testo generico (vedi reminderPayload). Nei log: solo conteggi e codici di stato, mai valori.
//
// Segreti da impostare (vedi docs/SECURITY.md): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'

import { checkVapidConfig } from '../_shared/vapidConfig.ts'
import { sendReminders, type DueReminder } from '../_shared/sendReminders.ts'
import type { StoredSubscription } from '../_shared/deliverPush.ts'

const config = checkVapidConfig({
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY'),
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY'),
  subject: Deno.env.get('VAPID_SUBJECT'),
})
if (config.ok) webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
else console.error(`push: configurazione VAPID non valida (${config.problems.join('; ')})`)

/** Chiave di servizio dalle variabili che Supabase imposta in ogni funzione (nuove chiavi `sb_secret_…` o, in mancanza, la legacy). */
function serviceKey(): string | null {
  try {
    const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? 'null') as Record<string, string> | null
    const key = secrets?.default ?? (secrets ? Object.values(secrets)[0] : undefined)
    if (key) return key
  } catch {
    // formato inatteso: si prova la chiave legacy
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const url = Deno.env.get('SUPABASE_URL')
  const key = serviceKey()
  if (!url || !key) {
    console.error('promemoria: URL o chiave di servizio non disponibili')
    return Response.json({ error: 'not_configured' }, { status: 503 })
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: authorized, error: authError } = await admin.rpc('verify_cron_secret', { p_secret: req.headers.get('x-cron-secret') ?? '' })
  if (authError || authorized !== true) {
    console.error(`promemoria: richiesta rifiutata${authError ? ' (verifica non riuscita)' : ''}`)
    return new Response('Unauthorized', { status: 401 })
  }
  if (!config.ok) return Response.json({ error: 'not_configured', problems: config.problems }, { status: 503 })

  try {
    const result = await sendReminders({
      listDue: async () => {
        const { data, error } = await admin.rpc('due_reminders')
        if (error) throw new Error('lettura dei promemoria non riuscita')
        return (data ?? []) as DueReminder[]
      },
      listSubscriptions: async (userId) => {
        const { data, error } = await admin.from('push_subscriptions').select('endpoint, p256dh_key, auth_secret').eq('user_id', userId)
        if (error) throw new Error('lettura delle subscription non riuscita')
        return (data ?? []) as StoredSubscription[]
      },
      send: (target, payload) => webpush.sendNotification(target, payload, { TTL: 3600 }),
      deleteSubscription: async () => {},
      deleteUserSubscription: async (userId, endpoint) => {
        await admin.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
      },
      recordSent: async (reminder, accepted) => {
        const { error } = await admin
          .from('reminder_log')
          .upsert(
            { user_id: reminder.reminder_user, slot: reminder.reminder_slot, day: reminder.reminder_day, accepted },
            { onConflict: 'user_id,slot,day', ignoreDuplicates: true },
          )
        if (error) throw new Error('scrittura del registro non riuscita')
      },
      log: (message) => console.log(message),
    })
    return Response.json(result)
  } catch {
    console.error('promemoria: errore durante l’invio')
    return Response.json({ error: 'failed' }, { status: 500 })
  }
})
