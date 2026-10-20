import { describe, expect, it, vi } from 'vitest'

import { sendTestPush, TEST_PAYLOAD, type StoredSubscription } from './sendTestPush'

const sub = (n: number): StoredSubscription => ({ endpoint: `https://push.example.test/${n}`, p256dh_key: `p${n}`, auth_secret: `a${n}` })

function setup(subs: StoredSubscription[], send: (endpoint: string) => Promise<{ statusCode: number }>) {
  const deleted: string[] = []
  const logs: string[] = []
  const sendMock = vi.fn((target: { endpoint: string }) => send(target.endpoint))
  return {
    deleted,
    logs,
    sendMock,
    run: () =>
      sendTestPush({
        listSubscriptions: async () => subs,
        send: sendMock,
        deleteSubscription: async (endpoint) => void deleted.push(endpoint),
        log: (message) => logs.push(message),
      }),
  }
}

describe('sendTestPush', () => {
  it('conta gli invii accettati e passa chiavi e testo generico', async () => {
    const t = setup([sub(1), sub(2)], async () => ({ statusCode: 201 }))
    expect(await t.run()).toEqual({ sent: 2, removed: 0, failed: 0 })
    expect(t.sendMock).toHaveBeenCalledWith({ endpoint: 'https://push.example.test/1', keys: { p256dh: 'p1', auth: 'a1' } }, TEST_PAYLOAD)
  })

  it('cancella le subscription scadute (404/410) e continua con le altre', async () => {
    const t = setup([sub(1), sub(2), sub(3)], async (endpoint) => {
      if (endpoint.endsWith('/1')) throw Object.assign(new Error('gone'), { statusCode: 410 })
      if (endpoint.endsWith('/2')) throw Object.assign(new Error('nf'), { statusCode: 404 })
      return { statusCode: 201 }
    })
    expect(await t.run()).toEqual({ sent: 1, removed: 2, failed: 0 })
    expect(t.deleted).toEqual(['https://push.example.test/1', 'https://push.example.test/2'])
  })

  it('un errore diverso (500, rete) non cancella nulla ed è un fallimento', async () => {
    const t = setup([sub(1), sub(2)], async (endpoint) => {
      if (endpoint.endsWith('/1')) throw Object.assign(new Error('boom'), { statusCode: 500 })
      throw new Error('rete')
    })
    expect(await t.run()).toEqual({ sent: 0, removed: 0, failed: 2 })
    expect(t.deleted).toEqual([])
  })

  it('una risposta non 2xx senza eccezione è un fallimento', async () => {
    const t = setup([sub(1)], async () => ({ statusCode: 429 }))
    expect(await t.run()).toEqual({ sent: 0, removed: 0, failed: 1 })
  })

  it('senza dispositivi non invia nulla', async () => {
    const t = setup([], async () => ({ statusCode: 201 }))
    expect(await t.run()).toEqual({ sent: 0, removed: 0, failed: 0 })
    expect(t.sendMock).not.toHaveBeenCalled()
  })

  it('nei log non finiscono indirizzi né chiavi', async () => {
    const t = setup([sub(1), sub(2)], async (endpoint) => {
      if (endpoint.endsWith('/1')) throw Object.assign(new Error('gone https://push.example.test/1'), { statusCode: 410 })
      return { statusCode: 201 }
    })
    await t.run()
    const all = t.logs.join('\n')
    expect(all).not.toMatch(/push\.example|p1|a1|p2|a2/)
  })

  it('il testo è generico: nessun dato personale', () => {
    expect(JSON.parse(TEST_PAYLOAD)).toEqual({ title: 'Calorie', body: 'Notifica di prova: funziona.', url: '/profilo', tag: 'prova' })
  })
})
