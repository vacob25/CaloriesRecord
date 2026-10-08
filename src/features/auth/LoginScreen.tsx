import { useState, type FormEvent } from 'react'

import { signInWithPassword } from '../../data/auth'
import { parseEmail, parsePassword } from '../../lib/auth'

const inputClass =
  'mt-2 block min-h-12 w-full rounded-button border border-line bg-surface px-4 text-[17px] text-ink outline-none focus:border-green focus:ring-2 focus:ring-green-tint'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedEmail = parseEmail(email)
    if (!parsedEmail.ok) {
      setError(parsedEmail.message)
      return
    }
    const parsedPassword = parsePassword(password)
    if (!parsedPassword.ok) {
      setError(parsedPassword.message)
      return
    }
    setEmail(parsedEmail.value)
    setBusy(true)
    setError(null)
    const result = await signInWithPassword(parsedEmail.value, parsedPassword.value)
    // Accesso riuscito: la guardia di route porta all'app appena arriva la sessione.
    if (!result.ok) {
      // I campi restano compilati: si corregge senza riscrivere tutto.
      setBusy(false)
      setError(result.message)
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">Accedi</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <label htmlFor="email" className="block text-[13px] font-semibold text-ink-2">
          Email
        </label>
        {/* autocomplete "username" + "current-password": il Portachiavi iCloud propone e salva l'accesso. */}
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? 'login-error' : undefined}
          className={inputClass}
        />

        <label htmlFor="password" className="mt-5 block text-[13px] font-semibold text-ink-2">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'login-error' : undefined}
            className={`${inputClass} pr-24`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-1 my-auto h-11 min-w-11 px-3 text-[13px] font-semibold text-green-dark"
          >
            {showPassword ? 'Nascondi' : 'Mostra'}
          </button>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-button bg-green px-4 text-[15px] font-bold text-surface disabled:opacity-60"
        >
          {busy ? 'Accesso in corso…' : 'Accedi'}
        </button>
      </form>

      {error && (
        <p id="login-error" role="alert" className="mt-4 rounded-button bg-surface p-3 text-[15px] font-semibold text-ink">
          {error}
        </p>
      )}
    </main>
  )
}
