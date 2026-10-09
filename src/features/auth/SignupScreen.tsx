import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { PasswordField } from '../../components/PasswordField'
import { primaryButtonClass, inputClass } from '../../components/ui'
import { signUp } from '../../data/auth'
import { PASSWORD_MIN_LENGTH, validateSignup, type SignupField } from '../../lib/auth'

/** /registrati — solo per le email invitate (controllo in Supabase, migrazione 005, ADR-064). */
export function SignupScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<SignupField, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateSignup({ email, password, consent }, new Date())
    if (!result.ok) {
      setErrors(result.errors)
      setServerError(null)
      return
    }
    setErrors({})
    setServerError(null)
    setEmail(result.value.email)
    setBusy(true)
    const response = await signUp(result.value.email, result.value.password, result.value.consent)
    setBusy(false)
    // Account creato con sessione: la guardia di route porta al Benvenuto (profilo del nuovo utente).
    if (!response.ok) setServerError(response.message)
    else if (!response.signedIn) setPending(true)
  }

  if (pending) {
    return (
      <main className="mx-auto min-h-dvh max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+48px)]">
        <h1 className="text-[28px] font-extrabold leading-tight">Account creato</h1>
        <p role="status" className="mt-4 text-[15px] text-ink-2">
          L’account va ancora confermato. Chiedi all’amministratore di confermarlo, poi accedi.
        </p>
        <Link to="/login" className="mt-6 inline-flex min-h-11 items-center font-semibold text-green-dark">
          Vai ad Accedi
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">Registrati</h1>
      <p className="mt-2 text-[15px] text-ink-2">Solo su invito: usa l’email che hai dato all’amministratore.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="signup-email" className="block text-[13px] font-semibold text-ink-2">
            Email
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            className={inputClass}
          />
          {errors.email && (
            <p id="signup-email-error" className="mt-1 text-[13px] font-semibold text-ink">
              {errors.email}
            </p>
          )}
        </div>

        <PasswordField
          id="signup-password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`Almeno ${PASSWORD_MIN_LENGTH} caratteri. Meglio una frase che ricordi, o quella proposta dal Portachiavi iCloud.`}
          error={errors.password}
        />

        <div>
          <Link to="/privacy" className="flex min-h-11 items-center text-[15px] font-semibold text-green-dark">
            Leggi l’informativa privacy
          </Link>
          <label className="mt-1 flex items-start gap-3 text-[15px] text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? 'signup-consent-error' : undefined}
              className="mt-0.5 size-6 shrink-0 accent-green"
            />
            <span>
              Ho letto l’informativa privacy e acconsento al trattamento dei miei dati, compresi quelli sulla salute (peso
              e alimentazione), per usare l’app.
            </span>
          </label>
          {errors.consent && (
            <p id="signup-consent-error" className="mt-1 text-[13px] font-semibold text-ink">
              {errors.consent}
            </p>
          )}
        </div>

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? 'Registrazione…' : 'Registrati'}
        </button>
      </form>

      {serverError && (
        <p role="alert" className="mt-4 rounded-button bg-surface p-3 text-[15px] font-semibold text-ink">
          {serverError}
        </p>
      )}

      <p className="mt-8 text-[15px]">
        Hai già un account?{' '}
        <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-green-dark">
          Accedi
        </Link>
      </p>
    </main>
  )
}
