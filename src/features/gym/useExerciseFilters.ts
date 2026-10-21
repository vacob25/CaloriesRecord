import { useCallback, useState } from 'react'

import { EQUIPMENT_KEYS, MUSCLE_KEYS, type EquipmentKey, type MuscleKey } from '../../lib/exercises'

export interface ExerciseFilters {
  query: string
  muscle: MuscleKey | ''
  equipment: EquipmentKey | ''
  showHidden: boolean
}

const EMPTY: ExerciseFilters = { query: '', muscle: '', equipment: '', showHidden: false }
const STORAGE_KEY = 'caloriesrecord.exerciseFilters'

// In memoria per la sessione dell'app, e in sessionStorage per sopravvivere a un ricaricamento della pagina. Non contiene
// dati personali (solo i filtri scelti) e sparisce alla chiusura della scheda.
let remembered: ExerciseFilters | null = null

function read(): ExerciseFilters {
  if (remembered) return remembered
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ExerciseFilters> | null
    if (raw && typeof raw === 'object') {
      remembered = {
        query: typeof raw.query === 'string' ? raw.query.slice(0, 80) : '',
        muscle: (MUSCLE_KEYS as readonly string[]).includes(raw.muscle ?? '') ? (raw.muscle as MuscleKey) : '',
        equipment: (EQUIPMENT_KEYS as readonly string[]).includes(raw.equipment ?? '') ? (raw.equipment as EquipmentKey) : '',
        showHidden: raw.showHidden === true,
      }
      return remembered
    }
  } catch {
    // sessionStorage non disponibile o contenuto rovinato: si riparte dai filtri vuoti.
  }
  return EMPTY
}

function write(filters: ExerciseFilters) {
  remembered = filters
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // Senza sessionStorage i filtri restano comunque in memoria finché l'app è aperta.
  }
}

/** Filtri della libreria esercizi che si ricordano tornando indietro dalla scheda di un esercizio. */
export function useExerciseFilters(): [ExerciseFilters, (patch: Partial<ExerciseFilters>) => void] {
  const [filters, setFilters] = useState(read)
  const update = useCallback((patch: Partial<ExerciseFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch }
      write(next)
      return next
    })
  }, [])
  return [filters, update]
}
