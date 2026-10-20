import { describe, expect, it } from 'vitest'

import { parseSubscription, pushState, readVapidPublicKey, testResultMessage, urlBase64ToUint8Array, type PushEnvironment } from './push'

const KEY = 'B'.repeat(87)

const base: PushEnvironment = {
  configured: true,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  isIos: false,
  isStandalone: false,
  permission: 'default',
  subscribed: false,
}

describe('readVapidPublicKey', () => {
  it('accetta una chiave di 87 caratteri base64url', () => expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: ` ${KEY} ` })).toBe(KEY))
  it('rifiuta mancante, vuota o malformata', () => {
    expect(readVapidPublicKey({})).toBeNull()
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: '' })).toBeNull()
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: 'corta' })).toBeNull()
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: `${'B'.repeat(86)}!` })).toBeNull()
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url senza padding', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255])
  })
  it('una chiave VAPID dà 65 byte', () => expect(urlBase64ToUint8Array(KEY)).toHaveLength(65))
})

describe('parseSubscription', () => {
  const good = { endpoint: 'https://push.example.test/abc123456789', keys: { p256dh: 'p'.repeat(30), auth: 'a'.repeat(12) } }
  it('estrae i tre campi', () =>
    expect(parseSubscription(good)).toEqual({ endpoint: good.endpoint, p256dhKey: good.keys.p256dh, authSecret: good.keys.auth }))
  it('rifiuta endpoint non https, chiavi mancanti e valori non oggetto', () => {
    expect(parseSubscription({ ...good, endpoint: 'http://push.example.test/abc123456789' })).toBeNull()
    expect(parseSubscription({ endpoint: good.endpoint })).toBeNull()
    expect(parseSubscription(null)).toBeNull()
  })
})

describe('pushState', () => {
  it('senza chiave: non configurate', () => expect(pushState({ ...base, configured: false })).toBe('not-configured'))
  it('iPhone nel browser: serve installare l’app', () => {
    expect(pushState({ ...base, isIos: true, hasPushManager: false })).toBe('needs-install')
    expect(pushState({ ...base, isIos: true, isStandalone: true })).toBe('off')
  })
  it('browser senza Push: non supportato', () => expect(pushState({ ...base, hasPushManager: false })).toBe('unsupported'))
  it('permesso negato', () => expect(pushState({ ...base, permission: 'denied' })).toBe('denied'))
  it('iscritto con permesso concesso: attive; iscritto ma permesso revocato: non attive', () => {
    expect(pushState({ ...base, permission: 'granted', subscribed: true })).toBe('on')
    expect(pushState({ ...base, permission: 'default', subscribed: true })).toBe('off')
  })
})

describe('testResultMessage', () => {
  it('distingue inviata, scaduta, rifiutata', () => {
    expect(testResultMessage({ sent: 1, removed: 0, failed: 0 })).toMatch(/inviata/)
    expect(testResultMessage({ sent: 0, removed: 1, failed: 0 })).toMatch(/riattiva/)
    expect(testResultMessage({ sent: 0, removed: 0, failed: 1 })).toMatch(/non ha accettato/)
  })
})
