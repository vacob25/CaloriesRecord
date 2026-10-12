import { normalizeText } from './search'
import { trainingSportIndexes } from './sports'
import type { TrainingType } from './labels'

/**
 * Calorie di un allenamento medio per gli sport più comuni (step 22, ADR-075).
 * kcal della seduta = (MET − 1) · peso (kg) · ore. Il "− 1" toglie il metabolismo a riposo, che è già nel mantenimento.
 *
 * MET dal Compendium of Physical Activities (Ainsworth 2011; aggiornamento adulti 2024), letti da fonti che lo citano
 * (le tabelle ufficiali non erano raggiungibili): tennis singolo 8,0; calcio amatoriale 7,0 (agonistico 10); corsa a 6 mph
 * (~10 km/h) 9,8 (nel 2024 le tabelle riportano 9,3-10,0 secondo la colonna); sollevamento pesi con sforzo intenso 6,0.
 * Le DURATE sono ipotesi di "allenamento medio", non dati della fonte: da confermare con l'uso.
 */
export interface SportEnergy {
  /** Nome riconosciuto (il testo libero dell'utente, senza maiuscole né accenti, deve cominciare così). */
  match: RegExp
  label: string
  met: number
  minutes: number
}

export const SPORT_ENERGY: readonly SportEnergy[] = [
  { label: 'Tennis', match: /^tennis(?! (da )?tavolo)\b/, met: 8.0, minutes: 60 },
  { label: 'Corsa', match: /^(corsa|running|jogging|footing)\b/, met: 9.8, minutes: 45 },
  { label: 'Calcio', match: /^(calcio|calcetto)\b/, met: 7.0, minutes: 60 },
  // Pesi: i tempi di recupero tra le serie abbassano la media, per questo 45 minuti effettivi su una seduta di circa un'ora.
  { label: 'Palestra', match: /^(palestra|sala pesi|pesi|bodybuilding|weightlifting)\b/, met: 6.0, minutes: 45 },
]

/** Voce della tabella per un nome di sport scritto dall'utente, o undefined (sport non in elenco). */
export function sportEnergyFor(name: string): SportEnergy | undefined {
  const normalized = normalizeText(name)
  return SPORT_ENERGY.find((entry) => entry.match.test(normalized))
}

/** Calorie di una seduta (intero) per un peso: (MET − 1) · kg · ore. */
export function sessionKcal(energy: SportEnergy, weightKg: number): number {
  return Math.round((energy.met - 1) * weightKg * (energy.minutes / 60))
}

export interface TrainingBonus {
  total: number
  /** Una voce per sport del giorno: il nome e le sue kcal. `estimated` = dalla tabella; altrimenti il bonus di riserva. */
  parts: { name: string; kcal: number; estimated: boolean }[]
}

/**
 * Bonus di calorie di un giorno: la somma delle sedute degli sport fatti (più sport = si sommano). Gli sport che non sono
 * nell'elenco valgono il bonus di riserva del profilo (`fallbackKcal`, "Bonus allenamento"). Riposo = 0.
 */
export function trainingBonus(type: TrainingType, sports: readonly string[], weightKg: number, fallbackKcal: number): TrainingBonus {
  const parts = trainingSportIndexes(type)
    .map((index) => sports[index])
    .filter((name): name is string => name !== undefined)
    .map((name) => {
      const energy = sportEnergyFor(name)
      return energy ? { name, kcal: sessionKcal(energy, weightKg), estimated: true } : { name, kcal: fallbackKcal, estimated: false }
    })
  return { total: parts.reduce((sum, part) => sum + part.kcal, 0), parts }
}
