import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'

import { describeAuthError, type AuthErrorLike } from './authErrors'
import { getSupabase } from './supabase'

export type { Session }

/** Esito del login: ok, oppure un messaggio già pronto per l'utente. */
export type AuthActionResult = { ok: true } | { ok: false; message: string }

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function toResult(error: unknown): AuthActionResult {
  if (!error) return { ok: true }
  return { ok: false, message: describeAuthError(error as AuthErrorLike, isOnline()) }
}

/**
 * Accesso con email e password (ADR-028). Se va bene, supabase-js salva la sessione
 * e la rinnova da solo: non serve rifare il login a ogni apertura.
 */
export async function signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    return toResult(error)
  } catch (error) {
    return toResult(error ?? new Error('errore'))
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
