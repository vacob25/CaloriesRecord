import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface ScreenHeaderProps {
  title: string
  /** Se presente, mostra "indietro" verso questo percorso. */
  backTo?: string
  action?: ReactNode
}

export function ScreenHeader({ title, backTo, action }: ScreenHeaderProps) {
  return (
    <header className="flex items-center gap-2 px-5 pt-6">
      {backTo && (
        <Link
          to={backTo}
          aria-label="Indietro"
          className="-ml-3 flex size-11 items-center justify-center rounded-full text-ink-2"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <h1 className="flex-1 text-[28px] font-extrabold leading-tight">{title}</h1>
      {action}
    </header>
  )
}
