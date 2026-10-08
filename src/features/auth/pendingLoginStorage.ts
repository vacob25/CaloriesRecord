import { restorePendingLogin, type PendingLogin } from '../../lib/auth'

// Solo stato temporaneo del login (email e orario dell'invio), cancellato all'accesso.
const KEY = 'calorie.pendingLogin'

export function loadPendingLogin(): PendingLogin | null {
  try {
    return restorePendingLogin(localStorage.getItem(KEY), Date.now())
  } catch {
    return null
  }
}

export function savePendingLogin(pending: PendingLogin): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    // Storage non disponibile: il login funziona lo stesso, solo senza ripresa dopo un ricaricamento.
  }
}

export function clearPendingLogin(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // niente da fare
  }
}
