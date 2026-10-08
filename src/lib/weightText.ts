import { formatNumber } from './numbers'
import type { WeightPoint } from './weight'
import { averageChange } from './weight'

/** Frase che riassume il grafico (alternativa testuale, DESIGN.md: "Peso in salita di 0,6 kg in 4 settimane"). */
export function weightSummary(points: readonly WeightPoint[]): string {
  const change = averageChange(points)
  if (!change) {
    const count = points.filter((p) => p.kg !== null).length
    return count === 0 ? 'Nessuna pesata nel periodo.' : `${count} pesate nel periodo: servono almeno 4 pesate in 7 giorni per la media.`
  }
  const weeks = change.days / 7
  const span = weeks >= 1.5 ? `${formatNumber(weeks, 0)} settimane` : `${formatNumber(change.days, 0)} giorni`
  if (Math.abs(change.kg) < 0.05) return `Media stabile in ${span}.`
  return `Media in ${change.kg > 0 ? 'salita' : 'discesa'} di ${formatNumber(Math.abs(change.kg), 1)} kg in ${span}.`
}
