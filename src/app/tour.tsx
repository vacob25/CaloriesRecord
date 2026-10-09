import { createContext, useContext } from 'react'

/** Permette a una schermata (Profilo → "Rivedi il tutorial") di riaprire il tutorial. */
export interface TourControls {
  start: () => void
}

export const TourContext = createContext<TourControls>({ start: () => undefined })

export function useTour(): TourControls {
  return useContext(TourContext)
}
