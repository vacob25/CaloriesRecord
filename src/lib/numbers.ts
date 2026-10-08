/**
 * Numeri scritti dall'utente in italiano: "3,5" e "3.5" valgono lo stesso.
 * Restituisce null se il testo non è un numero (vuoto compreso).
 */
export function parseDecimal(input: string): number | null {
  const text = input.trim().replace(/\s+/g, '').replace(',', '.')
  if (text === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Arrotonda a `decimals` cifre evitando gli errori di virgola mobile (1.005 → 1.01). */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

const formatters = new Map<number, Intl.NumberFormat>()

/** Formatta in italiano (virgola decimale), con al massimo `decimals` cifre dopo la virgola. */
export function formatNumber(value: number, decimals = 0): string {
  let formatter = formatters.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: decimals })
    formatters.set(decimals, formatter)
  }
  return formatter.format(value)
}
