interface FavoriteButtonProps {
  name: string
  isFavorite: boolean
  disabled?: boolean
  onToggle: () => void
}

/** Stella dei preferiti: piena/vuota (forma, non solo colore) e aria-pressed. */
export function FavoriteButton({ name, isFavorite, disabled, onToggle }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Togli ${name} dai preferiti` : `Aggiungi ${name} ai preferiti`}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-green disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
    </button>
  )
}
