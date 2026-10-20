import type { MealType } from '../lib/labels'
import type { MealSlot } from '../lib/mealSlots'
import { choiceFocusClass } from './ui'

/** Scelta del pasto (radio: accessibile con VoiceOver). Va a capo se i pasti sono molti (fino a 8). */
export function MealPicker({
  value,
  onChange,
  name,
  slots,
}: {
  value: MealType
  onChange: (meal: MealType) => void
  name: string
  slots: readonly MealSlot[]
}) {
  return (
    <fieldset>
      <legend className="sr-only">Pasto</legend>
      <div className="flex flex-wrap gap-1 rounded-button bg-line/60 p-1">
        {slots.map((slot) => (
          <label
            key={slot.key}
            className={`${choiceFocusClass} flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[12px] px-2.5 text-[13px] font-semibold whitespace-nowrap ${
              value === slot.key ? 'bg-surface text-ink shadow-sm' : 'text-muted'
            }`}
          >
            <input type="radio" name={name} value={slot.key} checked={value === slot.key} onChange={() => onChange(slot.key)} className="sr-only" />
            {slot.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
