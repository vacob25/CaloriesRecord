// Controllo locale (NON in CI) che `web-push` sotto Deno cifri davvero il messaggio come vuole un servizio push.
// Un finto servizio push (HTTPS con certificato autofirmato) riceve l'invio e lo decifra come farebbe il telefono.
//
//   mkdir -p /tmp/webpush-check && cd /tmp/webpush-check
//   openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 1 -subj /CN=localhost
//   NODE_TLS_REJECT_UNAUTHORIZED=0 deno run -A --node-modules-dir=auto /percorso/del/repo/supabase/checks/webpush_deno.ts
//
// Dà "decifrato: {...}" se tutto è a posto. Il certificato e la verifica TLS spenta servono solo a questa prova locale.
// Prova locale: web-push sotto Deno contro un finto push service che decifra il messaggio.
import webpush from 'npm:web-push@3.6.7'
import { createECDH, randomBytes } from 'node:crypto'
import ece from 'npm:http_ece@1.2.0'

const vapid = webpush.generateVAPIDKeys()
// "Il telefono": chiavi del client e segreto di autenticazione (come PushManager.subscribe)
const client = createECDH('prime256v1')
client.generateKeys()
const authSecret = randomBytes(16)
const b64u = (buf: Uint8Array | Buffer) => Buffer.from(buf).toString('base64url')

let received: { headers: Headers; body: Uint8Array } | null = null
const server = Deno.serve({ port: 0, cert: Deno.readTextFileSync('cert.pem'), key: Deno.readTextFileSync('key.pem'), onListen: () => {} }, async (req) => {
  received = { headers: req.headers, body: new Uint8Array(await req.arrayBuffer()) }
  return new Response(null, { status: 201 })
})
const port = (server.addr as Deno.NetAddr).port

webpush.setVapidDetails('mailto:prova@example.com', vapid.publicKey, vapid.privateKey)
const res = await webpush.sendNotification(
  { endpoint: `https://localhost:${port}/push/abc`, keys: { p256dh: b64u(client.getPublicKey()), auth: b64u(authSecret) } },
  JSON.stringify({ title: 'Calorie', body: 'Notifica di prova' }),
  { TTL: 60 },
)
console.log('status risposta:', res.statusCode)
const r = received!
console.log('content-encoding:', r.headers.get('content-encoding'), '| ttl:', r.headers.get('ttl'))
const auth = r.headers.get('authorization') ?? ''
console.log('authorization (inizio):', auth.slice(0, 20))
// Decifra come farebbe il telefono
const plain = ece.decrypt(Buffer.from(r.body), { version: 'aes128gcm', privateKey: client, authSecret: authSecret.toString('base64url') })
console.log('decifrato:', Buffer.from(plain).toString())
await server.shutdown()
