/** Classi condivise (token di docs/DESIGN.md): un solo posto per lo stile dei controlli. */

export const inputClass =
  'mt-2 block min-h-12 w-full rounded-button border border-line bg-surface px-4 text-[17px] text-ink outline-none focus:border-green focus:ring-2 focus:ring-green aria-[invalid=true]:border-2 aria-[invalid=true]:border-ink'

/**
 * Anello di focus per le scelte a carte e a segmenti: l'input radio è nascosto (`sr-only`), quindi l'anello va sulla
 * etichetta che lo contiene. Si vede solo con la tastiera (focus-visible), non toccando con il dito (revisione #48).
 */
export const choiceFocusClass = 'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green has-[:focus-visible]:ring-offset-2'

export const primaryButtonClass =
  'min-h-12 w-full rounded-button bg-green px-4 text-[15px] font-bold text-surface disabled:opacity-60'

export const secondaryButtonClass =
  'min-h-12 w-full rounded-button border border-line bg-surface px-4 text-[15px] font-bold text-ink disabled:opacity-60'

/** Azione distruttiva: niente colore dedicato nel design, la riconosce il testo ("Elimina") e la conferma. */
export const dangerButtonClass =
  'min-h-12 w-full rounded-button border-2 border-ink bg-surface px-4 text-[15px] font-bold text-ink disabled:opacity-60'

export const cardClass = 'rounded-card bg-surface shadow-[0_1px_3px_rgba(21,23,30,0.08)]'
