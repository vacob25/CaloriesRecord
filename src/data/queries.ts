import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { FoodValues } from '../lib/foodValidation'
import {
  createFood,
  deleteFood,
  getFood,
  getRecipe,
  listFoods,
  saveRecipe,
  setFavorite,
  updateFood,
  type RecipeInput,
} from './foods'

/**
 * Hook dei dati condivisi tra le feature (componente → hook → data/*.ts → Supabase).
 * Le chiavi della cache seguono [tabella, …]: dopo una scrittura si invalida la tabella toccata.
 */
export const queryKeys = {
  foods: ['foods'] as const,
  food: (id: string) => ['foods', id] as const,
  recipe: (id: string) => ['foods', 'recipe', id] as const,
}

export function useFoods() {
  return useQuery({ queryKey: queryKeys.foods, queryFn: listFoods })
}

export function useFood(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.food(id ?? ''), queryFn: () => getFood(id ?? ''), enabled: Boolean(id) })
}

export function useRecipe(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.recipe(id ?? ''), queryFn: () => getRecipe(id ?? ''), enabled: Boolean(id) })
}

function useInvalidateFoods() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: queryKeys.foods })
}

export function useSaveFood() {
  const invalidate = useInvalidateFoods()
  return useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: FoodValues }) =>
      id ? updateFood(id, values) : createFood(values).then(() => undefined),
    onSuccess: invalidate,
  })
}

export function useDeleteFood() {
  const invalidate = useInvalidateFoods()
  return useMutation({ mutationFn: deleteFood, onSuccess: invalidate })
}

export function useSaveRecipe() {
  const invalidate = useInvalidateFoods()
  return useMutation({ mutationFn: (input: RecipeInput) => saveRecipe(input), onSuccess: invalidate })
}

export function useToggleFavorite() {
  const invalidate = useInvalidateFoods()
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => setFavorite(id, isFavorite),
    onSuccess: invalidate,
  })
}
