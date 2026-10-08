export type SupabaseEnv =
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; problems: string[] }

interface RawEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

/**
 * Controlla le variabili di Supabase senza mai mostrarne il valore.
 * Se mancano o sono sbagliate l'app mostra una schermata di errore invece di andare in crash.
 */
export function readSupabaseEnv(env: RawEnv): SupabaseEnv {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  const problems: string[] = []

  if (!url) {
    problems.push('Manca VITE_SUPABASE_URL.')
  } else if (!isHttpsUrl(url)) {
    problems.push('VITE_SUPABASE_URL non è un indirizzo https valido.')
  }

  if (!key) {
    problems.push('Manca VITE_SUPABASE_PUBLISHABLE_KEY.')
  } else if (key.startsWith('sb_secret_')) {
    // Una variabile VITE_* finisce nel codice pubblico: la secret key qui sarebbe esposta a tutti.
    problems.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY contiene una secret key: toglila subito da Vercel e ruotala in Supabase.',
    )
  } else if (!key.startsWith('sb_publishable_')) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY deve essere la chiave publishable (sb_publishable_…).')
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, url, publishableKey: key }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
