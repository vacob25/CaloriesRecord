import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { OfflineBanner } from '../components/OfflineBanner'
import { useProfile, useSetTutorialDone } from '../data/queries'
import { nextStep, previousStep, isLastStep, TOUR_STEPS } from '../lib/tutorial'
import { BottomNav } from './BottomNav'
import { TourContext } from './tour'
import { TourPopup } from './TourPopup'

export function Layout() {
  const profile = useProfile()
  const markDone = useSetTutorialDone()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const autoOpened = useRef(false)

  const goTo = useCallback(
    (next: number) => {
      setIndex(next)
      navigate(TOUR_STEPS[next]!.path)
    },
    [navigate],
  )

  const start = useCallback(() => {
    setOpen(true)
    goTo(0)
  }, [goTo])

  // Prima apertura dopo la registrazione (o per chi non l'ha mai visto): il tutorial parte da solo, una volta.
  useEffect(() => {
    if (autoOpened.current || !profile.data || profile.data.tutorialDoneAt !== null) return
    autoOpened.current = true
    setOpen(true)
    setIndex(0)
  }, [profile.data])

  function close() {
    setOpen(false)
    // Finito o saltato: non si ripropone da solo (si rivede dal Profilo).
    if (profile.data?.tutorialDoneAt === null) markDone.mutate(true)
  }

  const controls = useMemo(() => ({ start }), [start])

  return (
    <TourContext.Provider value={controls}>
      {/*
        padding-bottom = altezza barra + safe area: l'ultimo contenuto non finisce
        mai sotto la barra di navigazione o sotto l'indicatore Home dell'iPhone.
      */}
      <main className="mx-auto min-h-dvh max-w-[480px] pt-[env(safe-area-inset-top)] pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+16px)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <OfflineBanner />
        <Outlet />
      </main>
      <BottomNav />
      {open && (
        <TourPopup
          index={index}
          pathname={pathname}
          onBack={() => goTo(previousStep(index))}
          onNext={() => (isLastStep(index) ? close() : goTo(nextStep(index)))}
          onClose={close}
        />
      )}
    </TourContext.Provider>
  )
}
