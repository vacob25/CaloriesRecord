// Logica pura dell'importazione degli esercizi (Fase 3, ADR-089): filtro, vocabolari, traduzione dei nomi.
// Nessun accesso a rete o file: si prova con Vitest (lib.test.ts) e la usa build.mjs.
import { PHRASES, TOKENS } from './glossary.mjs'

/** Vocabolario dei muscoli: chiave interna (stabile) ed etichetta italiana. Valori reali della fonte, verificati. */
export const MUSCLES = {
  chest: 'Petto',
  lats: 'Dorsali',
  upper_back: 'Parte alta della schiena',
  lower_back: 'Lombari',
  traps: 'Trapezi',
  shoulders: 'Spalle',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  abdominals: 'Addominali',
  glutes: 'Glutei',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  calves: 'Polpacci',
  adductors: 'Adduttori',
  abductors: 'Abduttori',
  neck: 'Collo',
}

/** Valore della fonte → chiave nostra. Una regola esplicita per ogni valore: se ne compare uno nuovo, l'importazione si ferma. */
export const MUSCLE_MAP = {
  chest: 'chest', lats: 'lats', 'middle back': 'upper_back', 'lower back': 'lower_back', traps: 'traps', shoulders: 'shoulders',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms', abdominals: 'abdominals', glutes: 'glutes', quadriceps: 'quadriceps',
  hamstrings: 'hamstrings', calves: 'calves', adductors: 'adductors', abductors: 'abductors', neck: 'neck',
}

export const EQUIPMENT = {
  barbell: 'Bilanciere', ez_bar: 'Bilanciere EZ', dumbbell: 'Manubri', cable: 'Cavi', machine: 'Macchina', kettlebell: 'Kettlebell',
  bodyweight: 'Corpo libero', bands: 'Elastici', ball: 'Palla', plate: 'Disco', other: 'Altro',
}

const EQUIPMENT_MAP = {
  barbell: 'barbell', 'e-z curl bar': 'ez_bar', dumbbell: 'dumbbell', cable: 'cable', machine: 'machine', kettlebells: 'kettlebell',
  'body only': 'bodyweight', bands: 'bands', 'medicine ball': 'ball', 'exercise ball': 'ball',
}

/** Categorie e attrezzi che non c'entrano con un diario di palestra, con il motivo (finisce nel report). */
const EXCLUDED_CATEGORY = {
  stretching: 'stretching: non è allenamento con carichi',
  cardio: 'cardio: non fa parte del diario di forza',
  strongman: 'strongman: slitte, pietre e pneumatici, non da palestra comune',
}
const EXCLUDED_EQUIPMENT = { 'foam roll': 'foam roll: automassaggio, non allenamento' }

export function excludeReason(exercise) {
  return EXCLUDED_CATEGORY[exercise.category] ?? EXCLUDED_EQUIPMENT[exercise.equipment] ?? null
}

/** Attrezzo nostro. Per 'other' e senza valore si deducono dal nome con regole esplicite; il resto va in "Altro". */
export function mapEquipment(exercise) {
  const direct = EQUIPMENT_MAP[exercise.equipment ?? '']
  if (direct) return { key: direct, inferred: false }
  const name = exercise.name.toLowerCase()
  if (/\bplates?\b/.test(name)) return { key: 'plate', inferred: true }
  if (/\bbands?\b/.test(name)) return { key: 'bands', inferred: true }
  if (/\b(chins?|pull-?ups?|dips?|muscle up|rings?|inverted|hanging|bodyweight|push-?ups?|lunge|hyperextensions?|glute-ham)\b/.test(name)) return { key: 'bodyweight', inferred: true }
  return { key: 'other', inferred: true }
}

export function mapMuscles(sourceMuscles) {
  return sourceMuscles.map((value) => {
    const key = MUSCLE_MAP[value]
    if (!key) throw new Error(`muscolo sconosciuto nella fonte: "${value}" (aggiungere una regola in MUSCLE_MAP)`)
    return key
  })
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** Parte del corpo che è già dentro al nome dell'esercizio: "Curl" implica i bicipiti, non si ripete. */
const REDUNDANT_PART = { Curl: ['bicipiti', 'braccio'], Pushdown: ['tricipiti'], 'Calf raise': ['polpacci'], Crunch: ['addominali'], Shrug: ['spalle'] }

function tokenize(name) {
  return (name.replace(/[’']s\b/g, '').toLowerCase().match(/[a-z0-9]+/g) ?? []).map((word) => (word === 'e' || word === 'z' ? word : word))
}

/**
 * Traduce un nome inglese. `review: true` se resta qualcosa che il glossario non conosce o se il nome è molto lungo:
 * in quel caso l'app lo mostra "da rivedere" e Riccardo lo può correggere.
 */
export function translateName(englishName) {
  const words = tokenize(englishName)
  const heads = []
  const mods = []
  const parts = []
  const equips = []
  const unknown = []

  let i = 0
  while (i < words.length) {
    let matched = null
    for (let n = Math.min(5, words.length - i); n >= 2 && !matched; n -= 1) {
      const entry = PHRASES[words.slice(i, i + n).join(' ')]
      if (entry) matched = { entry, length: n }
    }
    const single = matched ? null : TOKENS[words[i]]
    const entry = matched?.entry ?? single
    const length = matched?.length ?? 1
    if (!entry) {
      unknown.push(words[i])
      heads.push(capitalize(words[i]))
    } else if (entry.kind === 'head' || entry.kind === 'keep' || entry.kind === 'name') heads.push(entry.it)
    else if (entry.kind === 'mod') mods.push(entry.it)
    else if (entry.kind === 'part') parts.push(entry.it)
    else if (entry.kind === 'equip') equips.push(entry.it)
    i += length
  }

  // Panca: "Incline Bench Press" → "Panca inclinata", non "Panca piana su panca inclinata".
  const bench = heads.indexOf('Panca piana')
  if (bench >= 0) {
    const incline = mods.indexOf('su panca inclinata')
    const decline = mods.indexOf('su panca declinata')
    if (incline >= 0) { heads[bench] = 'Panca inclinata'; mods.splice(incline, 1) }
    else if (decline >= 0) { heads[bench] = 'Panca declinata'; mods.splice(decline, 1) }
  }
  const flatIndex = mods.indexOf('su panca piana')
  if (flatIndex >= 0 && heads.includes('Panca piana')) mods.splice(flatIndex, 1)

  const redundant = heads.flatMap((head) => REDUNDANT_PART[head] ?? [])
  const keptParts = parts.filter((part) => !redundant.includes(part)).map((part) => `per ${part}`)

  const equipText = [...new Set(equips)].map((e) => (/^(con|ai|alla|al|a|su)\b/.test(e) ? e : `con ${e}`)).join(' ')
  const core = [...heads, ...keptParts, ...mods, equipText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  const it = capitalize(core || englishName)
  const review = unknown.length > 0 || words.length > 7 || core === ''
  return { it, review, unknown }
}

/** Slug stabile per `source_id` (la fonte usa già un id, ma lo ricontrolliamo). */
export function checkSourceId(id) {
  if (!/^[A-Za-z0-9_().,'’+-]+$/.test(id)) throw new Error(`id della fonte inatteso: ${id}`)
  return id
}

/**
 * Applica una correzione (overrides.mjs) a una riga già mappata. Il principale precedente e i secondari che c'erano
 * restano tra i secondari (a meno che non diventino il nuovo principale).
 */
export function applyOverride(row, override) {
  if (!override) return row
  const primary = override.primary ? [override.primary] : row.primary
  const secondary = [...new Set([...(override.secondaryFirst ?? []), ...(override.primary ? row.primary : []), ...row.secondary])].filter((muscle) => !primary.includes(muscle))
  return { ...row, primary, secondary, equipment: override.equipment ?? row.equipment }
}
