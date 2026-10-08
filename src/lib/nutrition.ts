import { KCAL_PER_G_CARBS, KCAL_PER_G_FAT, KCAL_PER_G_PROTEIN } from './constants'
import { round } from './numbers'

/** Valori nutrizionali per 100 g (come in `foods`). */
export interface Per100g {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Quantità assolute di una porzione (come nello snapshot di `meal_entries`). */
export type Nutrients = Per100g

/** kcal di `grams` grammi di un cibo (le kcal dell'etichetta sono la fonte di verità, §3). */
export function kcalOf(food: Pick<Per100g, 'kcal'>, grams: number): number {
  return (food.kcal * grams) / 100
}

/** kcal, proteine, carboidrati e grassi di `grams` grammi di un cibo. */
export function nutrientsFor(food: Per100g, grams: number): Nutrients {
  const factor = grams / 100
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  }
}

/** Somma più quantità (es. le voci di un pasto o di un giorno). */
export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  return list.reduce(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

/** kcal ricavate dai macro con i fattori 4/4/9. */
export function kcalFromMacros(values: Omit<Per100g, 'kcal'>): number {
  return values.protein * KCAL_PER_G_PROTEIN + values.carbs * KCAL_PER_G_CARBS + values.fat * KCAL_PER_G_FAT
}

/** Converte valori riferiti a una porzione di `servingG` grammi in valori per 100 g. */
export function per100gFromServing(perServing: Per100g, servingG: number): Per100g {
  const factor = 100 / servingG
  return {
    kcal: perServing.kcal * factor,
    protein: perServing.protein * factor,
    carbs: perServing.carbs * factor,
    fat: perServing.fat * factor,
  }
}

export interface RecipeIngredient {
  per100g: Per100g
  grams: number
}

/**
 * Valori per 100 g di una ricetta (DATA_MODEL.md, recipe_items):
 * somma degli ingredienti (crudi) diviso il peso totale cotto, per 100.
 * Arrotondati a 2 decimali come la colonna numeric(8,2).
 */
export function recipePer100g(ingredients: readonly RecipeIngredient[], cookedWeightG: number): Per100g {
  const total = sumNutrients(ingredients.map((item) => nutrientsFor(item.per100g, item.grams)))
  const factor = 100 / cookedWeightG
  return {
    kcal: round(total.kcal * factor, 2),
    protein: round(total.protein * factor, 2),
    carbs: round(total.carbs * factor, 2),
    fat: round(total.fat * factor, 2),
  }
}

/** Peso crudo totale degli ingredienti: proposta iniziale per il peso cotto. */
export function totalGrams(ingredients: readonly { grams: number }[]): number {
  return ingredients.reduce((sum, item) => sum + item.grams, 0)
}
