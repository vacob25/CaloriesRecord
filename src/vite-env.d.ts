/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Contatto privacy (facoltativo, solo su Vercel: mai nel repo). */
  readonly VITE_PRIVACY_CONTACT?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
