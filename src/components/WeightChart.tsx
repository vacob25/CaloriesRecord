import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'

import { formatShortDate } from '../lib/dates'
import { formatNumber } from '../lib/numbers'
import type { WeightPoint } from '../lib/weight'

// Colori del design: blu = peso e traguardo (DESIGN.md). Testi e assi nei colori del testo.
const BLUE = '#2F62D9'
const MUTED = '#5B6170'
const LINE = '#E4E8EE'
const SURFACE = '#FFFFFF'

interface WeightChartProps {
  points: WeightPoint[]
  goalKg: number | null
  /** Frase che descrive il risultato (alternativa testuale del grafico). */
  summary: string
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: WeightPoint }[] }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-button border border-line bg-surface px-3 py-2 text-[13px] text-ink shadow-md">
      <p className="font-bold">{formatShortDate(point.date)}</p>
      <p>Pesata: {point.kg === null ? '—' : `${formatNumber(point.kg, 1)} kg`}</p>
      <p>Media 7 giorni: {point.average === null ? '—' : `${formatNumber(point.average, 1)} kg`}</p>
    </div>
  )
}

/** Punti = pesate grezze; linea = media mobile 7 giorni; tratteggio = traguardo. Un solo asse. */
export function WeightChart({ points, goalKg, summary }: WeightChartProps) {
  const values = points.flatMap((p) => [p.kg, p.average]).filter((v): v is number => v !== null)
  if (goalKg !== null) values.push(goalKg)
  const min = Math.floor(Math.min(...values) - 0.5)
  const max = Math.ceil(Math.max(...values) + 0.5)

  return (
    <figure>
      <div role="img" aria-label={summary} className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={LINE} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: MUTED, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: LINE }}
              minTickGap={24}
            />
            <YAxis
              domain={[min, max]}
              allowDecimals={false}
              tick={{ fill: MUTED, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) => formatNumber(value)}
            />
            {goalKg !== null && (
              <ReferenceLine
                y={goalKg}
                stroke={BLUE}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{ value: `Traguardo ${formatNumber(goalKg, 1)}`, position: 'insideTopRight', fill: MUTED, fontSize: 11 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="average"
              stroke={BLUE}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Scatter dataKey="kg" fill={BLUE} stroke={SURFACE} strokeWidth={2} isAnimationActive={false} />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: LINE }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-blue" /> Pesata
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="h-0.5 w-4 bg-blue" /> Media 7 giorni
        </span>
        {goalKg !== null && (
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-blue" /> Traguardo
          </span>
        )}
      </figcaption>
    </figure>
  )
}
