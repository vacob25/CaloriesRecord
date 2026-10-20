export type NavIcon = 'today' | 'foods' | 'gym' | 'stats' | 'profile'

export interface NavItem {
  to: string
  label: string
  icon: NavIcon
  /** "Oggi" sta al centro, più grande: è la schermata da cui si parte per registrare tutto. */
  primary?: boolean
  /** Altri percorsi che tengono acceso questa voce (le schermate che si raggiungono da qui). */
  alsoActiveFor?: readonly string[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/palestra', label: 'Palestra', icon: 'gym' },
  { to: '/cibi', label: 'Cibi', icon: 'foods' },
  { to: '/', label: 'Oggi', icon: 'today', primary: true, alsoActiveFor: ['/aggiungi', '/peso'] },
  { to: '/statistiche', label: 'Statistiche', icon: 'stats' },
  { to: '/profilo', label: 'Profilo', icon: 'profile' },
]

/** La voce della barra accesa per un percorso (null se nessuna). "Oggi" copre anche Aggiungi pasto e Peso. */
export function activeNavItem(pathname: string): NavItem | null {
  return (
    NAV_ITEMS.find((item) => {
      if (item.to === '/') return pathname === '/' || (item.alsoActiveFor ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))
      return pathname === item.to || pathname.startsWith(`${item.to}/`)
    }) ?? null
  )
}
