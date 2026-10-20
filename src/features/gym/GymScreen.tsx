import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState } from '../../components/States'

/** Palestra: per ora solo la sezione (Fase 3 aggiunge la libreria degli esercizi, poi schede e sessioni). */
export function GymScreen() {
  return (
    <>
      <ScreenHeader title="Palestra" />
      <div className="px-5 pt-4">
        <EmptyState text="Qui arriveranno gli esercizi, le schede e le sessioni di allenamento." />
      </div>
    </>
  )
}
