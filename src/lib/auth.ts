import { z } from 'zod'

/**
 * Logica pura del login con codice (ADR-014): niente React, niente Supabase.
 * I numeri vengono da Supabase (docs/SECURITY.md): un nuovo codice ogni 60 s,
 * codice valido 1 ora; lunghezza configurabile da 6 a 10 cifre.
 */

export const RESEND_COOLDOWN_S = 60
export const CODE_VALIDITY_MS = 60 * 60 * 1000

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Inserisci un indirizzo email valido.' }))

export const codeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6,10}$/, { message: 'Il codice è fatto solo di cifre (da 6 a 10).' }))

export type ParseResult = { ok: true; value: string } | { ok: false; message: string }

function toResult(parsed: z.ZodSafeParseResult<string>): ParseResult {
  if (parsed.success) return { ok: true, value: parsed.data }
  return { ok: false, message: parsed.error.issues[0]?.message ?? 'Valore non valido.' }
}

export function parseEmail(input: string): ParseResult {
  return toResult(emailSchema.safeParse(input))
}

export function parseCode(input: string): ParseResult {
  return toResult(codeSchema.safeParse(input))
}

/** Secondi interi che mancano prima di poter chiedere un nuovo codice: sempre tra 0 e `cooldownS`. */
export function secondsUntilResend(sentAtMs: number, nowMs: number, cooldownS = RESEND_COOLDOWN_S): number {
  const remainingMs = sentAtMs + cooldownS * 1000 - nowMs
  return Math.min(cooldownS, Math.max(0, Math.ceil(remainingMs / 1000)))
}

/**
 * Login in attesa del codice. Si salva sul telefono perché su iOS, passando
 * all'app Mail per leggere il codice, la PWA può essere ricaricata.
 */
export interface PendingLogin {
  email: string
  sentAt: number
}

const pendingLoginSchema = z.object({
  email: emailSchema,
  sentAt: z.number().int().positive(),
})

/** Rilegge un login in attesa salvato; null se assente, corrotto o con il codice ormai scaduto. */
export function restorePendingLogin(raw: string | null, nowMs: number): PendingLogin | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = pendingLoginSchema.safeParse(data)
  if (!parsed.success) return null
  const { sentAt } = parsed.data
  if (sentAt > nowMs || nowMs - sentAt >= CODE_VALIDITY_MS) return null
  return parsed.data
}
