import { useState } from 'react'

import { dangerButtonClass, secondaryButtonClass } from './ui'

interface ConfirmButtonProps {
  label: string
  confirmLabel: string
  busyLabel: string
  busy: boolean
  onConfirm: () => void
}

/** Azione distruttiva in due tocchi: il primo chiede conferma, il secondo esegue. */
export function ConfirmButton({ label, confirmLabel, busyLabel, busy, onConfirm }: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={secondaryButtonClass}>
        {label}
      </button>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" onClick={() => setAsking(false)} disabled={busy} className={secondaryButtonClass}>
        Annulla
      </button>
      <button type="button" onClick={onConfirm} disabled={busy} className={dangerButtonClass}>
        {busy ? busyLabel : confirmLabel}
      </button>
    </div>
  )
}
