import { MEAL_LABEL, MEAL_TYPES, type MealType } from '../lib/labels'

/** Scelta del pasto a 5 segmenti (radio: accessibile con VoiceOver). */
export function MealPicker({ value, onChange, name }: { value: MealType; onChange: (meal: MealType) => void; name: string }) {
  return (
    <fieldset>
      <legend className="sr-only">Pasto</legend>
      <div className="grid grid-cols-5 gap-1 rounded-button bg-line/60 p-1">
        {MEAL_TYPES.map((meal) => (
          <label
            key={meal}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] px-0.5 text-[12px] font-semibold ${
              value === meal ? 'bg-surface text-ink shadow-sm' : 'text-muted'
            }`}
          >
            <input type="radio" name={name} value={meal} checked={value === meal} onChange={() => onChange(meal)} className="sr-only" />
            {MEAL_LABEL[meal]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
