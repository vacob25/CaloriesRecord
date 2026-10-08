import type { InputHTMLAttributes } from 'react'

import { inputClass } from './ui'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  label: string
  error?: string
  hint?: string
  suffix?: string
}

/** Campo con etichetta, aiuto ed errore collegati (accessibilità: label, aria-invalid, aria-describedby). */
export function Field({ id, label, error, hint, suffix, className, ...input }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${suffix ? 'pr-14' : ''}`}
          {...input}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 mt-2 flex items-center text-[15px] text-muted">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 flex gap-1 text-[13px] font-semibold text-ink">
          <span aria-hidden="true">⚠︎</span>
          {error}
        </p>
      )}
    </div>
  )
}
