import type { CatalogCategory } from '../lib/catalog'

/** Disegni a linea, 24×24: decorativi (il nome della categoria è sempre scritto accanto). */
const PATHS: Record<CatalogCategory, string[]> = {
  // spiga
  'Cereali e derivati': ['M12 21V8', 'M12 8c-2-1-3-3-3-5 2 1 3 3 3 5z', 'M12 8c2-1 3-3 3-5-2 1-3 3-3 5z', 'M12 13c-2-1-4-2-4-4 2 0 4 2 4 4z', 'M12 13c2-1 4-2 4-4-2 0-4 2-4 4z', 'M12 18c-2-1-4-2-4-4 2 0 4 2 4 4z', 'M12 18c2-1 4-2 4-4-2 0-4 2-4 4z'],
  // baccello con semi
  Legumi: ['M4 15c3-6 9-10 16-10-1 7-6 13-13 14-2 0-3-2-3-4z', 'M9 14.5h.01', 'M12 11.5h.01', 'M15 8.5h.01'],
  // carota
  'Verdure e ortaggi': ['M14 10 4 20', 'M14 10c-3-3-7 1-6 5', 'M14 10c3 3-1 7-5 6', 'M15 9l3-3', 'M16 7l2-4', 'M17 8l4-2'],
  // mela
  Frutta: ['M12 7c-3-2-8-1-8 5 0 5 3 9 5 9 1 0 2-1 3-1s2 1 3 1c2 0 5-4 5-9 0-6-5-7-8-5z', 'M12 7c0-2 1-4 3-4'],
  // mandorla
  'Frutta secca e semi': ['M12 3c4 4 6 8 6 11a6 6 0 0 1-12 0c0-3 2-7 6-11z', 'M12 8v9'],
  // pesce
  'Pesce e frutti di mare': ['M3 12c3-5 9-6 14-2l4-3v10l-4-3c-5 4-11 3-14-2z', 'M8 11h.01'],
  // coscia
  Carne: ['M15 4a5 5 0 0 1 5 5c0 4-4 6-7 6l-4 4-2-1-1-2 4-4c0-3 2-8 5-8z', 'M6 18l-2 2', 'M7 20l-2 1'],
  // uovo
  Uova: ['M12 3c3.5 0 6 5 6 10a6 6 0 0 1-12 0c0-5 2.5-10 6-10z'],
  // cartone del latte
  'Latte, latticini e formaggi': ['M8 3h8v3l2 3v12H6V9l2-3z', 'M8 6h8', 'M6 12h12'],
  // bottiglia d'olio con goccia
  'Grassi e condimenti': ['M10 3h4', 'M11 3v3l-3 4v10h8V10l-3-4V3', 'M12 13c1 1.5 1.5 2.5 1.5 3a1.5 1.5 0 0 1-3 0c0-.5.5-1.5 1.5-3z'],
  // tazza
  Bevande: ['M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 'M16 10h2a2 2 0 0 1 0 4h-2', 'M9 3v2', 'M12 3v2'],
  // vasetto del miele
  'Dolcificanti e altro': ['M7 6h10', 'M8 6V4h8v2', 'M6 9a2 2 0 0 1 2-3h8a2 2 0 0 1 2 3v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z', 'M9 13h6'],
}

export function CategoryIcon({ category, className = 'size-8' }: { category: CatalogCategory; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[category].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
