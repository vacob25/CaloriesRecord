// Edge Function "send-test-push" (Fase 1 delle notifiche, ADR-086).
//
// Cosa fa: manda una notifica di prova di CaloriesRecord ai dispositivi di CHI LA CHIAMA, e a nessun altro.
//   1. withSupabase({ auth: 'user' }) controlla il JWT dell'utente (e il flag verify_jwt lo ricontrolla prima che
//      la funzione parta) e dà un client Supabase che rispetta la RLS di quell'utente.
//   2. Con quel client si leggono le subscription: la RLS lascia passare solo le sue.
//   3. Si manda il push con la chiave VAPID privata, che sta solo nei segreti di Supabase.
// Nessuna service_role: il codice non usa `ctx.supabaseAdmin` e non legge nessuna chiave di servizio.
// Nei log: solo conteggi e codici di stato, mai indirizzi, chiavi o testi.
//
// Segreti da impostare (vedi docs/SECURITY.md): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
import { withSupabase } from 'npm:@supabase/server@1.9.2'
import webpush from 'npm:web-push@3.6.7'

import { sendTestPush, type StoredSubscription } from '../_shared/sendTestPush.ts'
import { checkVapidConfig } from '../_shared/vapidConfig.ts'

const config = checkVapidConfig({
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY'),
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY'),
  subject: Deno.env.get('VAPID_SUBJECT'),
})
if (config.ok) webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
else console.error(`push: segreti VAPID non validi: ${config.problems.join(' | ')}`) // solo cosa non va, mai i valori

export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    if (!config.ok) return Response.json({ error: 'not_configured', problems: config.problems }, { status: 503 })

    const result = await sendTestPush({
      listSubscriptions: async () => {
        const { data, error } = await ctx.supabase.from('push_subscriptions').select('endpoint, p256dh_key, auth_secret')
        if (error) throw new Error('lettura delle subscription non riuscita')
        return (data ?? []) as StoredSubscription[]
      },
      send: (target, payload) => webpush.sendNotification(target, payload, { TTL: 60 }),
      deleteSubscription: async (endpoint) => {
        await ctx.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
      },
      log: (message) => console.log(message),
    })
    return Response.json(result)
  }),
}
