import { useParams } from 'react-router-dom'

import { useExercises } from '../../data/queries'
import { catalogKey, type Exercise } from '../../lib/exercises'

/**
 * L'esercizio indicato dal percorso. La chiave cambia dopo il primo salvataggio (da `c:` a `u:`, perché nasce la copia
 * personale): si riconosce anche la vecchia chiave del catalogo.
 */
export function useRouteExercise(): { exercise: Exercise | undefined; list: ReturnType<typeof useExercises> } {
  const { key = '' } = useParams()
  const list = useExercises()
  const exercise = list.data?.find((item) => item.key === key || (item.catalogId !== null && catalogKey(item.catalogId) === key))
  return { exercise, list }
}
