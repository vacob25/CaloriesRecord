import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { FoodValues } from '../lib/foodValidation'
import { catalogToFood, parseCatalog, type CatalogItem } from '../lib/catalog'
import type { Portion } from '../lib/portions'
import type { MealType, TrainingType } from '../lib/labels'
import type { ParamsValues, PersonalValues } from '../lib/profileValidation'
import {
  createFood,
  deleteFood,
  getFood,
  getRecipe,
  listFoods,
  saveRecipe,
  setFavorite,
  updateFood,
  saveOffFood,
  saveCatalogFood,
  type RecipeInput,
} from './foods'
import { resolveBarcode } from './barcode'
import { searchProducts } from './openFoodFacts'
import { listEntriesBetween } from './meals'
import { listTargetsBetween } from './targets'
import { acceptProposal, rejectProposal, runWeeklyRecalibration, type TdeeEstimate } from './recalibration'
import { addEntry, deleteEntry, lastGramsByFood, listEntries, updateEntry, type NewEntry } from './meals'
import { createProfile, getProfile, updateParams, updatePersonal } from './profile'
import { getOrCreateTarget, recomputeTarget, setTrainingType } from './targets'
import type { MealEntry } from './types'
import {
  addWater,
  createContainer,
  deleteContainer,
  deleteWater,
  listContainers,
  listWater,
  updateWaterGoal,
} from './water'
import { DataError } from './dbErrors'
import { deleteWeight, listWeights, saveWeight } from './weights'

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
  profile: ['profiles'] as const,
  targets: ['daily_targets'] as const,
  targetForDay: (date: string) => ['daily_targets', date] as const,
  weights: ['weight_logs'] as const,
  recalibration: (today: string) => ['tdee_estimates', today] as const,
  water: ['water_entries'] as const,
  waterForDay: (date: string) => ['water_entries', date] as const,
  containers: ['drink_containers'] as const,
  catalog: ['catalog'] as const,
  /** Statistiche: dipendono da voci, target e pesate (stanno sotto meal_entries per le voci). */
  stats: ['meal_entries', 'stats'] as const,
  /** Tutte le valutazioni di ricalibrazione (prefisso). */
  tdee: ['tdee_estimates'] as const,
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

/** Salva un cibo; per un cibo nuovo restituisce il cibo creato (serve a tornare ad "Aggiungi pasto"). */
export function useSaveFood() {
  const invalidate = useInvalidateFoods()
  return useMutation({
    mutationFn: async ({
      id,
      values,
      source,
      portions = [],
    }: {
      id: string | null
      values: FoodValues
      source?: 'manual' | 'open_food_facts'
      portions?: Portion[]
    }) => {
      if (id) {
        await updateFood(id, values, portions)
        return null
      }
      return createFood(values, source, portions)
    },
    onSuccess: invalidate,
  })
}

export function useSaveOffFood() {
  const invalidate = useInvalidateFoods()
  return useMutation({ mutationFn: (values: FoodValues) => saveOffFood(values), onSuccess: invalidate })
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

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: getProfile })
}

export function useDayTarget(date: string) {
  return useQuery({ queryKey: queryKeys.targetForDay(date), queryFn: () => getOrCreateTarget(date) })
}

function useInvalidate() {
  const client = useQueryClient()
  return (...keys: (readonly string[])[]) => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}

/** Prima apertura (ADR-037): salva il peso di oggi, poi crea il profilo. */
export function useCreateProfile() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ values, today }: { values: PersonalValues; today: string }) => {
      if (values.weightKg !== null) await saveWeight(today, values.weightKg)
      await createProfile(values)
    },
    onSuccess: () => invalidate(queryKeys.profile, queryKeys.targets, queryKeys.weights, queryKeys.tdee),
  })
}

/** Modifica del profilo: vale da oggi (ADR-039); i giorni passati non cambiano. */
export function useUpdateProfile() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ personal, params, today }: { personal?: PersonalValues; params?: ParamsValues; today: string }) => {
      if (personal) await updatePersonal(personal)
      if (params) await updateParams(params)
      await recomputeTarget(today)
    },
    // Anche statistiche (target del giorno) e ricalibrazione (BMR e mantenimento attuali).
    onSuccess: () => invalidate(queryKeys.profile, queryKeys.targets, queryKeys.stats, queryKeys.tdee),
  })
}

export function useSetTrainingType(date: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (type: TrainingType) => setTrainingType(date, type),
    onSuccess: () => invalidate(queryKeys.targets, queryKeys.stats),
  })
}

export function useWeights(from: string | null) {
  return useQuery({ queryKey: [...queryKeys.weights, from ?? 'all'], queryFn: () => listWeights(from) })
}

export function useSaveWeight() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ day, kg }: { day: string; kg: number }) => saveWeight(day, kg),
    onSuccess: () => invalidate(queryKeys.weights, queryKeys.targets, queryKeys.stats, queryKeys.tdee),
  })
}

export function useDeleteWeight() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (day: string) => deleteWeight(day),
    onSuccess: () => invalidate(queryKeys.weights, queryKeys.targets, queryKeys.stats, queryKeys.tdee),
  })
}

export function useResolveBarcode() {
  const invalidate = useInvalidateFoods()
  return useMutation({ mutationFn: (code: string) => resolveBarcode(code), onSuccess: invalidate })
}

/** Ricerca su Open Food Facts: una mutation, non una query, perché parte solo su richiesta esplicita. */
export function useSearchOff() {
  return useMutation({ mutationFn: (query: string) => searchProducts(query) })
}

/** Dati di un periodo per le statistiche: voci, target e pesate (con 6 giorni prima per la media mobile). */
export function useStatsData(start: string, end: string, weightsFrom: string) {
  return useQuery({
    queryKey: [...queryKeys.stats, start, end, weightsFrom],
    queryFn: async () => {
      const [entries, targets, weights] = await Promise.all([
        listEntriesBetween(start, end),
        listTargetsBetween(start, end),
        listWeights(weightsFrom),
      ])
      return { entries, targets, weights }
    },
  })
}

/** Ricalibrazione della settimana (eseguita alla prima apertura: Oggi e Profilo condividono la stessa cache). */
export function useRecalibration(today: string) {
  return useQuery({ queryKey: queryKeys.recalibration(today), queryFn: () => runWeeklyRecalibration(today), staleTime: 10 * 60_000 })
}

export function useDecideProposal(today: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ estimate, accept, currentBmrKcal }: { estimate: TdeeEstimate; accept: boolean; currentBmrKcal: number | null }) => {
      if (!accept) return rejectProposal(estimate.id)
      // Mai trasformare un "Accetta" in un rifiuto: senza BMR non si può calcolare il nuovo fattore.
      if (currentBmrKcal === null) throw new DataError('Serve una pesata recente per calcolare il nuovo fattore di attività.')
      await acceptProposal(estimate, currentBmrKcal)
    },
    // Niente ricalcolo del target di oggi: la proposta vale dal giorno dopo (§7).
    onSuccess: () => invalidate(queryKeys.recalibration(today), queryKeys.profile),
  })
}

// Acqua (step 15)

export function useWater(date: string) {
  return useQuery({ queryKey: queryKeys.waterForDay(date), queryFn: () => listWater(date) })
}

export function useAddWater(date: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ ml, container }: { ml: number; container: string | null }) => addWater(date, ml, container),
    onSuccess: () => invalidate(queryKeys.water),
  })
}

export function useDeleteWater() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteWater, onSuccess: () => invalidate(queryKeys.water) })
}

export function useContainers() {
  return useQuery({ queryKey: queryKeys.containers, queryFn: listContainers })
}

export function useCreateContainer() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ name, ml }: { name: string; ml: number }) => createContainer(name, ml),
    onSuccess: () => invalidate(queryKeys.containers),
  })
}

export function useDeleteContainer() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteContainer, onSuccess: () => invalidate(queryKeys.containers) })
}

export function useUpdateWaterGoal() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: updateWaterGoal, onSuccess: () => invalidate(queryKeys.profile) })
}

// Catalogo di ingredienti (step 16): file statico, caricato solo quando serve.

export function useCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog,
    queryFn: async () => parseCatalog((await import('./catalog/ingredienti.json')).default).items,
    staleTime: Infinity,
    enabled,
  })
}

export function useSaveCatalogFood() {
  const invalidate = useInvalidateFoods()
  return useMutation({
    mutationFn: (item: CatalogItem) => {
      const { values, portions } = catalogToFood(item)
      return saveCatalogFood(values, portions)
    },
    onSuccess: invalidate,
  })
}

/**
 * Stella su una voce del catalogo (step 17): la voce diventa un proprio cibo (se non lo è già)
 * e si inverte il suo "preferito". Così i preferiti valgono ovunque: Cibi, Aggiungi pasto, catalogo.
 */
export function useToggleCatalogFavorite() {
  const invalidate = useInvalidateFoods()
  return useMutation({
    mutationFn: async (item: CatalogItem) => {
      const { values, portions } = catalogToFood(item)
      const food = await saveCatalogFood(values, portions)
      await setFavorite(food.id, !food.isFavorite)
    },
    onSuccess: invalidate,
  })
}
