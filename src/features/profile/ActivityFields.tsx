import { RECAL_MIN_DAYS } from '../../lib/constants'
import { ACTIVITY_LEVELS, type ActivityLevelKey } from '../../lib/goals'

interface ActivityFieldsProps {
  value: ActivityLevelKey | ''
  onChange: (key: ActivityLevelKey) => void
  error?: string
}

/** Livello di attività: da qui il moltiplicatore del metabolismo, l'errore più grande di queste stime. */
export function ActivityFields({ value, onChange, error }: ActivityFieldsProps) {
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-ink-2">Quanto sei attivo in una settimana normale?</legend>
      <div className="mt-2 space-y-2">
        {ACTIVITY_LEVELS.map((level) => (
          <label
            key={level.key}
            className={`block min-h-14 cursor-pointer rounded-card border-2 px-4 py-3 ${
              value === level.key ? 'border-green bg-green-tint' : 'border-line bg-surface'
            }`}
          >
            <input type="radio" name="activity" value={level.key} checked={value === level.key} onChange={() => onChange(level.key)} className="sr-only" />
            <span className="block text-[15px] font-bold">{level.label}</span>
            <span className="block text-[13px] text-ink-2">{level.hint}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Nel dubbio scegli il livello più basso: dopo circa {Math.round(RECAL_MIN_DAYS / 7)} settimane la ricalibrazione lo corregge con i tuoi
        dati.
      </p>
      {error && <p className="mt-1 text-[13px] font-semibold">⚠︎ {error}</p>}
    </fieldset>
  )
}
