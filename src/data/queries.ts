import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { FoodValues } from '../lib/foodValidation'
import type { MealType } from '../lib/labels'
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
import { addEntry, deleteEntry, lastGramsByFood, listEntries, updateEntry, type NewEntry } from './meals'
import type { MealEntry } from './types'

/**
 * Hook dei dati condivisi tra le feature (componente → hook → data/*.ts → Supabase).
 * Le chiavi della cache seguono [tabella, …]: dopo una scrittura si invalida la tabella toccata.
 */
export const queryKeys = {
  foods: ['foods'] as const,
  food: (id: string) => ['foods', id] as const,
  recipe: (id: string) => ['foods', 'recipe', id] as const,
  entries: ['meal_entries'] as const,
  entriesForDay: (date: string) => ['meal_entries', date] as const,
  lastGrams: ['meal_entries', 'last-grams'] as const,
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

export function useEntries(date: string) {
  return useQuery({ queryKey: queryKeys.entriesForDay(date), queryFn: () => listEntries(date) })
}

export function useLastGrams() {
  return useQuery({ queryKey: queryKeys.lastGrams, queryFn: lastGramsByFood })
}

export function useAddEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewEntry) => addEntry(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.entries })
      void client.invalidateQueries({ queryKey: queryKeys.foods })
    },
  })
}

export function useUpdateEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ entry, grams, mealType }: { entry: MealEntry; grams: number; mealType: MealType }) =>
      updateEntry(entry, grams, mealType),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.entries }),
  })
}

/** Cancellazione ottimistica (ARCHITECTURE.md): la voce sparisce subito, torna se il server dice di no. */
export function useDeleteEntry(date: string) {
  const client = useQueryClient()
  const key = queryKeys.entriesForDay(date)
  return useMutation({
    mutationFn: (id: string) => deleteEntry(id),
    onMutate: async (id: string) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<MealEntry[]>(key)
      client.setQueryData<MealEntry[]>(key, (list) => list?.filter((entry) => entry.id !== id))
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.entries }),
  })
}
