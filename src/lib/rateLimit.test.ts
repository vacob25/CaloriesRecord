import { describe, expect, it } from 'vitest'

import { checkRateLimit } from './rateLimit'

describe('checkRateLimit', () => {
  it('sotto il limite: consente e registra', () => {
    expect(checkRateLimit([1000, 2000], 3000, 3)).toEqual({ allowed: true, recent: [1000, 2000, 3000] })
  })

  it('al limite: rifiuta e dice quanti secondi aspettare', () => {
    expect(checkRateLimit([1000, 2000, 3000], 10_000, 3)).toEqual({ allowed: false, retryInSeconds: 51, recent: [1000, 2000, 3000] })
  })

  it('le richieste più vecchie di un minuto non contano', () => {
    expect(checkRateLimit([0, 1000, 2000], 61_500, 3).allowed).toBe(true)
  })
})
