import { MEAL_BY_HOUR, MEAL_NAME_MAX, MEAL_SLOTS_MAX } from './constants'
import type { MealType } from './labels'
import { normalizeText } from './search'

/** Un pasto dell'utente. La chiave non cambia quando lo rinomini (le voci del diario puntano a lei). */
export interface MealSlot {
  key: MealType
  name: string
}

/** I cinque pasti di partenza (stesse chiavi e nomi della migrazione 007). */
export const DEFAULT_MEAL_SLOTS: readonly MealSlot[] = [
  { key: 'breakfast', name: 'Colazione' },
  { key: 'morning_snack', name: 'Snack' },
  { key: 'lunch', name: 'Pranzo' },
  { key: 'dinner', name: 'Cena' },
  { key: 'snack', name: 'Spuntino' },
]

/** Nome pulito: spazi sistemati, niente caratteri di controllo, iniziale maiuscola. */
export function cleanMealName(input: string): string {
  // eslint-disable-next-line no-control-regex
  const text = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return text === '' ? '' : text.charAt(0).toUpperCase() + text.slice(1)
}

export type SlotNameResult = { ok: true; value: string } | { ok: false; message: string }

/** Nome valido per un pasto: non vuoto, ≤ 20 caratteri, diverso dagli altri pasti (maiuscole e accenti non contano). */
export function validateMealName(input: string, slots: readonly MealSlot[], ignoreKey?: MealType): SlotNameResult {
  const name = cleanMealName(input)
  if (name === '') return { ok: false, message: 'Scrivi il nome del pasto.' }
  if (name.length > MEAL_NAME_MAX) return { ok: false, message: `Al massimo ${MEAL_NAME_MAX} caratteri.` }
  if (slots.some((slot) => slot.key !== ignoreKey && normalizeText(slot.name) === normalizeText(name))) {
    return { ok: false, message: 'Hai già un pasto con questo nome.' }
  }
  return { ok: true, value: name }
}

export function canAddSlot(slots: readonly MealSlot[]): boolean {
  return slots.length < MEAL_SLOTS_MAX
}

/** Almeno un pasto deve restare: senza, non si potrebbe registrare niente. */
export function canRemoveSlot(slots: readonly MealSlot[]): boolean {
  return slots.length > 1
}

/** Chiave di un pasto nuovo: 'custom_' + 8 caratteri esadecimali. `random` è iniettabile per i test. */
export function newSlotKey(random: () => number = Math.random): MealType {
  let hex = ''
  for (let i = 0; i < 8; i += 1) hex += Math.floor(random() * 16).toString(16)
  return `custom_${hex}`
}

/** Sposta un pasto di una posizione (−1 su, +1 giù); ai bordi non fa niente. */
export function moveSlot(slots: readonly MealSlot[], key: MealType, direction: 1 | -1): MealSlot[] {
  const from = slots.findIndex((slot) => slot.key === key)
  const to = from + direction
  if (from < 0 || to < 0 || to >= slots.length) return [...slots]
  const next = [...slots]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

/** Frase per chi non vede lo schermo, letta dopo uno spostamento: "Colazione: posizione 2 di 5". */
export function moveAnnouncement(slots: readonly MealSlot[], key: MealType): string {
  const index = slots.findIndex((slot) => slot.key === key)
  return index < 0 ? '' : `${slots[index]!.name}: posizione ${index + 1} di ${slots.length}`
}

/** Nome di un pasto dalla sua chiave ("Pasto" se la chiave non è più nell'elenco, che con la FK non succede). */
export function slotName(slots: readonly MealSlot[], key: MealType): string {
  return slots.find((slot) => slot.key === key)?.name ?? 'Pasto'
}

/**
 * Pasto proposto per un'ora locale 0-23 (fasce di MEAL_BY_HOUR). Se il pasto della fascia non c'è più
 * (l'utente l'ha eliminato) si usa quello della fascia precedente che esiste, altrimenti il primo.
 */
export function mealForHour(hour: number, slots: readonly MealSlot[]): MealType {
  const keys = new Set(slots.map((slot) => slot.key))
  let index = 0
  MEAL_BY_HOUR.forEach(([from], i) => {
    if (hour >= from) index = i
  })
  for (let step = 0; step < MEAL_BY_HOUR.length; step += 1) {
    const candidate = MEAL_BY_HOUR[(index - step + MEAL_BY_HOUR.length) % MEAL_BY_HOUR.length]![1]
    if (keys.has(candidate)) return candidate
  }
  return slots[0]?.key ?? 'snack'
}

/**
 * Trascinamento di un pasto (step 20): posizione di arrivo dopo uno spostamento verticale di `dy` px,
 * con righe alte `pitch` px (altezza + separatore). Sempre dentro l'elenco.
 */
export function dragTargetIndex(from: number, dy: number, pitch: number, count: number): number {
  if (count <= 0 || pitch <= 0) return 0
  return Math.max(0, Math.min(count - 1, Math.round(from + dy / pitch)))
}

/** Nuovo ordine dopo aver portato l'elemento in `from` alla posizione `to`. */
export function reorderByDrag<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}
