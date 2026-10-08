import type { ReactNode } from 'react'

interface RingProps {
  /** Quanto è pieno, 0-1 (calcolato in lib/targets.ts). */
  fraction: number
  size?: number
  stroke?: number
  children: ReactNode
  label: string
}

/** Anello di avanzamento delle calorie. Il testo al centro porta il valore (non solo il colore). */
export function Ring({ fraction, size = 168, stroke = 14, children, label }: RingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-green transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  )
}
