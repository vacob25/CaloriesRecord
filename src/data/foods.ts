import type { FoodValues } from '../lib/foodValidation'
import { recipePer100g, type Per100g } from '../lib/nutrition'
import { DataError, throwIfError } from './dbErrors'
import { getSupabase } from './supabase'
import type { Food, FoodSource, Recipe } from './types'

interface FoodRow {
  id: string
  name: string
  brand: string | null
  barcode: string | null
  source: FoodSource
  kcal_100g: number | string
  protein_100g: number | string
  carbs_100g: number | string
  fat_100g: number | string
  serving_g: number | string | null
  cooked_weight_g: number | string | null
  is_favorite: boolean
  last_used_at: string | null
}

const FOOD_COLUMNS =
  'id, name, brand, barcode, source, kcal_100g, protein_100g, carbs_100g, fat_100g, serving_g, cooked_weight_g, is_favorite, last_used_at'

const toNumber = (value: number | string) => Number(value)
const toNumberOrNull = (value: number | string | null) => (value === null ? null : Number(value))

export function toFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    source: row.source,
    per100g: {
      kcal: toNumber(row.kcal_100g),
      protein: toNumber(row.protein_100g),
      carbs: toNumber(row.carbs_100g),
      fat: toNumber(row.fat_100g),
    },
    servingG: toNumberOrNull(row.serving_g),
    cookedWeightG: toNumberOrNull(row.cooked_weight_g),
    isFavorite: row.is_favorite,
    lastUsedAt: row.last_used_at,
  }
}

function valuesToRow(per100g: Per100g) {
  return {
    kcal_100g: per100g.kcal,
    protein_100g: per100g.protein,
    carbs_100g: per100g.carbs,
    fat_100g: per100g.fat,
  }
}

/** Tutti i propri cibi e ricette, in ordine alfabetico (poche centinaia di righe: si filtra sul telefono). */
export async function listFoods(): Promise<Food[]> {
  const { data, error } = await getSupabase().from('foods').select(FOOD_COLUMNS).order('name')
  throwIfError(error)
  return (data as FoodRow[]).map(toFood)
}

/** Il proprio cibo con quel codice a barre, se c'è (unico per utente). */
export async function findFoodByBarcode(barcode: string): Promise<Food | null> {
  const { data, error } = await getSupabase().from('foods').select(FOOD_COLUMNS).eq('barcode', barcode).maybeSingle()
  throwIfError(error)
  return data ? toFood(data as FoodRow) : null
}

/**
 * Prodotto di Open Food Facts scelto per la prima volta: si salva tra i propri cibi (step 8).
 * Se esiste già un proprio cibo con lo stesso codice si usa quello: niente doppioni.
 */
export async function saveOffFood(values: FoodValues): Promise<Food> {
  if (values.barcode) {
    const existing = await findFoodByBarcode(values.barcode)
    if (existing) return existing
  }
  return createFood(values, 'open_food_facts')
}

export async function getFood(id: string): Promise<Food> {
  const { data, error } = await getSupabase().from('foods').select(FOOD_COLUMNS).eq('id', id).single()
  throwIfError(error)
  return toFood(data as FoodRow)
}

export async function createFood(values: FoodValues, source: Exclude<FoodSource, 'recipe'> = 'manual'): Promise<Food> {
  const { data, error } = await getSupabase()
    .from('foods')
    .insert({
      name: values.name,
      brand: values.brand,
      barcode: values.barcode,
      source,
      serving_g: values.servingG,
      ...valuesToRow(values.per100g),
    })
    .select(FOOD_COLUMNS)
    .single()
  throwIfError(error)
  return toFood(data as FoodRow)
}

/**
 * Modifica un cibo. Le voci pasto già registrate non cambiano (sono snapshot, ADR-011).
 * Le ricette che lo usano come ingrediente vengono ricalcolate.
 */
export async function updateFood(id: string, values: FoodValues): Promise<void> {
  const { error } = await getSupabase()
    .from('foods')
    .update({
      name: values.name,
      brand: values.brand,
      barcode: values.barcode,
      serving_g: values.servingG,
      ...valuesToRow(values.per100g),
    })
    .eq('id', id)
  throwIfError(error)
  await recomputeRecipesUsing(id)
}

export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await getSupabase().from('foods').update({ is_favorite: isFavorite }).eq('id', id)
  throwIfError(error)
}

/** Nomi delle ricette che usano questo cibo come ingrediente. */
export async function recipesUsing(foodId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await getSupabase()
    .from('recipe_items')
    .select('recipe:foods!recipe_items_recipe_fkey(id, name)')
    .eq('ingredient_food_id', foodId)
  throwIfError(error)
  const rows = (data ?? []) as unknown as { recipe: { id: string; name: string } | null }[]
  const unique = new Map<string, string>()
  for (const row of rows) if (row.recipe) unique.set(row.recipe.id, row.recipe.name)
  return [...unique].map(([recipeId, name]) => ({ id: recipeId, name }))
}

/**
 * Cancella un cibo o una ricetta. Lo storico non cambia: le voci pasto restano con il loro nome.
 * Un cibo usato come ingrediente non si cancella: il messaggio dice in quali ricette è.
 */
export async function deleteFood(id: string): Promise<void> {
  const usedIn = await recipesUsing(id)
  if (usedIn.length > 0) {
    const names = usedIn.map((recipe) => `"${recipe.name}"`).join(', ')
    throw new DataError(`Non si può eliminare: è un ingrediente di ${names}. Toglilo prima dalla ricetta.`)
  }
  const { error } = await getSupabase().from('foods').delete().eq('id', id)
  throwIfError(error)
}

interface RecipeItemRow {
  id: string
  grams: number | string
  ingredient: FoodRow
}

export async function getRecipe(id: string): Promise<Recipe> {
  const food = await getFood(id)
  const { data, error } = await getSupabase()
    .from('recipe_items')
    .select(`id, grams, ingredient:foods!recipe_items_ingredient_fkey(${FOOD_COLUMNS})`)
    .eq('recipe_food_id', id)
    .order('created_at')
  throwIfError(error)
  const items = (data as unknown as RecipeItemRow[]).map((row) => ({
    id: row.id,
    grams: Number(row.grams),
    ingredient: toFood(row.ingredient),
  }))
  return { food, items }
}

export interface RecipeInput {
  id: string | null
  name: string
  cookedWeightG: number
  items: { ingredient: Food; grams: number }[]
}

/** Salva una ricetta in un'unica transazione (funzione save_recipe, migrazione 002). */
export async function saveRecipe(input: RecipeInput): Promise<string> {
  const per100g = recipePer100g(
    input.items.map((item) => ({ per100g: item.ingredient.per100g, grams: item.grams })),
    input.cookedWeightG,
  )
  const { data, error } = await getSupabase().rpc('save_recipe', {
    p_recipe_id: input.id,
    p_name: input.name,
    p_cooked_weight_g: input.cookedWeightG,
    p_kcal_100g: per100g.kcal,
    p_protein_100g: per100g.protein,
    p_carbs_100g: per100g.carbs,
    p_fat_100g: per100g.fat,
    p_items: input.items.map((item) => ({ ingredient_food_id: item.ingredient.id, grams: item.grams })),
  })
  throwIfError(error)
  return data as string
}

/** Ricalcola e salva i valori delle ricette che usano `foodId` (dopo che il cibo è cambiato). */
async function recomputeRecipesUsing(foodId: string): Promise<void> {
  const recipes = await recipesUsing(foodId)
  for (const { id } of recipes) {
    const recipe = await getRecipe(id)
    if (recipe.food.cookedWeightG === null || recipe.items.length === 0) continue
    const per100g = recipePer100g(
      recipe.items.map((item) => ({ per100g: item.ingredient.per100g, grams: item.grams })),
      recipe.food.cookedWeightG,
    )
    const { error } = await getSupabase().from('foods').update(valuesToRow(per100g)).eq('id', id)
    throwIfError(error)
  }
}
