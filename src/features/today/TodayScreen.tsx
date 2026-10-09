import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { GramsSheet } from '../../components/GramsSheet'
import { MealPicker } from '../../components/MealPicker'
import { ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { Toast } from '../../components/Toast'
import { WeightPill } from '../../components/WeightPill'
import { cardClass, dangerButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { errorMessage } from '../../data/dbErrors'
import { useDeleteEntry, useEntries, useFoods, useRecalibration, useUpdateEntry } from '../../data/queries'
import type { MealEntry } from '../../data/types'
import { UNDO_SECONDS } from '../../lib/constants'
import { formatLongDate } from '../../lib/dates'
import { isMealType, MEAL_LABEL, MEAL_TYPES, type MealType } from '../../lib/labels'
import { groupByMeal, rescaleEntry } from '../../lib/meals'
import { formatNumber } from '../../lib/numbers'
import { formatQuantity } from '../../lib/portions'
import { sumNutrients } from '../../lib/nutrition'
import { TargetCard } from './TargetCard'
import { WaterCard } from './WaterCard'
import { WeightReminder } from './WeightReminder'

interface AddedState {
  added?: { id: string; mealType: MealType }
}

export function TodayScreen() {
  const today = useToday()
  const entries = useEntries(today)
  const location = useLocation()
  const navigate = useNavigate()
  const deleteEntry = useDeleteEntry(today)
  // Esecuzione settimanale "pigra" della ricalibrazione alla prima apertura (step 10).
  const recalibration = useRecalibration(today)
  const pendingProposal = recalibration.data?.estimate?.status === 'pending'
  const [editing, setEditing] = useState<MealEntry | null>(null)

  const added = (location.state as AddedState | null)?.added
  const dismissToast = useCallback(
    () => navigate(location.pathname, { replace: true, state: null }),
    [navigate, location.pathname],
  )

  const list = entries.data ?? []
  const groups = groupByMeal(list)
  const total = sumNutrients(list)

  return (
    <>
      <header className="flex items-end justify-between gap-3 px-5 pt-6">
        <div>
          <p className="text-[13px] font-semibold text-muted first-letter:uppercase">{formatLongDate(today)}</p>
          <h1 className="text-[28px] font-extrabold leading-tight">Oggi</h1>
        </div>
        <div data-tour="weight">
          <WeightPill date={today} />
        </div>
      </header>

      <WeightReminder today={today} />

      {pendingProposal && (
        <Link
          to="/profilo#ricalibrazione"
          className="mx-5 mt-4 flex min-h-12 items-center justify-between rounded-card bg-green-tint px-4 text-[15px] font-semibold text-green-dark"
        >
          Nuova proposta di ricalibrazione <span aria-hidden="true">›</span>
        </Link>
      )}

      <TargetCard date={today} eaten={total} />

      {entries.isPending && <ListSkeleton rows={4} />}
      {entries.isError && <ErrorState message={errorMessage(entries.error)} onRetry={() => void entries.refetch()} />}
      {deleteEntry.isError && <ErrorState message={errorMessage(deleteEntry.error)} />}

      {entries.isSuccess && (
        <div data-tour="meals" className="space-y-3 px-5 pt-4">
          {MEAL_TYPES.map((meal) => {
            const { entries: mealEntries, total: mealTotal } = groups[meal]
            const addLink = `/aggiungi?pasto=${meal}`
            if (mealEntries.length === 0) {
              return (
                <Link
                  key={meal}
                  to={addLink}
                  className="flex min-h-16 items-center justify-between rounded-card border-2 border-dashed border-line px-5 text-[15px]"
                >
                  <span className="font-bold">{MEAL_LABEL[meal]}</span>
                  <span className="font-semibold text-green-dark">+ Aggiungi</span>
                </Link>
              )
            }
            return (
              <section key={meal} aria-label={MEAL_LABEL[meal]} className={`${cardClass} px-5 py-4`}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[18px] font-extrabold">{MEAL_LABEL[meal]}</h2>
                  <p className="text-[15px] font-bold tabular-nums">{formatNumber(mealTotal.kcal)} kcal</p>
                </div>
                <ul className="mt-2 divide-y divide-line">
                  {mealEntries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => {
                          deleteEntry.reset()
                          setEditing(entry)
                        }}
                        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[15px]">{entry.foodName}</span>
                          <span className="block text-[13px] text-muted">{formatQuantity(entry.grams, entry.unit)}</span>
                        </span>
                        <span className="shrink-0 text-[15px] tabular-nums text-ink-2">{formatNumber(entry.kcal)} kcal</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Link to={addLink} className="mt-1 flex min-h-11 items-center text-[15px] font-semibold text-green-dark">
                  + Aggiungi
                </Link>
              </section>
            )
          })}
        </div>
      )}

      <WaterCard date={today} />

      {editing && (
        <EditEntrySheet
          // Chiavi con prefisso: pannello e avviso sono fratelli e possono riguardare la stessa voce
          // (si tocca subito la voce appena aggiunta). Con la stessa chiave React si blocca.
          key={`modifica-${editing.id}`}
          entry={editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            deleteEntry.mutate(editing.id)
            setEditing(null)
          }}
        />
      )}

      {added && isMealType(added.mealType) && (
        <Toast
          key={`aggiunto-${added.id}`}
          message={`Aggiunto a ${MEAL_LABEL[added.mealType].toLowerCase()}`}
          actionLabel="Annulla"
          onAction={() => {
            deleteEntry.mutate(added.id)
            dismissToast()
          }}
          onDismiss={dismissToast}
          seconds={UNDO_SECONDS}
        />
      )}
    </>
  )
}

/** Tocco su una voce: cambia grammi o pasto, oppure elimina. */
function EditEntrySheet({ entry, onClose, onDelete }: { entry: MealEntry; onClose: () => void; onDelete: () => void }) {
  const update = useUpdateEntry()
  const foods = useFoods()
  // Porzioni del cibo se esiste ancora con la stessa unità (i valori restano quelli salvati: si scala lo snapshot).
  const food = entry.foodId ? foods.data?.find((candidate) => candidate.id === entry.foodId) : undefined
  const portions = food && food.unit === entry.unit ? food.portions : []
  const [meal, setMeal] = useState<MealType>(entry.mealType)
  const [confirming, setConfirming] = useState(false)

  return (
    <GramsSheet
      title={entry.foodName}
      subtitle="Valori salvati al momento della registrazione"
      initialGrams={entry.grams}
      unit={entry.unit}
      portions={portions}
      preview={(grams) => rescaleEntry(entry, grams)}
      submitLabel="Salva"
      busy={update.isPending}
      error={update.isError ? errorMessage(update.error) : null}
      onSubmit={(grams) => update.mutate({ entry, grams, mealType: meal }, { onSuccess: onClose })}
      onClose={onClose}
    >
      <div className="mt-4">
        <MealPicker name="edit-meal" value={meal} onChange={setMeal} />
      </div>
      <div className="mt-3">
        {confirming ? (
          <button type="button" onClick={onDelete} className={dangerButtonClass}>
            Elimina davvero
          </button>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={dangerButtonClass}>
            Elimina voce
          </button>
        )}
        {confirming && <FormMessage kind="warning">tocca di nuovo per eliminare la voce.</FormMessage>}
      </div>
    </GramsSheet>
  )
}
