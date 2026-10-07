import type { NavIcon } from '../app/navItems'

// Icone a tratto (stroke 2, angoli arrotondati) come da docs/DESIGN.md.
const PATHS: Record<NavIcon, string> = {
  today: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  foods: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 21V3c-2 1-3 4-3 7s1 4 3 4',
  add: 'M12 5v14M5 12h14',
  stats: 'M5 20V11M12 20V4M19 20v-6',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
}

interface IconProps {
  name: NavIcon
  className?: string
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
