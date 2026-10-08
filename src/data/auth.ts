import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'

import { describeAuthError, type AuthStep } from './authErrors'
import { getSupabase } from './supabase'

export type { Session }

/** Esito di un'azione di login: ok, oppure un messaggio già pronto per l'utente. */
export type AuthActionResult = { ok: true } | { ok: false; message: string }

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function toResult(error: unknown, step: AuthStep): AuthActionResult {
  if (!error) return { ok: true }
  const described = describeAuthError(error as { name?: string; code?: string; status?: number }, step, isOnline())
  return described.kind === 'silent' ? { ok: true } : { ok: false, message: described.message }
}

/** Passo 1: chiede a Supabase di mandare il codice. Non crea mai nuovi utenti (ADR-013). */
export async function sendLoginCode(email: string): Promise<AuthActionResult> {
  try {
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    return toResult(error, 'send')
  } catch (error) {
    return toResult(error ?? new Error('errore'), 'send')
  }
}

/** Passo 2: verifica il codice ricevuto per email. Se va bene, supabase-js salva la sessione. */
export async function verifyLoginCode(email: string, code: string): Promise<AuthActionResult> {
  try {
    const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'email' })
    return toResult(error, 'verify')
  } catch (error) {
    return toResult(error ?? new Error('errore'), 'verify')
  }
}

/**
 * Esce da questo dispositivo. 'local' revoca solo la sessione di questo telefono;
 * supabase-js cancella la sessione salvata anche se la rete non risponde.
 */
export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut({ scope: 'local' })
}

export type InitialSession = { status: 'ready'; session: Session | null } | { status: 'offline' }

/**
 * Legge la sessione salvata all'avvio. Se il token è scaduto supabase-js prova a rinnovarlo:
 * senza rete il rinnovo fallisce ma la sessione resta salvata. In quel caso NON è un'uscita:
 * restituiamo 'offline' così l'app chiede la connessione invece di mostrare il login.
 */
export async function loadInitialSession(): Promise<InitialSession> {
  try {
    const { data, error } = await getSupabase().auth.getSession()
    if (error && isAuthRetryableFetchError(error)) return { status: 'offline' }
    return { status: 'ready', session: error ? null : data.session }
  } catch (error) {
    if (isAuthRetryableFetchError(error)) return { status: 'offline' }
    throw error
  }
}

/**
 * Segue i cambiamenti di sessione (accesso, rinnovo del token, uscita).
 * Lo stato iniziale arriva da `loadInitialSession`. Restituisce la funzione per smettere.
 */
export function watchSession(onChange: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return
    // Solo aggiornare lo stato qui: chiamare altri metodi di supabase dentro la callback può bloccarla.
    onChange(session)
  })
  return () => data.subscription.unsubscribe()
}
