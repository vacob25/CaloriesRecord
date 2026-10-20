/**
 * Nome pulito: spazi sistemati, niente caratteri di controllo, iniziale maiuscola ("calcio a 5" → "Calcio a 5").
 * Vale per i nomi che scrive l'utente (sport, pasti).
 */
export function cleanName(input: string): string {
  // eslint-disable-next-line no-control-regex
  const text = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return text === '' ? '' : text.charAt(0).toUpperCase() + text.slice(1)
}
