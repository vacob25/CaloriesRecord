// Controllo dei segreti VAPID (Fase 1, ADR-086). Serve a dire QUALE segreto è sbagliato senza mai mostrarne il valore:
// l'errore tipico è un carattere copiato male (a capo, lettera cirillica al posto della latina, virgolette).
// Nessun import di Deno: gira anche in Vitest. `node:crypto` esiste in entrambi.
import { Buffer } from 'node:buffer'
import { createECDH } from 'node:crypto'

export interface VapidEnv {
  publicKey?: string
  privateKey?: string
  subject?: string
}

export type VapidCheck =
  | { ok: true; publicKey: string; privateKey: string; subject: string }
  | { ok: false; problems: string[] }

const BASE64URL = /^[A-Za-z0-9_-]+$/
const PUBLIC_LENGTH = 87 // punto P-256 non compresso (65 byte) in base64url
const PRIVATE_LENGTH = 43 // scalare di 32 byte in base64url

/** Descrive cosa non va in un valore senza riportarlo. */
function describe(value: string, expectedLength: number): string | null {
  if (value.length === 0) return 'vuoto o mancante'
  const notes: string[] = []
  if (value.length !== expectedLength) notes.push(`lunghezza ${value.length} invece di ${expectedLength}`)
  if ([...value].some((char) => char.charCodeAt(0) > 127)) notes.push('contiene caratteri non latini (copia da immagine?)')
  if (/\s/.test(value)) notes.push('contiene spazi o a capo')
  if (/["'`]/.test(value)) notes.push('contiene virgolette')
  if (notes.length === 0 && !BASE64URL.test(value)) notes.push('contiene caratteri non ammessi')
  return notes.length > 0 ? notes.join(', ') : null
}

export function checkVapidConfig(env: VapidEnv): VapidCheck {
  const publicKey = (env.publicKey ?? '').trim()
  const privateKey = (env.privateKey ?? '').trim()
  const subject = (env.subject ?? '').trim()
  const problems: string[] = []

  const publicProblem = describe(publicKey, PUBLIC_LENGTH)
  if (publicProblem) problems.push(`VAPID_PUBLIC_KEY: ${publicProblem}`)
  const privateProblem = describe(privateKey, PRIVATE_LENGTH)
  if (privateProblem) problems.push(`VAPID_PRIVATE_KEY: ${privateProblem}`)
  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/.test(subject)) {
    problems.push('VAPID_SUBJECT: deve essere "mailto:" seguito da un indirizzo email (o un indirizzo https), senza spazi')
  }

  // Le due chiavi devono essere la coppia generata insieme.
  if (!publicProblem && !privateProblem) {
    try {
      const ecdh = createECDH('prime256v1')
      ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'))
      if (ecdh.getPublicKey().toString('base64url') !== publicKey) {
        problems.push('VAPID_PRIVATE_KEY non corrisponde a VAPID_PUBLIC_KEY: non sono la stessa coppia')
      }
    } catch {
      problems.push('VAPID_PRIVATE_KEY: non è una chiave privata P-256 valida')
    }
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, publicKey, privateKey, subject }
}
