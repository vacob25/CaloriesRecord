import { useState, type FormEvent } from 'react'

import { sendLoginCode, verifyLoginCode } from '../../data/auth'
import { parseCode, parseEmail, type PendingLogin } from '../../lib/auth'
import { clearPendingLogin, loadPendingLogin, savePendingLogin } from './pendingLoginStorage'
import { useResendCountdown } from './useResendCountdown'

const inputClass =
  'mt-2 block min-h-12 w-full rounded-button border border-line bg-surface px-4 text-[17px] text-ink outline-none focus:border-green focus:ring-2 focus:ring-green-tint'
const primaryButtonClass =
  'mt-4 min-h-12 w-full rounded-button bg-green px-4 text-[15px] font-bold text-surface disabled:opacity-60'
const linkButtonClass = 'min-h-11 px-2 text-[15px] font-semibold text-green-dark disabled:text-muted'

export function LoginScreen() {
  // Se l'app è stata ricaricata mentre si leggeva la mail, si riprende dal passo del codice.
  const [pending, setPending] = useState<PendingLogin | null>(loadPendingLogin)
  const [email, setEmail] = useState(pending?.email ?? '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const secondsLeft = useResendCountdown(pending?.sentAt ?? null)

  async function requestCode(address: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await sendLoginCode(address)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return false
    }
    const next = { email: address, sentAt: Date.now() }
    savePendingLogin(next)
    setPending(next)
    return true
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = parseEmail(email)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setEmail(parsed.value)
    await requestCode(parsed.value)
  }

  async function handleResend() {
    if (!pending || secondsLeft > 0) return
    setCode('')
    if (await requestCode(pending.email)) setNotice('Nuovo codice inviato.')
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending) return
    const parsed = parseCode(code)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await verifyLoginCode(pending.email, parsed.value)
    if (!result.ok) {
      setBusy(false)
      setError(result.message)
      return
    }
    // Accesso riuscito: la guardia di route porta all'app appena arriva la sessione.
    clearPendingLogin()
  }

  function handleChangeEmail() {
    clearPendingLogin()
    setPending(null)
    setCode('')
    setError(null)
    setNotice(null)
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">Accedi</h1>

      {pending === null ? (
        <form onSubmit={handleSendCode} noValidate className="mt-6">
          <p className="text-[15px] text-ink-2">Ti mandiamo un codice via email. Nessuna password.</p>
          <label htmlFor="email" className="mt-6 block text-[13px] font-semibold text-ink-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'login-error' : undefined}
            className={inputClass}
          />
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Invio in corso…' : 'Invia codice'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} noValidate className="mt-6">
          <p className="text-[15px] text-ink-2">
            Ti abbiamo scritto: inserisci il codice.
            <br />
            <span className="font-semibold text-ink">{pending.email}</span>
          </p>
          <p className="mt-1 text-[13px] text-muted">Se l’indirizzo è giusto, la mail arriva in qualche secondo.</p>
          <label htmlFor="code" className="mt-6 block text-[13px] font-semibold text-ink-2">
            Codice
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={12}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'login-error' : undefined}
            className={`${inputClass} tracking-[0.3em] tabular-nums`}
          />
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Verifica in corso…' : 'Accedi'}
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={handleResend} disabled={busy || secondsLeft > 0} className={linkButtonClass}>
              {secondsLeft > 0 ? `Invia un nuovo codice (tra ${secondsLeft} s)` : 'Invia un nuovo codice'}
            </button>
            <button type="button" onClick={handleChangeEmail} disabled={busy} className={linkButtonClass}>
              Cambia email
            </button>
          </div>
        </form>
      )}

      {error && (
        <p id="login-error" role="alert" className="mt-4 rounded-button bg-surface p-3 text-[15px] font-semibold text-ink">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-button bg-green-tint p-3 text-[15px] font-semibold text-green-dark">
          {notice}
        </p>
      )}
    </main>
  )
}
