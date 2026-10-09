import { FormMessage } from '../../components/States'
import { Field } from '../../components/Field'
import { RECAL_MIN_DAYS } from '../../lib/constants'
import {
  CUT_PACES,
  cutDeficitKcal,
  cutNeedsMedicalNote,
  describeTargetRate,
  GOALS,
  GOAL_HINT,
  GOAL_LABEL,
  weeksToGoal,
  type Goal,
} from '../../lib/goals'
import { formatNumber, parseDecimal } from '../../lib/numbers'

interface GoalFieldsProps {
  goal: Goal | ''
  cutRatePct: number
  onGoalChange: (goal: Goal) => void
  onPaceChange: (pct: number) => void
  /** Peso di oggi (null se non c'è ancora): serve alla previsione del cut. */
  weightKg: number | null
  /** Età di oggi (null se la data di nascita non è valida): sotto i 18 anni il cut chiede prudenza. */
  ageYears: number | null
  /** Se presente, il campo del peso obiettivo compare qui (Benvenuto); nel Profilo si modifica in "Dati personali". */
  goalWeight?: { value: string; onChange: (value: string) => void; error?: string }
  goalError?: string
  /** Peso obiettivo già salvato (Profilo): per la previsione quando il campo non è qui. */
  savedGoalWeightKg?: number | null
}

/** Obiettivo (massa, mantenimento, definizione) con, per il cut, il ritmo e la previsione dell'arrivo. */
export function GoalFields(props: GoalFieldsProps) {
  const { goal, cutRatePct, onGoalChange, onPaceChange, weightKg, ageYears, goalWeight, goalError, savedGoalWeightKg } = props
  const goalWeightKg = goalWeight ? parseDecimal(goalWeight.value) : (savedGoalWeightKg ?? null)
  const weeks = goal === 'cut' && weightKg !== null && goalWeightKg !== null ? weeksToGoal(weightKg, goalWeightKg, cutRatePct) : null
  const pace = CUT_PACES.find((option) => option.pct === cutRatePct) ?? CUT_PACES[0]!

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-[13px] font-semibold text-ink-2">Qual è il tuo obiettivo?</legend>
        <div className="mt-2 space-y-2">
          {GOALS.map((option) => (
            <label
              key={option}
              className={`block min-h-14 cursor-pointer rounded-card border-2 px-4 py-3 ${
                goal === option ? 'border-green bg-green-tint' : 'border-line bg-surface'
              }`}
            >
              <input type="radio" name="goal" value={option} checked={goal === option} onChange={() => onGoalChange(option)} className="sr-only" />
              <span className="block text-[15px] font-bold">{GOAL_LABEL[option]}</span>
              <span className="block text-[13px] text-ink-2">{GOAL_HINT[option]}</span>
            </label>
          ))}
        </div>
        {goalError && <p className="mt-1 text-[13px] font-semibold">⚠︎ {goalError}</p>}
      </fieldset>

      {goal === 'cut' && ageYears !== null && cutNeedsMedicalNote(ageYears) && (
        <FormMessage kind="warning">
          Hai meno di 18 anni: stai ancora crescendo e dimagrire con un deficit calorico può fare male. Prima di
          cominciare parlane con un medico o un pediatra.
        </FormMessage>
      )}

      {goal === 'cut' && (
        <fieldset>
          <legend className="text-[13px] font-semibold text-ink-2">Con che ritmo vuoi dimagrire?</legend>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-button bg-line/60 p-1">
            {CUT_PACES.map((option) => (
              <label
                key={option.pct}
                className={`flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-[12px] px-1 text-center ${
                  cutRatePct === option.pct ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                }`}
              >
                <input type="radio" name="cut-pace" value={option.pct} checked={cutRatePct === option.pct} onChange={() => onPaceChange(option.pct)} className="sr-only" />
                <span className="text-[15px] font-semibold">{option.label}</span>
                <span className="text-[12px]">{formatNumber(option.pct * 100, 1)}% a sett.</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ink-2">{pace.hint}</p>
          <p className="mt-1 text-[13px] text-muted">Percentuale del peso corporeo che perdi ogni settimana.</p>
        </fieldset>
      )}

      {goalWeight && goal !== 'maintain' && goal !== '' && (
        <Field
          id="goalWeightPlan"
          label={goal === 'cut' ? 'Peso che vuoi raggiungere' : 'Peso obiettivo (facoltativo)'}
          inputMode="decimal"
          suffix="kg"
          value={goalWeight.value}
          onChange={(event) => goalWeight.onChange(event.target.value)}
          error={goalWeight.error}
        />
      )}
      {goal === 'cut' && !goalWeight && savedGoalWeightKg === null && (
        <FormMessage kind="warning">
          Per la definizione serve un peso obiettivo: scrivilo in “Dati personali” qui sopra, poi salva.
        </FormMessage>
      )}

      {goal === 'cut' && weightKg !== null && (
        <div role="status" className="rounded-card bg-surface p-4 text-[15px] text-ink-2">
          <p>
            Ritmo scelto: {describeTargetRate({ goal: 'cut', surplusPct: 0, cutRatePct }, weightKg)}. Mangerai circa{' '}
            <strong className="text-ink">{formatNumber(Math.round(cutDeficitKcal(weightKg, cutRatePct) / 10) * 10)} kcal</strong> al giorno in meno
            del tuo mantenimento.
          </p>
          {weeks !== null && goalWeightKg !== null && (
            <p className="mt-2">
              Per arrivare a <strong className="text-ink">{formatNumber(goalWeightKg, 1)} kg</strong> servono circa{' '}
              <strong className="text-ink">{weeks} settimane</strong>. È una stima ottimistica: andando avanti la perdita rallenta.
            </p>
          )}
        </div>
      )}

      {goal !== '' && (
        <details className="rounded-card bg-surface px-4 py-2 text-[15px] text-ink-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-green-dark">Come funziona</summary>
          <p className="pb-2">
            L’app parte da una stima del tuo mantenimento (le calorie che bruci in un giorno) e{' '}
            {goal === 'cut' ? 'ne toglie quanto serve per il ritmo scelto' : goal === 'bulk' ? 'aggiunge un piccolo surplus' : 'mangia quanto il mantenimento'}.
            La stima può sbagliare del 10-15%: dopo circa {Math.round(RECAL_MIN_DAYS / 7)} settimane di pasti e pesate registrati, la
            ricalibrazione la corregge con i tuoi dati veri. Più registri, più è precisa.
          </p>
        </details>
      )}
    </div>
  )
}
