import { Link, useLocation } from 'react-router-dom'

import { Icon } from '../components/Icon'
import { activeNavItem, NAV_ITEMS } from './navItems'

/**
 * Barra in basso. La voce in cui sei diventa verde (riempita, testo bianco); "Oggi" sta al centro, più grande e rialzata.
 * Il passaggio tra una voce e l'altra è una transizione di colore e dimensione (disattivata con "riduci movimento").
 */
export function BottomNav() {
  const { pathname } = useLocation()
  const active = activeNavItem(pathname)

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <ul className="mx-auto grid h-nav max-w-[480px] grid-cols-5 items-center">
        {NAV_ITEMS.map((item) => {
          const isActive = active?.to === item.to
          return (
            <li key={item.to} className="flex justify-center">
              <Link
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={
                  item.primary
                    ? `-mt-6 flex size-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-bg text-[11px] shadow-md transition-all duration-300 ease-out ${
                        isActive ? 'scale-105 bg-green font-extrabold text-surface' : 'bg-surface font-bold text-green'
                      }`
                    : `flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[11px] transition-all duration-300 ease-out ${
                        isActive ? 'bg-green font-extrabold text-surface' : 'font-semibold text-muted'
                      }`
                }
              >
                <Icon name={item.icon} className={item.primary ? 'size-7' : 'size-6'} />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
