import { Outlet } from 'react-router-dom'

import { BottomNav } from './BottomNav'
import { UpdatePrompt } from './UpdatePrompt'

export function Layout() {
  return (
    <>
      {/*
        padding-bottom = altezza barra + safe area: l'ultimo contenuto non finisce
        mai sotto la barra di navigazione o sotto l'indicatore Home dell'iPhone.
      */}
      <main className="mx-auto min-h-dvh max-w-[480px] pt-[env(safe-area-inset-top)] pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+16px)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <Outlet />
      </main>
      <UpdatePrompt />
      <BottomNav />
    </>
  )
}
