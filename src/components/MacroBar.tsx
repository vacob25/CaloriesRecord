import { formatNumber } from '../lib/numbers'

interface MacroBarProps {
  label: string
  eaten: number
  goal: number
  /** Avanzamento 0-1 (lib/targets.ts). */
  progress: number
  /** Classe del colore fisso del macro (DESIGN.md): bg-blue, bg-orange, bg-magenta. */
  colorClass: string
}

/** Barra di un macro con "mangiati / obiettivo" scritto: il colore non è l'unica informazione. */
export function MacroBar({ label, eaten, goal, progress, colorClass }: MacroBarProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-ink-2">{label}</span>
        <span className="tabular-nums text-ink">
          <span className="font-bold">{formatNumber(eaten)}</span> / {formatNumber(goal)} g
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  )
}
