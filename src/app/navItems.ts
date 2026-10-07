export type NavIcon = 'today' | 'foods' | 'add' | 'stats' | 'profile'

export interface NavItem {
  to: string
  label: string
  icon: NavIcon
  /** Il pulsante centrale "+" ha uno stile diverso e solo l'icona. */
  primary?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Oggi', icon: 'today' },
  { to: '/cibi', label: 'Cibi', icon: 'foods' },
  { to: '/aggiungi', label: 'Aggiungi pasto', icon: 'add', primary: true },
  { to: '/statistiche', label: 'Statistiche', icon: 'stats' },
  { to: '/profilo', label: 'Profilo', icon: 'profile' },
]
