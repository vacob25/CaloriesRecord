import type { MealType } from '../lib/labels'
import type { Nutrients, Per100g } from '../lib/nutrition'
import type { FoodUnit, Portion } from '../lib/portions'

/** Tipi dell'app derivati dallo schema (supabase/migrations). Nomi in camelCase, valori già numeri. */

export type FoodSource = 'manual' | 'open_food_facts' | 'recipe'

export interface Food {
  id: string
  name: string
  brand: string | null
  barcode: string | null
  source: FoodSource
  /** g, oppure ml per i liquidi: allora `per100g` vale per 100 ml (ADR-048). */
  unit: FoodUnit
  per100g: Per100g
  /** Porzioni casalinghe, es. "1 uovo medio" = 50 g (ADR-048). */
  portions: Portion[]
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

/** Voce del diario: nome e valori sono uno snapshot (ADR-011). */
export interface MealEntry extends Nutrients {
  id: string
  entryDate: string
  mealType: MealType
  foodId: string | null
  foodName: string
  /** Quantità nell'unità `unit` (la colonna resta `grams` anche per i ml). */
  grams: number
  unit: FoodUnit
  createdAt: string
}

export interface Profile {
  sex: 'male' | 'female'
  birthDate: string
  heightCm: number
  activityFactor: number
  surplusPct: number
  trainingBonusKcal: number
  goalWeightKg: number | null
  proteinGPerKg: number
  fatGPerKg: number
}

export interface DailyTarget {
  date: string
  trainingType: 'rest' | 'gym' | 'football' | 'both'
  targetKcal: number
  protein: number
  carbs: number
  fat: number
  maintenanceKcal: number
}
