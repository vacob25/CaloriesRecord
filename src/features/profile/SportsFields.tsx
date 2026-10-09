import { useState, type FormEvent } from 'react'

import { inputClass } from '../../components/ui'
import { SPORT_NAME_MAX, SPORTS_MAX } from '../../lib/constants'
import { addSport, RECOMMENDED_SPORT, SUGGESTED_SPORTS } from '../../lib/sports'

interface SportsFieldsProps {
  sports: string[]
  onChange: (sports: string[]) => void
}

/**
 * Sport dell'utente (testo libero, al massimo 2): da qui i tipi di giorno in Oggi, come Riposo / Palestra /
 * Calcio / Palestra + calcio. Palestra è suggerita come consigliata.
 */
export function SportsFields({ sports, onChange }: SportsFieldsProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const full = sports.length >= SPORTS_MAX

  function add(name: string) {
    const result = addSport(sports, name)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError(null)
    setText('')
    onChange(result.value)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    add(text)
  }

  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-ink-2">Che sport fai? (facoltativo)</legend>
      <p className="mt-1 text-[13px] text-muted">
        Fino a {SPORTS_MAX}. Nei giorni di allenamento sceglierai uno sport o entrambi e l’app aggiunge il bonus di calorie.
      </p>

      {sports.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="I tuoi sport">
          {sports.map((sport) => (
            <li key={sport} className="flex min-h-11 items-center gap-1 rounded-full bg-green-tint pl-4 pr-1 text-[15px] font-semibold text-green-dark">
              {sport}
              <button
                type="button"
                onClick={() => onChange(sports.filter((other) => other !== sport))}
                aria-label={`Togli ${sport}`}
                className="flex size-11 items-center justify-center rounded-full"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-2 flex items-start gap-2" noValidate>
        <div className="flex-1">
          <label htmlFor="sport-name" className="sr-only">
            Nome dello sport
          </label>
          <input
            id="sport-name"
            value={text}
            maxLength={SPORT_NAME_MAX}
            disabled={full}
            placeholder={full ? `Hai già ${SPORTS_MAX} sport` : 'es. Nuoto, Basket, CrossFit'}
            autoComplete="off"
            onChange={(event) => {
              setText(event.target.value)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'sport-error' : undefined}
            className={`${inputClass} !mt-0 disabled:opacity-60`}
          />
        </div>
        <button
          type="submit"
          disabled={full || text.trim() === ''}
          className="min-h-12 shrink-0 rounded-button border border-line bg-surface px-4 text-[15px] font-bold text-ink disabled:opacity-40"
        >
          Aggiungi
        </button>
      </form>
      {error && (
        <p id="sport-error" role="alert" className="mt-1 text-[13px] font-semibold">
          ⚠︎ {error}
        </p>
      )}

      {!full && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-ink-2">Scegli al volo</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SUGGESTED_SPORTS.filter((suggestion) => !sports.some((sport) => sport.toLowerCase() === suggestion.toLowerCase())).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => add(suggestion)}
                className={`min-h-11 rounded-full border px-4 text-[15px] font-semibold ${
                  suggestion === RECOMMENDED_SPORT ? 'border-green bg-surface text-green-dark' : 'border-line bg-surface text-ink-2'
                }`}
              >
                {suggestion === RECOMMENDED_SPORT ? `${suggestion} · consigliato` : suggestion}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">
            Palestra è consigliata: l’allenamento con i pesi è ciò che fa crescere i muscoli e li conserva quando dimagrisci.
          </p>
        </div>
      )}
    </fieldset>
  )
}
