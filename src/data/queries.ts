import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { FoodValues } from '../lib/foodValidation'
import { catalogToFood, parseCatalog, type CatalogItem } from '../lib/catalog'
import type { Portion } from '../lib/portions'
import type { MealType, TrainingType } from '../lib/labels'
import type { ParamsValues, PersonalValues, PlanValues } from '../lib/profileValidation'
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
import {
  addDay,
  addPlanExercise,
  createPlan,
  deleteDay,
  deletePlan,
  duplicateDay,
  duplicatePlan,
  getPlan,
  listPlans,
  removePlanExercise,
  renamePlan,
  reorderDays,
  reorderPlanExercises,
  setPlanArchived,
  updateDay,
  updatePlanExercise,
  type NewPlanExercise,
  type PlanDetail,
  type PlanExercisePatch,
} from './workoutPlans'
import { getActiveSession, listRecentSessions } from './workoutSessions'
import { createCustomExercise, deleteUserExercise, listCatalog, listUserExercises, saveExercise, type ExercisePatch } from './exercises'
import { listReminderSettings, readReminderHistory, saveReminderSetting } from './reminders'
import { createMealSlot, deleteMealSlot, listMealSlots, renameMealSlot, reorderMealSlots } from './mealSlots'
import type { MealSlot } from '../lib/mealSlots'
import { listEntriesBetween } from './meals'
import { listTargetsBetween } from './targets'
import { acceptProposal, rejectProposal, runWeeklyRecalibration, type TdeeEstimate } from './recalibration'
import { addEntry, deleteEntry, lastGramsByFood, listEntries, updateEntry, type NewEntry } from './meals'
import { chooseSports, createProfile, getProfile, setTutorialDone, updatePlan, updateProfileFields } from './profile'
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
import { QUERY_STALE_LONG_MS } from '../lib/constants'
import type { ReminderSetting } from '../lib/reminders'
import { buildExerciseList, type Exercise } from '../lib/exercises'
import type { PlanExercise } from '../lib/workoutPlans'
import { deleteWeight, listWeights, recentWeightsUntil, saveWeight } from './weights'

/**
 * Hook dei dati condivisi tra le feature (componente → hook → data/*.ts → Supabase).
 * Le chiavi della cache seguono [tabella, …]: dopo una scrittura si invalida la tabella toccata.
 */
export const queryKeys = {
  foods: ['foods'] as const,
  food: (id: string) => ['foods', id] as const,
  recipe: (id: string) => ['foods', 'recipe', id] as const,
  mealSlots: ['meal_slots'] as const,
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
  exerciseCatalog: ['exercise_catalog'] as const,
  userExercises: ['user_exercises'] as const,
  plans: ['workout_plans'] as const,
  plan: (id: string) => ['workout_plans', 'detail', id] as const,
  reminders: ['reminder_settings'] as const,
  reminderHistory: (today: string) => ['reminder_settings', 'history', today] as const,
  /** Statistiche: dipendono da voci, target e pesate (stanno sotto meal_entries per le voci). */
  stats: ['meal_entries', 'stats'] as const,
  /** Tutte le valutazioni di ricalibrazione (prefisso). */
  tdee: ['tdee_estimates'] as const,
}

/** Libreria esercizi (Fase 3): catalogo globale + copie personali, già uniti. Il catalogo cambia solo con una migrazione: resta fresco a lungo. */
export function useExercises(): { data: Exercise[] | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => void } {
  const catalog = useQuery({ queryKey: queryKeys.exerciseCatalog, queryFn: listCatalog, staleTime: QUERY_STALE_LONG_MS })
  const personal = useQuery({ queryKey: queryKeys.userExercises, queryFn: listUserExercises, staleTime: QUERY_STALE_LONG_MS })
  const data = useMemo(
    () => (catalog.data && personal.data ? buildExerciseList(catalog.data, personal.data) : undefined),
    [catalog.data, personal.data],
  )
  return {
    data,
    isPending: catalog.isPending || personal.isPending,
    isError: catalog.isError || personal.isError,
    error: catalog.error ?? personal.error,
    refetch: () => {
      void catalog.refetch()
      void personal.refetch()
    },
  }
}

export function useExerciseActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.userExercises })
  return {
    save: useMutation({
      mutationFn: ({ target, patch }: { target: { userExerciseId: string | null; catalogId: string | null }; patch: ExercisePatch }) => saveExercise(target, patch),
      onSettled: refresh,
    }),
    create: useMutation({ mutationFn: createCustomExercise, onSettled: refresh }),
    remove: useMutation({ mutationFn: (id: string) => deleteUserExercise(id), onSettled: refresh }),
  }
}

function applyPatch(item: PlanExercise, patch: PlanExercisePatch): PlanExercise {
  return {
    ...item,
    ...(patch.sets !== undefined && { sets: patch.sets }),
    ...(patch.repsMin !== undefined && { repsMin: patch.repsMin }),
    ...(patch.repsMax !== undefined && { repsMax: patch.repsMax }),
    ...(patch.weightsKg !== undefined && { weightsKg: patch.weightsKg }),
    ...(patch.restSeconds !== undefined && { restSeconds: patch.restSeconds }),
    ...(patch.note !== undefined && { note: patch.note.trim() === '' ? '' : patch.note }),
  }
}

/** Schede di allenamento (Fase 4): elenco, dettaglio di una scheda e tutte le modifiche. Ogni scrittura riscarica le schede. */
export function useWorkoutPlans() {
  return useQuery({ queryKey: queryKeys.plans, queryFn: listPlans, staleTime: QUERY_STALE_LONG_MS })
}

export function useWorkoutPlan(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.plan(id ?? ''), queryFn: () => getPlan(id ?? ''), enabled: Boolean(id), staleTime: QUERY_STALE_LONG_MS })
}

export function useWorkoutActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.plans })
  return {
    createPlan: useMutation({ mutationFn: ({ name, days }: { name: string; days: { name: string; weekday: number | null }[] }) => createPlan(name, days), onSettled: refresh }),
    renamePlan: useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => renamePlan(id, name), onSettled: refresh }),
    archivePlan: useMutation({ mutationFn: ({ id, archived }: { id: string; archived: boolean }) => setPlanArchived(id, archived), onSettled: refresh }),
    deletePlan: useMutation({ mutationFn: (id: string) => deletePlan(id), onSettled: refresh }),
    duplicatePlan: useMutation({ mutationFn: (id: string) => duplicatePlan(id), onSettled: refresh }),
    addDay: useMutation({ mutationFn: ({ planId, name, position }: { planId: string; name: string; position: number }) => addDay(planId, name, position), onSettled: refresh }),
    updateDay: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: { name?: string; weekday?: number | null } }) => updateDay(id, patch), onSettled: refresh }),
    reorderDays: useMutation({ mutationFn: (ids: readonly string[]) => reorderDays(ids), onSettled: refresh }),
    deleteDay: useMutation({ mutationFn: (id: string) => deleteDay(id), onSettled: refresh }),
    duplicateDay: useMutation({ mutationFn: (id: string) => duplicateDay(id), onSettled: refresh }),
    addExercise: useMutation({ mutationFn: (values: NewPlanExercise) => addPlanExercise(values), onSettled: refresh }),
    // Ottimistico: due tocchi veloci su "+" o due pesi scritti di fila partono ciascuno dal valore già cambiato dal tocco prima,
    // senza aspettare che le schede si riscarichino (altrimenti il secondo cancellerebbe il primo).
    updateExercise: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: PlanExercisePatch }) => updatePlanExercise(id, patch),
      onMutate: async ({ id, patch }) => {
        await client.cancelQueries({ queryKey: queryKeys.plans })
        const previous = client.getQueriesData<PlanDetail | null>({ queryKey: ['workout_plans', 'detail'] })
        client.setQueriesData<PlanDetail | null>({ queryKey: ['workout_plans', 'detail'] }, (detail) =>
          detail ? { ...detail, items: detail.items.map((item) => (item.id === id ? applyPatch(item, patch) : item)) } : detail,
        )
        return { previous }
      },
      onError: (_error, _variables, context) => {
        for (const [key, data] of context?.previous ?? []) client.setQueryData(key, data)
      },
      onSettled: refresh,
    }),
    reorderExercises: useMutation({ mutationFn: (ids: readonly string[]) => reorderPlanExercises(ids), onSettled: refresh }),
    removeExercise: useMutation({ mutationFn: (id: string) => removePlanExercise(id), onSettled: refresh }),
  }
}

/** Sessione di allenamento in corso (per "Riprendi allenamento") e sessioni recenti. Sempre fresche: si guardano aprendo la Palestra. */
export function useActiveSession() {
  return useQuery({ queryKey: ['workout_sessions', 'active'], queryFn: getActiveSession, staleTime: 0 })
}

export function useRecentSessions() {
  return useQuery({ queryKey: ['workout_sessions', 'recent'], queryFn: () => listRecentSessions(20), staleTime: 0 })
}

export function useReminderSettings() {
  return useQuery({ queryKey: queryKeys.reminders, queryFn: listReminderSettings, staleTime: QUERY_STALE_LONG_MS })
}

/** Promemoria partiti e pasti registrati negli ultimi giorni, per la proposta di sospendere. Sempre fresco: si guarda aprendo il Profilo. */
export function useReminderHistory(today: string) {
  return useQuery({ queryKey: queryKeys.reminderHistory(today), queryFn: () => readReminderHistory(today), staleTime: 0 })
}

/** Salva un'impostazione. Il Profilo la mostra subito (ottimistico) e torna indietro se il salvataggio fallisce. */
export function useSaveReminderSetting() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (setting: ReminderSetting) => saveReminderSetting(setting),
    onMutate: async (setting) => {
      await client.cancelQueries({ queryKey: queryKeys.reminders })
      const previous = client.getQueryData<ReminderSetting[]>(queryKeys.reminders)
      client.setQueryData<ReminderSetting[]>(queryKeys.reminders, (old = []) => [...old.filter((item) => item.slot !== setting.slot), setting])
      return { previous }
    },
    onError: (_error, _setting, context) => {
      if (context?.previous) client.setQueryData(queryKeys.reminders, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.reminders }),
  })
}

export function useMealSlots() {
  return useQuery({ queryKey: queryKeys.mealSlots, queryFn: listMealSlots, staleTime: QUERY_STALE_LONG_MS })
}

/** Crea, rinomina, ordina ed elimina i pasti. Ogni scrittura riscarica l'elenco; il diario si ricarica quando cambiano i nomi. */
export function useMealSlotActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.mealSlots })
  return {
    create: useMutation({
      mutationFn: ({ slot, position }: { slot: MealSlot; position: number }) => createMealSlot(slot, position),
      onSuccess: refresh,
    }),
    rename: useMutation({
      mutationFn: ({ key, name }: { key: string; name: string }) => renameMealSlot(key, name),
      onSuccess: refresh,
    }),
    reorder: useMutation({ mutationFn: (keys: readonly string[]) => reorderMealSlots(keys), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (key: string) => deleteMealSlot(key), onSuccess: refresh }),
  }
}

export function useFoods() {
  return useQuery({ queryKey: queryKeys.foods, queryFn: listFoods, staleTime: QUERY_STALE_LONG_MS })
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
    // onSettled e non onSuccess: se la risposta si perde (errore) la voce potrebbe comunque essere salvata, quindi si rilegge.
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.entries })
      void client.invalidateQueries({ queryKey: queryKeys.foods })
    },
  })
}

/**
 * Modifica di una voce (grammi e/o pasto). Lo spostamento da un pasto all'altro è ottimistico (revisione #36): la voce
 * compare subito nel nuovo pasto e torna al vecchio se il salvataggio fallisce. Grammi e calorie cambiano dopo la risposta.
 */
export function useUpdateEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ entry, grams, mealType }: { entry: MealEntry; grams: number; mealType: MealType }) =>
      updateEntry(entry, grams, mealType),
    onMutate: async ({ entry, mealType }) => {
      const key = queryKeys.entriesForDay(entry.entryDate)
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<MealEntry[]>(key)
      client.setQueryData<MealEntry[]>(key, (list) => list?.map((item) => (item.id === entry.id ? { ...item, mealType } : item)))
      return { key, previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(context.key, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.entries }),
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

// Dati che cambiano solo con le scritture di questa app: restano freschi a lungo (revisione #16).
const profileQuery = { queryKey: queryKeys.profile, queryFn: getProfile, staleTime: QUERY_STALE_LONG_MS }
const weightsUntilQuery = (day: string) => ({
  queryKey: [...queryKeys.weights, 'until', day] as const,
  queryFn: () => recentWeightsUntil(day),
  staleTime: QUERY_STALE_LONG_MS,
})

export function useProfile() {
  return useQuery(profileQuery)
}

/** Le ultime pesate fino a un giorno: una sola richiesta per Oggi, condivisa da promemoria, pill del peso e target. */
export function useWeightsUntil(day: string) {
  return useQuery(weightsUntilQuery(day))
}

/** Profilo e ultime pesate dalla cache (le riscarica solo se vecchi o invalidati): evita richieste doppie (revisione #17). */
function useKnownData() {
  const client = useQueryClient()
  return async (day: string) => {
    const [profile, weights] = await Promise.all([client.fetchQuery(profileQuery), client.fetchQuery(weightsUntilQuery(day))])
    return { profile, weights }
  }
}

export function useDayTarget(date: string) {
  const known = useKnownData()
  return useQuery({
    queryKey: queryKeys.targetForDay(date),
    queryFn: async () => getOrCreateTarget(date, await known(date)),
    staleTime: QUERY_STALE_LONG_MS,
  })
}

function useInvalidate() {
  const client = useQueryClient()
  return (...keys: (readonly string[])[]) => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}

/** Prima apertura (ADR-037): salva il peso di oggi, poi crea il profilo. */
export function useCreateProfile() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ values, plan, activityFactor, today }: { values: PersonalValues; plan: PlanValues; activityFactor: number; today: string }) => {
      if (values.weightKg !== null) await saveWeight(today, values.weightKg)
      await createProfile(values, plan, activityFactor)
    },
    // onSettled: se il secondo passo fallisce il primo è comunque salvato, quindi si rilegge sempre (revisione #15).
    onSettled: () => invalidate(queryKeys.profile, queryKeys.targets, queryKeys.weights, queryKeys.tdee),
  })
}

/** Modifica del profilo: vale da oggi (ADR-039); i giorni passati non cambiano. */
export function useUpdatePlan() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ plan, today }: { plan: PlanValues; today: string }) => {
      await updatePlan(plan)
      await recomputeTarget(today)
    },
    // Il target di oggi si ricalcola con il nuovo obiettivo; statistiche e ricalibrazione seguono (bande diverse).
    onSettled: () => invalidate(queryKeys.profile, queryKeys.targets, queryKeys.stats, queryKeys.tdee),
  })
}

/** Sport scelti dopo l'azzeramento (correzione #18): come il Profilo, il target di oggi si ricalcola. */
export function useChooseSports() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ sports, today }: { sports: string[]; today: string }) => {
      await chooseSports(sports)
      await recomputeTarget(today)
    },
    onSettled: () => invalidate(queryKeys.profile, queryKeys.targets, queryKeys.stats),
  })
}

/** Tutorial finito (`true`) o da rivedere (`false`). */
export function useSetTutorialDone() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: setTutorialDone, onSuccess: () => invalidate(queryKeys.profile) })
}

export function useUpdateProfile() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ personal, params, today }: { personal?: PersonalValues; params?: ParamsValues; today: string }) => {
      await updateProfileFields({ personal, params })
      await recomputeTarget(today)
    },
    // Anche statistiche (target del giorno) e ricalibrazione (BMR e mantenimento attuali).
    onSettled: () => invalidate(queryKeys.profile, queryKeys.targets, queryKeys.stats, queryKeys.tdee),
  })
}

export function useSetTrainingType(date: string) {
  const invalidate = useInvalidate()
  const known = useKnownData()
  return useMutation({
    mutationFn: async (type: TrainingType) => setTrainingType(date, type, await known(date)),
    onSettled: () => invalidate(queryKeys.targets, queryKeys.stats),
  })
}

export function useWeights(from: string | null) {
  return useQuery({ queryKey: [...queryKeys.weights, from ?? 'all'], queryFn: () => listWeights(from) })
}

/**
 * La ricalibrazione si valuta una volta a settimana (§7): una nuova pesata la segna "da rileggere" alla prossima
 * apertura, ma non riesegue subito le 7 richieste della valutazione (revisione #35).
 */
function useRefreshAfterWeightChange() {
  const client = useQueryClient()
  const invalidate = useInvalidate()
  return async () => {
    void client.invalidateQueries({ queryKey: queryKeys.tdee, refetchType: 'none' })
    await invalidate(queryKeys.weights, queryKeys.targets, queryKeys.stats)
  }
}

export function useSaveWeight() {
  const refresh = useRefreshAfterWeightChange()
  return useMutation({
    mutationFn: ({ day, kg }: { day: string; kg: number }) => saveWeight(day, kg),
    onSettled: refresh,
  })
}

export function useDeleteWeight() {
  const refresh = useRefreshAfterWeightChange()
  return useMutation({
    mutationFn: (day: string) => deleteWeight(day),
    onSettled: refresh,
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
  const client = useQueryClient()
  return useQuery({
    queryKey: queryKeys.recalibration(today),
    queryFn: async () => runWeeklyRecalibration(today, { profile: await client.fetchQuery(profileQuery) }),
    staleTime: 10 * 60_000,
  })
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
    mutationFn: ({ id, ml, container }: { id: string; ml: number; container: string | null }) =>
      addWater(id, date, ml, container),
    onSettled: () => invalidate(queryKeys.water),
  })
}

export function useDeleteWater() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteWater, onSuccess: () => invalidate(queryKeys.water) })
}

export function useContainers() {
  return useQuery({ queryKey: queryKeys.containers, queryFn: listContainers, staleTime: QUERY_STALE_LONG_MS })
}

export function useCreateContainer() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, name, ml }: { id: string; name: string; ml: number }) => createContainer(id, name, ml),
    onSettled: () => invalidate(queryKeys.containers),
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
    // Ingredienti (CREA) e piatti comuni calcolati da quegli ingredienti (step 20): due file, un solo elenco.
    queryFn: async () => {
      const [ingredients, dishes] = await Promise.all([import('./catalog/ingredienti.json'), import('./catalog/piatti.json')])
      return parseCatalog(ingredients.default, dishes.default).items
    },
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
