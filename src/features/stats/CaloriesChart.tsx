import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatShortDate } from '../../lib/dates'
import { DAY_STATUS_LABEL } from '../../lib/labels'
import { formatNumber } from '../../lib/numbers'
import type { DayStat, DayStatus } from '../../lib/stats'

// Colori del design: verde = rispettato, arancio = sotto target (DESIGN.md). "Oltre" non ha un colore
// nel design e in un bulk non è un allarme: grigio. Testi e assi nei colori del testo.
const STATUS_FILL: Record<DayStatus, string> = {
  respected: '#1A7F5A',
  under: '#E9861F',
  over: '#5B6170',
  noTarget: '#E4E8EE',
  unregistered: 'transparent',
}
const INK2 = '#3A3F4B'
const MUTED = '#5B6170'
const LINE = '#E4E8EE'

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: DayStat }[] }) {
  const day = payload?.[0]?.payload
  if (!active || !day) return null
  return (
    <div className="rounded-button border border-line bg-surface px-3 py-2 text-[13px] text-ink shadow-md">
      <p className="font-bold">{formatShortDate(day.date)}</p>
      <p>{day.status === 'unregistered' ? 'Non registrato' : `${formatNumber(day.kcal)} kcal`}</p>
      {day.target !== null && <p>Target {formatNumber(day.target)} kcal</p>}
      {day.status !== 'unregistered' && <p className="font-semibold">{DAY_STATUS_LABEL[day.status]}</p>}
    </div>
  )
}

/** Barre = kcal mangiate per giorno (colore = stato); tratteggio = target del giorno. Un solo asse. */
export function CaloriesChart({ days, summary }: { days: DayStat[]; summary: string }) {
  const data = days.map((day) => ({ ...day, bar: day.status === 'unregistered' ? null : day.kcal }))
  return (
    <figure>
      <div role="img" aria-label={summary} className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={LINE} />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={{ stroke: LINE }} minTickGap={16} />
            <YAxis tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatNumber(v)} />
            <Bar dataKey="bar" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((day) => (
                <Cell key={day.date} fill={STATUS_FILL[day.status]} />
              ))}
            </Bar>
            <Line type="stepAfter" dataKey="target" stroke={INK2} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
            <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(21,23,30,0.04)' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {(['respected', 'under', 'over'] as const).map((status) => (
          <span key={status} className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: STATUS_FILL[status] }} />
            {DAY_STATUS_LABEL[status]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-ink-2" /> Target
        </span>
      </figcaption>
    </figure>
  )
}
