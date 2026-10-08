import { useState } from 'react'

import { ScreenPlaceholder } from '../../components/ScreenPlaceholder'
import { signOut } from '../../data/auth'

export function ProfileScreen() {
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    // Al termine arriva SIGNED_OUT e la guardia di route porta al login.
    await signOut()
    setBusy(false)
  }

  return (
    <>
      <ScreenPlaceholder title="Profilo" />
      <div className="px-5 pt-6">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="min-h-12 w-full rounded-button border border-line bg-surface px-4 text-[15px] font-bold text-ink disabled:opacity-60"
        >
          {busy ? 'Uscita in corso…' : 'Esci'}
        </button>
      </div>
    </>
  )
}
