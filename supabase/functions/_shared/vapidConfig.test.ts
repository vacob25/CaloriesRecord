import { createECDH } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { checkVapidConfig } from './vapidConfig'

function pair() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: ecdh.getPrivateKey().toString('base64url') }
}

const SUBJECT = 'mailto:prova@example.com'

describe('checkVapidConfig', () => {
  it('accetta una coppia valida (anche con spazi o a capo ai lati)', () => {
    const k = pair()
    expect(k.publicKey).toHaveLength(87)
    expect(k.privateKey).toHaveLength(43)
    const result = checkVapidConfig({ publicKey: `${k.publicKey}\n`, privateKey: ` ${k.privateKey}`, subject: SUBJECT })
    expect(result).toEqual({ ok: true, publicKey: k.publicKey, privateKey: k.privateKey, subject: SUBJECT })
  })

  it('segnala segreti mancanti senza inventare altro', () => {
    const result = checkVapidConfig({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.problems.map((p) => p.split(':')[0])).toEqual(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])
      expect(result.problems[0]).toMatch(/vuoto o mancante/)
    }
  })

  it('riconosce lettere cirilliche, a capo in mezzo e lunghezza sbagliata (il caso reale)', () => {
    const k = pair()
    const cyrillic = 'х' + k.publicKey.slice(1) // х cirillico al posto della prima lettera
    const withNewline = k.publicKey.slice(0, 50) + '\n' + k.publicKey.slice(50)
    const short = k.publicKey.slice(0, 80)
    const a = checkVapidConfig({ publicKey: cyrillic, privateKey: k.privateKey, subject: SUBJECT })
    const b = checkVapidConfig({ publicKey: withNewline, privateKey: k.privateKey, subject: SUBJECT })
    const c = checkVapidConfig({ publicKey: short, privateKey: k.privateKey, subject: SUBJECT })
    expect(!a.ok && a.problems[0]).toMatch(/non latini/)
    expect(!b.ok && b.problems[0]).toMatch(/a capo/)
    expect(!c.ok && c.problems[0]).toMatch(/lunghezza 80 invece di 87/)
  })

  it('riconosce virgolette e un soggetto non valido', () => {
    const k = pair()
    const quoted = checkVapidConfig({ publicKey: `"${k.publicKey}"`, privateKey: k.privateKey, subject: 'prova@example.com' })
    expect(!quoted.ok && quoted.problems.join('|')).toMatch(/virgolette/)
    expect(!quoted.ok && quoted.problems.join('|')).toMatch(/VAPID_SUBJECT/)
  })

  it('riconosce due chiavi che non sono la stessa coppia', () => {
    const a = pair()
    const b = pair()
    const result = checkVapidConfig({ publicKey: a.publicKey, privateKey: b.privateKey, subject: SUBJECT })
    expect(!result.ok && result.problems).toEqual(['VAPID_PRIVATE_KEY non corrisponde a VAPID_PUBLIC_KEY: non sono la stessa coppia'])
  })

  it('non mette mai i valori nei messaggi', () => {
    const k = pair()
    const result = checkVapidConfig({ publicKey: 'x'.repeat(10) + k.publicKey.slice(10), privateKey: k.privateKey.slice(0, 40), subject: SUBJECT })
    const text = JSON.stringify(result)
    expect(text).not.toContain(k.privateKey.slice(0, 20))
    expect(text).not.toContain(k.publicKey.slice(10, 30))
  })
})
