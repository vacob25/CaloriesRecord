/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Contatto privacy (facoltativo, solo su Vercel: mai nel repo). */
  readonly VITE_PRIVACY_CONTACT?: string
  /** Chiave VAPID pubblica per le notifiche (facoltativa). È pubblica per natura; la privata sta solo nei segreti di Supabase. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
