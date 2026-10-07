import { NavLink } from 'react-router-dom'

import { Icon } from '../components/Icon'
import { NAV_ITEMS } from './navItems'

export function BottomNav() {
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <ul className="mx-auto grid h-nav max-w-[480px] grid-cols-5 items-center">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex justify-center">
            {item.primary ? (
              <NavLink
                to={item.to}
                aria-label={item.label}
                className="flex size-12 items-center justify-center rounded-full bg-green text-surface shadow-md"
              >
                <Icon name={item.icon} className="size-6" />
              </NavLink>
            ) : (
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] ${
                    isActive ? 'font-extrabold text-green' : 'font-semibold text-muted'
                  }`
                }
              >
                <Icon name={item.icon} className="size-6" />
                <span>{item.label}</span>
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
