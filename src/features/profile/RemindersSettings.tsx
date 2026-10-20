import { useState } from 'react'

import { FormMessage } from '../../components/States'
import { useToday } from '../../components/useToday'
import { secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useMealSlots, useReminderHistory, useReminderSettings, useSaveReminderSetting } from '../../data/queries'
import {
  SUSPEND_PROPOSAL_DAYS,
  defaultReminderTime,
  initialSetting,
  mealReminderSlot,
  shouldProposeSuspension,
  snapReminderTime,
  type ReminderSetting,
} from '../../lib/reminders'

const timeInputClass =
  'block min-h-12 w-32 rounded-button border border-line bg-surface px-3 text-[17px] text-ink outline-none focus:border-green focus:ring-2 focus:ring-green'

/** Promemoria dei pasti (Fase 2, ADR-087): per ogni pasto attivo/spento, orario e orario diverso nel weekend. */
export function RemindersSettings() {
  const slots = useMealSlots()
  const settings = useReminderSettings()
  const today = useToday()
  const history = useReminderHistory(today)
  const save = useSaveReminderSetting()

  if (slots.isPending || settings.isPending) return <p className="mt-3 text-[13px] text-muted">Caricamento dei promemoria…</p>
  if (slots.isError || settings.isError) return <FormMessage kind="error">{errorMessage(slots.error ?? settings.error)}</FormMessage>

  const bySlot = new Map(settings.data.map((setting) => [setting.slot, setting]))
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="text-[16px] font-extrabold">Promemoria dei pasti</h3>
      <p className="mt-1 text-[13px] text-muted">
        Arrivano solo se quel pasto non è già registrato. Orari al passo di 5 minuti, ora di Roma. Il testo è sempre generico.
      </p>
      <ul className="mt-3 space-y-4">
        {slots.data.map((slot) => {
          const current = bySlot.get(mealReminderSlot(slot.key)) ?? initialSetting(slot.key)
          const proposal =
            current.enabled &&
            history.data !== undefined &&
            shouldProposeSuspension({
              sentDays: history.data.sentDays[current.slot] ?? [],
              doneDays: history.data.doneDays[current.slot] ?? [],
              today,
              dismissedDay: current.proposalDismissedDay,
            })
          return (
            <li key={`${slot.key}|${current.enabled}|${current.timeWeekday}|${current.timeWeekend ?? ''}`}>
              <MealReminderRow
                name={slot.name}
                mealKey={slot.key}
                setting={current}
                onChange={(next) => save.mutate(next)}
              />
              {proposal && (
                <div role="status" className="mt-2 rounded-button border border-line bg-bg p-3">
                  <p className="text-[14px] text-ink">
                    Da {SUSPEND_PROPOSAL_DAYS} giorni il promemoria di “{slot.name}” parte ma il pasto non risulta registrato. Lo sospendo?
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" className={secondaryButtonClass} onClick={() => save.mutate({ ...current, enabled: false })}>
                      Sospendi
                    </button>
                    <button type="button" className={secondaryButtonClass} onClick={() => save.mutate({ ...current, proposalDismissedDay: today })}>
                      Continua
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {save.isError && <FormMessage kind="error">{errorMessage(save.error)}</FormMessage>}
    </div>
  )
}

interface RowProps {
  name: string
  mealKey: string
  setting: ReminderSetting
  onChange: (next: ReminderSetting) => void
}

function MealReminderRow({ name, mealKey, setting, onChange }: RowProps) {
  const [weekday, setWeekday] = useState(setting.timeWeekday)
  const [weekend, setWeekend] = useState(setting.timeWeekend ?? setting.timeWeekday)
  // Le due caselle cambiano subito al tocco (stato locale); se il salvataggio fallisce la riga si ricrea con i valori veri.
  const [enabled, setEnabled] = useState(setting.enabled)
  const [differentWeekend, setDifferentWeekend] = useState(setting.timeWeekend !== null)

  /** iOS non rispetta il passo del campo orario: si riporta al passo di 5 minuti prima di salvare. */
  const commitTime = (value: string, field: 'timeWeekday' | 'timeWeekend') => {
    const snapped = snapReminderTime(value) ?? (field === 'timeWeekday' ? defaultReminderTime(mealKey) : setting.timeWeekday)
    if (field === 'timeWeekday') setWeekday(snapped)
    else setWeekend(snapped)
    if (snapped !== setting[field]) onChange({ ...setting, [field]: snapped })
  }

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Promemoria {name}</legend>
      <label className="flex min-h-11 items-center gap-3 text-[16px] font-bold text-ink">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked)
            onChange({ ...setting, enabled: event.target.checked })
          }}
          className="size-5 accent-green"
        />
        {name}
      </label>
      {enabled && (
        <div className="ml-8 mt-1 space-y-2">
          <label className="flex flex-wrap items-center gap-3 text-[14px] text-muted">
            <span className="w-28">{differentWeekend ? 'Lun–ven' : 'Ogni giorno'}</span>
            <input
              type="time"
              step={300}
              value={weekday}
              onChange={(event) => setWeekday(event.target.value)}
              onBlur={(event) => commitTime(event.target.value, 'timeWeekday')}
              className={timeInputClass}
            />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-[14px] text-ink">
            <input
              type="checkbox"
              checked={differentWeekend}
              onChange={(event) => {
                setDifferentWeekend(event.target.checked)
                onChange({ ...setting, timeWeekend: event.target.checked ? weekday : null })
              }}
              className="size-5 accent-green"
            />
            Orario diverso nel weekend
          </label>
          {differentWeekend && (
            <label className="flex flex-wrap items-center gap-3 text-[14px] text-muted">
              <span className="w-28">Sab–dom</span>
              <input
                type="time"
                step={300}
                value={weekend}
                onChange={(event) => setWeekend(event.target.value)}
                onBlur={(event) => commitTime(event.target.value, 'timeWeekend')}
                className={timeInputClass}
              />
            </label>
          )}
        </div>
      )}
    </fieldset>
  )
}
