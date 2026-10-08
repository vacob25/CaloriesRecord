/**
 * Controllo dei limiti di richieste in una finestra scorrevole.
 * Pura: riceve gli orari delle richieste già fatte e restituisce se si può procedere.
 */
export function checkRateLimit(
  timestamps: readonly number[],
  now: number,
  limit: number,
  windowMs = 60_000,
): { allowed: true; recent: number[] } | { allowed: false; retryInSeconds: number; recent: number[] } {
  const recent = timestamps.filter((t) => now - t < windowMs)
  if (recent.length < limit) return { allowed: true, recent: [...recent, now] }
  const oldest = Math.min(...recent)
  return { allowed: false, retryInSeconds: Math.ceil((oldest + windowMs - now) / 1000), recent }
}
