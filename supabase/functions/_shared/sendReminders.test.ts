import { describe, expect, it, vi } from 'vitest'

import type { StoredSubscription } from './deliverPush'
import { reminderPayload, sendReminders, type DueReminder } from './sendReminders'

const due = (user: string, slot = 'meal:lunch'): DueReminder => ({ reminder_user: user, reminder_slot: slot, reminder_day: '2026-10-20' })
const sub = (n: number): StoredSubscription => ({ endpoint: `https://push.example.test/${n}`, p256dh_key: `p${n}`, auth_secret: `a${n}` })

function setup(opts: {
  due: DueReminder[]
  subs: Record<string, StoredSubscription[]>
  send?: (endpoint: string) => Promise<{ statusCode: number }>
}) {
  const sent: Array<{ endpoint: string; payload: string }> = []
  const recorded: Array<{ user: string; slot: string; accepted: number }> = []
  const deleted: Array<{ user: string; endpoint: string }> = []
  const deps = {
    listDue: async () => opts.due,
    listSubscriptions: async (userId: string) => opts.subs[userId] ?? [],
    deleteUserSubscription: async (user: string, endpoint: string) => void deleted.push({ user, endpoint }),
    recordSent: async (r: DueReminder, accepted: number) => void recorded.push({ user: r.reminder_user, slot: r.reminder_slot, accepted }),
    send: vi.fn(async (target: { endpoint: string }, payload: string) => {
      sent.push({ endpoint: target.endpoint, payload })
      return opts.send ? opts.send(target.endpoint) : { statusCode: 201 }
    }),
    deleteSubscription: async () => {},
  }
  return { deps, sent, recorded, deleted }
}

describe('sendReminders', () => {
  it('manda a tutti i dispositivi dell’utente e scrive il registro con il numero di accettati', async () => {
    const t = setup({ due: [due('u1')], subs: { u1: [sub(1), sub(2)] } })
    const result = await sendReminders(t.deps)
    expect(result).toEqual({ due: 1, delivered: 1, notDelivered: 0 })
    expect(t.sent.map((s) => s.endpoint)).toEqual([sub(1).endpoint, sub(2).endpoint])
    expect(t.recorded).toEqual([{ user: 'u1', slot: 'meal:lunch', accepted: 2 }])
  })

  it('non mescola i dispositivi di utenti diversi', async () => {
    const t = setup({ due: [due('u1'), due('u2')], subs: { u1: [sub(1)], u2: [sub(2)] } })
    await sendReminders(t.deps)
    expect(t.recorded).toEqual([
      { user: 'u1', slot: 'meal:lunch', accepted: 1 },
      { user: 'u2', slot: 'meal:lunch', accepted: 1 },
    ])
  })

  it('con una subscription scaduta la cancella e registra solo gli accettati', async () => {
    const t = setup({
      due: [due('u1')],
      subs: { u1: [sub(1), sub(2)] },
      send: async (endpoint) => {
        if (endpoint === sub(1).endpoint) throw Object.assign(new Error('gone'), { statusCode: 410 })
        return { statusCode: 201 }
      },
    })
    const result = await sendReminders(t.deps)
    expect(t.deleted).toEqual([{ user: 'u1', endpoint: sub(1).endpoint }])
    expect(t.recorded).toEqual([{ user: 'u1', slot: 'meal:lunch', accepted: 1 }])
    expect(result.delivered).toBe(1)
  })

  it('se sono tutte scadute registra 0 accettati: non vale come "mandato e non registrato"', async () => {
    const t = setup({ due: [due('u1')], subs: { u1: [sub(1)] }, send: async () => Promise.reject(Object.assign(new Error('gone'), { statusCode: 404 })) })
    const result = await sendReminders(t.deps)
    expect(t.recorded).toEqual([{ user: 'u1', slot: 'meal:lunch', accepted: 0 }])
    expect(result).toEqual({ due: 1, delivered: 0, notDelivered: 1 })
  })

  it('con soli errori temporanei non scrive il registro, così al giro dopo si riprova', async () => {
    const t = setup({ due: [due('u1')], subs: { u1: [sub(1)] }, send: async () => Promise.reject(Object.assign(new Error('boom'), { statusCode: 503 })) })
    const result = await sendReminders(t.deps)
    expect(t.recorded).toEqual([])
    expect(result).toEqual({ due: 1, delivered: 0, notDelivered: 1 })
  })

  it('un errore su un utente non blocca gli altri', async () => {
    const t = setup({ due: [due('u1'), due('u2')], subs: { u2: [sub(2)] } })
    const original = t.deps.listSubscriptions
    t.deps.listSubscriptions = async (id: string) => {
      if (id === 'u1') throw new Error('db')
      return original(id)
    }
    const result = await sendReminders(t.deps)
    expect(result).toEqual({ due: 2, delivered: 1, notDelivered: 1 })
    expect(t.recorded).toEqual([{ user: 'u2', slot: 'meal:lunch', accepted: 1 }])
  })

  it('nessun promemoria dovuto: non fa niente', async () => {
    const t = setup({ due: [], subs: {} })
    expect(await sendReminders(t.deps)).toEqual({ due: 0, delivered: 0, notDelivered: 0 })
    expect(t.deps.send).not.toHaveBeenCalled()
  })

  it('il testo è generico: niente nome del pasto, peso o calorie, e porta alla home', () => {
    const payload = JSON.parse(reminderPayload(due('u1', 'meal:dinner')))
    expect(payload.title).toBe('Calorie')
    expect(payload.url).toBe('/')
    expect(payload.tag).toBe('promemoria-meal:dinner')
    expect(payload.body).not.toMatch(/kcal|kg|cena|pranzo/i)
  })
})
