import { lazy, Suspense } from 'react'

import { ListSkeleton } from '../components/States'

// Peso e Statistiche usano Recharts (pesante): si caricano solo quando servono.
const WeightScreenLazy = lazy(() => import('../features/weight/WeightScreen').then((m) => ({ default: m.WeightScreen })))
const ScannerScreenLazy = lazy(() => import('../features/add-meal/ScannerScreen').then((m) => ({ default: m.ScannerScreen })))
const StatsScreenLazy = lazy(() => import('../features/stats/StatsScreen').then((m) => ({ default: m.StatsScreen })))

export function WeightPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <WeightScreenLazy />
    </Suspense>
  )
}

export function StatsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <StatsScreenLazy />
    </Suspense>
  )
}

export function ScannerPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <ScannerScreenLazy />
    </Suspense>
  )
}
