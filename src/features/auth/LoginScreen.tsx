import { useState, type FormEvent } from 'react'

import { Link } from 'react-router-dom'

import { PasswordField } from '../../components/PasswordField'
import { signInWithPassword } from '../../data/auth'
import { parseEmail, parsePassword } from '../../lib/auth'

const inputClass =
  'mt-2 block min-h-12 w-full rounded-button border border-line bg-surface px-4 text-[17px] text-ink outline-none focus:border-green focus:ring-2 focus:ring-green-tint'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

        <div className="mt-5">
          <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
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

      <div className="mt-8 space-y-1 text-[15px]">
        <p>
          Non hai un account?{' '}
          <Link to="/registrati" className="inline-flex min-h-11 items-center font-semibold text-green-dark">
            Registrati
          </Link>
        </p>
        <details className="text-ink-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-green-dark">Password dimenticata?</summary>
          <p className="pb-2 text-[15px]">
            L’app non invia email: scrivi all’amministratore, che la reimposta per te. Il contatto è nella pagina Privacy.
          </p>
        </details>
        <Link to="/privacy" className="inline-flex min-h-11 items-center font-semibold text-green-dark">
          Privacy
        </Link>
      </div>
    </main>
  )
}
