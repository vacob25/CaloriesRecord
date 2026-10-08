import { z } from 'zod'

/**
 * Logica pura del login con email e password (ADR-028): niente React, niente Supabase.
 * Al login non si impongono regole sulla password (lunghezza, simboli): le decide
 * Supabase quando la password viene creata. Qui si controlla solo che ci sia.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Inserisci un indirizzo email valido.' }))

// La password NON si modifica (niente trim): gli spazi possono farne parte.
export const passwordSchema = z.string().min(1, { message: 'Inserisci la password.' })

export type ParseResult = { ok: true; value: string } | { ok: false; message: string }

function toResult(parsed: z.ZodSafeParseResult<string>): ParseResult {
  if (parsed.success) return { ok: true, value: parsed.data }
  return { ok: false, message: parsed.error.issues[0]?.message ?? 'Valore non valido.' }
}

export function parseEmail(input: string): ParseResult {
  return toResult(emailSchema.safeParse(input))
}

export function parsePassword(input: string): ParseResult {
  return toResult(passwordSchema.safeParse(input))
}
