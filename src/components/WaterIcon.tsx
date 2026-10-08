import type { ContainerIcon } from '../lib/water'

/** Icone dei contenitori: tratto semplice, decorative (il nome è sempre scritto accanto). */
export function WaterIcon({ icon, className = 'size-7' }: { icon: ContainerIcon | 'plus'; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon === 'glass' && (
        <>
          <path d="M6 4h12l-1.5 16h-9z" />
          <path d="M6.8 11h10.4" />
        </>
      )}
      {icon === 'small-bottle' && (
        <>
          <path d="M10 3h4v3l1.5 2v12a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8L10 6z" />
          <path d="M8.5 13h7" />
        </>
      )}
      {icon === 'bottle' && (
        <>
          <path d="M10 2h4v3l2 3v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8l2-3z" />
          <path d="M8 12h8M8 16h8" />
        </>
      )}
      {icon === 'flask' && (
        <>
          <path d="M9 2h6v3H9z" />
          <path d="M8 5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          <path d="M6 12h12" />
        </>
      )}
      {icon === 'plus' && <path d="M12 5v14M5 12h14" />}
    </svg>
  )
}
