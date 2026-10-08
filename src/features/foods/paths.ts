import type { Food } from '../../data/types'

/** Dove si modifica un cibo: le ricette hanno il loro editor. */
export function foodPath(food: Pick<Food, 'id' | 'source'>): string {
  return food.source === 'recipe' ? `/cibi/ricette/${food.id}` : `/cibi/${food.id}`
}
