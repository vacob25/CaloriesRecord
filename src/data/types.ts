import type { Per100g } from '../lib/nutrition'

/** Tipi dell'app derivati dallo schema (supabase/migrations). Nomi in camelCase, valori già numeri. */

export type FoodSource = 'manual' | 'open_food_facts' | 'recipe'

export interface Food {
  id: string
  name: string
  brand: string | null
  barcode: string | null
  source: FoodSource
  per100g: Per100g
  servingG: number | null
  cookedWeightG: number | null
  isFavorite: boolean
  lastUsedAt: string | null
}

export interface RecipeItem {
  id: string
  grams: number
  ingredient: Food
}

export interface Recipe {
  food: Food
  items: RecipeItem[]
}
