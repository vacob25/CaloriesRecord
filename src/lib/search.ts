/** Testo confrontabile: minuscolo, senza accenti e spazi doppi ("Caffè  Latte" → "caffe latte"). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Filtra per ricerca: ogni parola cercata deve comparire nel nome o nella marca.
 * Ricerca vuota → tutti. L'ordine originale resta invariato.
 */
export function filterByQuery<T extends { name: string; brand?: string | null }>(items: readonly T[], query: string): T[] {
  const words = normalizeText(query).split(' ').filter(Boolean)
  if (words.length === 0) return [...items]
  return items.filter((item) => {
    const haystack = normalizeText(`${item.name} ${item.brand ?? ''}`)
    return words.every((word) => haystack.includes(word))
  })
}
