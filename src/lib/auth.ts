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

// ─── Registrazione dei tester (step 18, ADR-064) ───────────────────────────

/** Lunghezza della nuova password: almeno 8 caratteri; al massimo 72 byte (limite di bcrypt usato da Supabase). */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_BYTES = 72

/** Versione dell'informativa privacy accettata alla registrazione (data dell'ultima modifica del testo). */
export const PRIVACY_VERSION = '2026-10-09'

export function parseNewPassword(input: string): ParseResult {
  if (input.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri.` }
  }
  // bcrypt ignora tutto oltre i 72 byte: meglio dirlo che accettare in silenzio una password tagliata.
  if (new TextEncoder().encode(input).length > PASSWORD_MAX_BYTES) {
    return { ok: false, message: `Password troppo lunga: al massimo ${PASSWORD_MAX_BYTES} caratteri (meno se usi accenti o emoji).` }
  }
  return { ok: true, value: input }
}

export interface SignupInput {
  email: string
  password: string
  consent: boolean
}

export type SignupField = 'email' | 'password' | 'consent'

/** Consenso salvato nei metadati dell'utente alla registrazione (soluzione base, docs/SECURITY.md). */
export interface ConsentMetadata {
  privacy_version: string
  privacy_accepted_at: string
  health_data_consent: true
}

export function validateSignup(
  input: SignupInput,
  now: Date,
): { ok: true; value: { email: string; password: string; consent: ConsentMetadata } } | { ok: false; errors: Partial<Record<SignupField, string>> } {
  const errors: Partial<Record<SignupField, string>> = {}
  const email = parseEmail(input.email)
  if (!email.ok) errors.email = email.message
  const password = parseNewPassword(input.password)
  if (!password.ok) errors.password = password.message
  if (!input.consent) errors.consent = 'Per registrarti devi accettare l’informativa privacy, compresi i dati sulla salute.'
  if (!email.ok || !password.ok || !input.consent) return { ok: false, errors }
  return {
    ok: true,
    value: {
      email: email.value,
      password: password.value,
      consent: { privacy_version: PRIVACY_VERSION, privacy_accepted_at: now.toISOString(), health_data_consent: true },
    },
  }
}

/** Ciò che serve di localStorage/sessionStorage per pulirli (si testa con un finto storage). */
export interface StorageLike {
  readonly length: number
  key(index: number): string | null
  removeItem(key: string): void
}

/**
 * Chiavi con dati dell'utente da togliere all'uscita: la sessione di Supabase ("sb-…") e quelle
 * dell'app (conteggio di Open Food Facts "off.…", eventuali "caloriesrecord.…"). Restituisce le chiavi tolte.
 */
export const USER_STORAGE_PREFIXES = ['sb-', 'off.', 'caloriesrecord.'] as const

export function clearUserStorage(storage: StorageLike): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && USER_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
  return keys
}
