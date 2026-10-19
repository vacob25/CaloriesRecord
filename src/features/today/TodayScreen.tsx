import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { GramsSheet } from '../../components/GramsSheet'
import { MealPicker } from '../../components/MealPicker'
import { ErrorState, FormMessage, ListSkeleton } from '../../components/States'
import { Toast } from '../../components/Toast'
import { WeightPill } from '../../components/WeightPill'
import { cardClass, dangerButtonClass } from '../../components/ui'
import { useToday } from '../../components/useToday'
import { errorMessage } from '../../data/dbErrors'
import { useDeleteEntry, useEntries, useFoods, useMealSlots, useProfile, useRecalibration, useUpdateEntry } from '../../data/queries'
import type { MealEntry } from '../../data/types'
import { UNDO_SECONDS } from '../../lib/constants'
import { formatLongDate } from '../../lib/dates'
import type { MealType } from '../../lib/labels'
import { groupByMeal, rescaleEntry } from '../../lib/meals'
import { slotName, type MealSlot } from '../../lib/mealSlots'
import { formatNumber } from '../../lib/numbers'
import { formatQuantity } from '../../lib/portions'
import { sumNutrients } from '../../lib/nutrition'
import { dayQuery, dayTitle, nextViewedDay, previousViewedDay, viewedDay } from '../../lib/viewDay'
import { MealSlotsSheet } from './MealSlotsSheet'
import { SportsChoiceSheet } from './SportsChoiceSheet'
import { sportsChoiceDeferred } from './sportsChoice'
import { useEntryDrag } from './useEntryDrag'
import { useDaySwipe } from './useDaySwipe'
import { TargetCard } from './TargetCard'
import { WaterCard } from './WaterCard'
import { WeightReminder } from './WeightReminder'

interface AddedState {
  added?: { id: string; mealType: MealType }
}

export function TodayScreen() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  // Giorno mostrato (step 20): oggi, oppure un giorno passato con ?data=… per registrare ciò che ci si è dimenticati.
  const day = viewedDay(params.get('data'), today)
  const isToday = day === today
  const previousDay = previousViewedDay(day, today)
  const nextDay = nextViewedDay(day, today)
  const goToDay = (target: string) =>
    setParams(target === today ? {} : { data: target }, { replace: true })
  const swipeRef = useRef<HTMLDivElement>(null)
  useDaySwipe(swipeRef, day, {
    onPrevious: previousDay ? () => goToDay(previousDay) : null,
    onNext: nextDay ? () => goToDay(nextDay) : null,
  })
  const entries = useEntries(day)
  const mealSlots = useMealSlots()
  const profile = useProfile()
  // Correzione #18 (ADR-077): sport azzerati dalla migrazione 009. Il pannello si apre da solo una volta per apertura
  // dell'app (non sopra il tutorial); l'avviso resta in Oggi finché non si sceglie.
  const sportsPending = profile.data?.sportsChoicePending === true
  const [sportsSheet, setSportsSheet] = useState<'auto' | 'open' | 'closed'>('auto')
  const showSportsSheet =
    sportsPending &&
    (sportsSheet === 'open' || (sportsSheet === 'auto' && !sportsChoiceDeferred() && profile.data?.tutorialDoneAt !== null))
  const [managingMeals, setManagingMeals] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const deleteEntry = useDeleteEntry(day)
  // Esecuzione settimanale "pigra" della ricalibrazione alla prima apertura (step 10).
  const recalibration = useRecalibration(today)
  const pendingProposal = recalibration.data?.estimate?.status === 'pending'
  const [editing, setEditing] = useState<MealEntry | null>(null)
  const moveEntry = useUpdateEntry()
  const [moved, setMoved] = useState('')

  const added = (location.state as AddedState | null)?.added
  const dismissToast = useCallback(
    () => navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null }),
    [navigate, location.pathname, location.search],
  )

  const list = entries.data ?? []
  const slots = mealSlots.data ?? []
  const groups = groupByMeal(list, slots.map((slot) => slot.key))
  // Spostare una voce in un altro pasto trascinandola (step 21).
  const entryDrag = useEntryDrag<MealEntry>({
    enabled: editing === null && !managingMeals && !moveEntry.isPending,
    onDrop: (entry, mealKey) => {
      setMoved('')
      moveEntry.mutate(
        { entry, grams: entry.grams, mealType: mealKey },
        { onSuccess: () => setMoved(`Spostato in ${slotName(slots, mealKey)}`) },
      )
    },
  })
  const total = sumNutrients(list)

  return (
    <>
      {/* touch-action: pan-y = la pagina scorre in verticale, l'orizzontale è per lo swipe tra i giorni. */}
      <div ref={swipeRef} data-day-swipe className="touch-pan-y">
      <header className="flex items-end justify-between gap-3 px-5 pt-6">
        <div>
          <p className="text-[13px] font-semibold text-muted first-letter:uppercase">{formatLongDate(day)}</p>
          <div className="-ml-3 flex items-center">
            <button
              type="button"
              onClick={() => previousDay && goToDay(previousDay)}
              disabled={previousDay === null}
              aria-label="Giorno precedente"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-[28px] font-extrabold leading-tight">{dayTitle(day, today)}</h1>
            <button
              type="button"
              onClick={() => nextDay && goToDay(nextDay)}
              disabled={nextDay === null}
              aria-label="Giorno successivo"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <div data-tour="weight">
          <WeightPill date={day} />
        </div>
      </header>

      {!isToday && (
        <div role="status" className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-card bg-green-tint px-4 py-2 text-[13px] font-semibold text-green-dark">
          <span>Stai modificando un giorno passato: ciò che aggiungi va a quel giorno.</span>
          <button type="button" onClick={() => goToDay(today)} className="min-h-11 shrink-0 px-2 text-[15px] font-bold underline">
            Torna a oggi
          </button>
        </div>
      )}

      {isToday && <WeightReminder today={today} />}

      {sportsPending && (
        <section aria-label="Sport da scegliere" className="mx-5 mt-4 rounded-card bg-green-tint px-4 py-3">
          <p className="text-[15px] font-bold text-green-dark">Scegli i tuoi sport</p>
          <p className="mt-1 text-[13px] text-ink-2">
            Per un errore ti avevamo assegnato Palestra e Calcio: li abbiamo tolti. Finché non scegli, ogni giorno conta come riposo.
          </p>
          <button
            type="button"
            onClick={() => setSportsSheet('open')}
            className="mt-2 min-h-11 rounded-button bg-green px-4 text-[15px] font-bold text-surface"
          >
            Scegli gli sport
          </button>
        </section>
      )}

      {pendingProposal && (
        <Link
          to="/profilo#ricalibrazione"
          className="mx-5 mt-4 flex min-h-12 items-center justify-between rounded-card bg-green-tint px-4 text-[15px] font-semibold text-green-dark"
        >
          Nuova proposta di ricalibrazione <span aria-hidden="true">›</span>
        </Link>
      )}

      <TargetCard date={day} eaten={total} />

      {entries.isError && <ErrorState message={errorMessage(entries.error)} onRetry={() => void entries.refetch()} />}
      {deleteEntry.isError && <ErrorState message={errorMessage(deleteEntry.error)} />}

      <div data-tour="meals">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-[15px] font-bold">Pasti</h2>
          <button
            type="button"
            onClick={() => setManagingMeals(true)}
            disabled={!mealSlots.isSuccess}
            aria-label="Gestisci i pasti"
            className="-mr-3 flex size-11 items-center justify-center rounded-full text-ink-2 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>

        {(entries.isPending || mealSlots.isPending) && <ListSkeleton rows={4} />}
        {mealSlots.isError && <ErrorState message={errorMessage(mealSlots.error)} onRetry={() => void mealSlots.refetch()} />}

        {entries.isSuccess && mealSlots.isSuccess && (
          <div className="space-y-3 px-5 pt-1">
            {slots.map((slot) => {
              const { entries: mealEntries, total: mealTotal } = groups[slot.key]!
              const query = [`pasto=${slot.key}`, dayQuery(day, today)].filter(Boolean).join('&')
              const addLink = `/aggiungi?${query}`
              if (mealEntries.length === 0) {
                return (
                  <Link
                    key={slot.key}
                    to={addLink}
                    data-meal-key={slot.key}
                    className={`flex min-h-16 items-center justify-between rounded-card border-2 border-dashed px-5 text-[15px] transition-colors ${
                      entryDrag.drag?.over === slot.key ? 'border-green bg-green-tint' : 'border-line'
                    }`}
                  >
                    <span className="font-bold">{slot.name}</span>
                    <span className="font-semibold text-green-dark">+ Aggiungi</span>
                  </Link>
                )
              }
              return (
                <section
                  key={slot.key}
                  aria-label={slot.name}
                  data-meal-key={slot.key}
                  className={`${cardClass} px-5 py-4 transition-shadow ${entryDrag.drag?.over === slot.key ? 'ring-2 ring-green' : ''}`}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[18px] font-extrabold">{slot.name}</h3>
                    <p className="text-[15px] font-bold tabular-nums">{formatNumber(mealTotal.kcal)} kcal</p>
                  </div>
                  <ul className="mt-2 divide-y divide-line">
                    {mealEntries.map((entry) => (
                      <li
                        key={entry.id}
                        {...entryDrag.rowProps(entry)}
                        style={entryDrag.rowStyle(entry.id)}
                        className={`select-none [-webkit-touch-callout:none] ${entryDrag.drag?.id === entry.id ? entryDrag.liftedClass : ''}`}
                      >
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
      </div>

      <WaterCard date={day} />
      </div>
      <p role="status" className="sr-only">
        {moved}
      </p>

      {editing && (
        <EditEntrySheet
          // Chiavi con prefisso: pannello e avviso sono fratelli e possono riguardare la stessa voce
          // (si tocca subito la voce appena aggiunta). Con la stessa chiave React si blocca.
          key={`modifica-${editing.id}`}
          entry={editing}
          slots={slots}
          onClose={() => setEditing(null)}
          onDelete={() => {
            deleteEntry.mutate(editing.id)
            setEditing(null)
          }}
        />
      )}

      {showSportsSheet && <SportsChoiceSheet onClose={() => setSportsSheet('closed')} />}
      {managingMeals && <MealSlotsSheet slots={slots} onClose={() => setManagingMeals(false)} />}

      {added && slots.some((slot) => slot.key === added.mealType) && (
        <Toast
          key={`aggiunto-${added.id}`}
          message={`Aggiunto a ${slotName(slots, added.mealType).toLowerCase()}`}
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
function EditEntrySheet({ entry, slots, onClose, onDelete }: { entry: MealEntry; slots: readonly MealSlot[]; onClose: () => void; onDelete: () => void }) {
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
        <MealPicker name="edit-meal" value={meal} onChange={setMeal} slots={slots} />
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
