// Importazione una tantum del catalogo esercizi (Fase 3, ADR-089). NON fa parte del build dell'app.
//   node scripts/exercises/build.mjs <exercises.json> [--check]
// Scarica prima il file da https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
// (licenza Unlicense, pubblico dominio). Scrive:
//   supabase/migrations/014_exercise_catalog_seed.sql   i dati, pronti da eseguire (idempotenti)
//   docs/REPORT_ESERCIZI.md                             scartati e nomi da rivedere
//   docs/GLOSSARIO_ESERCIZI.md                          il glossario usato per tradurre i nomi
// Dopo l'importazione l'app non dipende più dalla rete esterna: i dati stanno nel nostro database.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import { PHRASES, TOKENS } from './glossary.mjs'
import { EQUIPMENT, excludeReason, mapEquipment, mapMuscles, translateName, checkSourceId } from './lib.mjs'

const [, , input, flag] = process.argv
if (!input) throw new Error('uso: node scripts/exercises/build.mjs <exercises.json> [--check]')
const source = JSON.parse(readFileSync(input, 'utf8'))
const raw = readFileSync(input)
const sha = createHash('sha256').update(raw).digest('hex')

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`
const array = (items) => `array[${items.map(quote).join(', ')}]::text[]`
const nullable = (value) => (value ? quote(value) : 'null')

const excluded = new Map()
const kept = []
const seen = new Set()
for (const exercise of source) {
  const reason = excludeReason(exercise)
  if (reason) {
    excluded.set(reason, [...(excluded.get(reason) ?? []), exercise.name])
    continue
  }
  const sourceId = checkSourceId(exercise.id)
  if (seen.has(sourceId)) throw new Error(`id duplicato nella fonte: ${sourceId}`)
  seen.add(sourceId)
  const primary = mapMuscles(exercise.primaryMuscles)
  if (primary.length === 0) throw new Error(`nessun muscolo primario: ${exercise.name}`)
  const equipment = mapEquipment(exercise)
  const name = translateName(exercise.name)
  kept.push({
    sourceId,
    nameEn: exercise.name,
    nameIt: name.it,
    review: name.review,
    unknown: name.unknown,
    equipment: equipment.key,
    equipmentInferred: equipment.inferred,
    primary,
    secondary: mapMuscles(exercise.secondaryMuscles).filter((muscle) => !primary.includes(muscle)),
    category: exercise.category,
    mechanic: exercise.mechanic ?? null,
    force: exercise.force ?? null,
    level: exercise.level,
  })
}
kept.sort((a, b) => a.sourceId.localeCompare(b.sourceId))

const rows = kept
  .map(
    (e) =>
      `  (${quote(e.sourceId)}, ${quote(e.nameEn)}, ${quote(e.nameIt)}, ${e.review}, ${quote(e.equipment)}, ${array(e.primary)}, ${array(e.secondary)}, ${quote(e.category)}, ${nullable(e.mechanic)}, ${nullable(e.force)}, ${quote(e.level)})`,
  )
  .join(',\n')

const sql = `-- Migrazione 014 (Fase 3, ADR-089): dati del catalogo esercizi. GENERATA da scripts/exercises/build.mjs: non si modifica a mano.
-- Fonte: free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense/pubblico dominio), file dist/exercises.json
-- sha256 ${sha}. Sono ${kept.length} esercizi su ${source.length}; i ${source.length - kept.length} scartati e il perché stanno in docs/REPORT_ESERCIZI.md.
-- Niente istruzioni e niente immagini (ADR-089). Si può rieseguire: ON CONFLICT aggiorna i nomi e i gruppi senza toccare gli id.
insert into public.exercise_catalog
  (source_id, name_en, name_it, name_needs_review, equipment, primary_muscles, secondary_muscles, category, mechanic, force, level)
values
${rows}
on conflict (source, source_id) do update set
  name_en = excluded.name_en, name_it = excluded.name_it, name_needs_review = excluded.name_needs_review,
  equipment = excluded.equipment, primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles,
  category = excluded.category, mechanic = excluded.mechanic, force = excluded.force, level = excluded.level;
`
if (flag !== '--check') writeFileSync(new URL('../../supabase/migrations/014_exercise_catalog_seed.sql', import.meta.url), sql)

// ── Report ──────────────────────────────────────────────────────────────
const review = kept.filter((e) => e.review)
const byEquipment = Object.entries(Object.groupBy(kept, (e) => e.equipment)).map(([key, list]) => `${EQUIPMENT[key]}: ${list.length}`)
const inferred = kept.filter((e) => e.equipmentInferred)
const lines = [
  '# Report importazione esercizi (Fase 3)',
  '',
  `Fonte: free-exercise-db, file \`dist/exercises.json\`, sha256 \`${sha}\`. Generato da \`scripts/exercises/build.mjs\`.`,
  '',
  `- Esercizi nella fonte: **${source.length}**. Importati: **${kept.length}**. Scartati: **${source.length - kept.length}**.`,
  `- Muscoli: 100% mappati con regole esplicite (\`MUSCLE_MAP\`); un valore sconosciuto ferma l'importazione.`,
  `- Attrezzi: ${byEquipment.join(' · ')}. Dedotti dal nome (la fonte dice "other" o niente): ${inferred.length}.`,
  `- Nomi italiani: ${kept.length - review.length} tradotti dal glossario, **${review.length} segnati "da rivedere"** (restano parole che il glossario non conosce o nomi molto lunghi): si correggono dall'app.`,
  '',
  '## Scartati e perché',
  '',
  ...[...excluded.entries()].flatMap(([reason, names]) => [`- **${reason}** (${names.length}): ${names.slice(0, 6).join(', ')}${names.length > 6 ? ', …' : ''}`]),
  '',
  '## Nomi da rivedere (primi 60)',
  '',
  '| Inglese | Italiano proposto | Parole non riconosciute |',
  '| --- | --- | --- |',
  ...review.slice(0, 60).map((e) => `| ${e.nameEn} | ${e.nameIt} | ${e.unknown.join(', ') || '(nome lungo)'} |`),
  '',
]
if (flag !== '--check') writeFileSync(new URL('../../docs/REPORT_ESERCIZI.md', import.meta.url), lines.join('\n'))

const KIND = { head: 'nome (tradotto)', keep: 'resta in inglese', name: 'nome proprio (resta)', mod: 'dopo il nome', part: 'parte del corpo ("per …")', equip: 'attrezzo (in coda)', drop: 'si toglie' }
const glossary = [
  '# Glossario dei nomi degli esercizi',
  '',
  'Generato da `scripts/exercises/glossary.mjs` (non si modifica a mano). Regola scelta da Riccardo: si traduce tutto **tranne** macchinari ed esercizi che in palestra si dicono in inglese (pulldown, pec fly, curl, squat, crunch…). Quello che il glossario non conosce resta com\'è e il nome è segnato "da rivedere".',
  '',
  'Ordine del nome italiano: **nome dell\'esercizio**, poi **parti del corpo** ("per …"), poi **varianti** (in piedi, presa stretta, a un braccio…), infine l\'**attrezzo** ("con manubri").',
  '',
  '## Frasi',
  '',
  '| Inglese | Italiano | Tipo |',
  '| --- | --- | --- |',
  ...Object.entries(PHRASES).map(([en, v]) => `| ${en} | ${v.it} | ${KIND[v.kind]} |`),
  '',
  '## Parole',
  '',
  '| Inglese | Italiano | Tipo |',
  '| --- | --- | --- |',
  ...Object.entries(TOKENS).map(([en, v]) => `| ${en} | ${v.it ?? '—'} | ${KIND[v.kind]} |`),
  '',
]
if (flag !== '--check') writeFileSync(new URL('../../docs/GLOSSARIO_ESERCIZI.md', import.meta.url), glossary.join('\n'))
console.log(JSON.stringify({ total: source.length, kept: kept.length, excluded: source.length - kept.length, review: review.length, sqlBytes: sql.length, sha }))
