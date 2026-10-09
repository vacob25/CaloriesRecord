import { useState } from 'react'

import { inputClass } from './ui'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** current-password al login, new-password alla registrazione: il Portachiavi iCloud propone/salva la password giusta. */
  autoComplete: 'current-password' | 'new-password'
  error?: string
  hint?: string
}

/** Campo password con "Mostra/Nascondi" (area 44 px) e messaggi collegati per VoiceOver. */
export function PasswordField({ id, label, value, onChange, autoComplete, error, hint }: PasswordFieldProps) {
  const [shown, setShown] = useState(false)
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} pr-24`}
        />
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          aria-label={shown ? 'Nascondi password' : 'Mostra password'}
          aria-pressed={shown}
          className="absolute inset-y-0 right-1 mt-2 h-12 min-w-11 px-3 text-[13px] font-semibold text-green-dark"
        >
          {shown ? 'Nascondi' : 'Mostra'}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[13px] font-semibold text-ink">
          {error}
        </p>
      )}
    </div>
  )
}
