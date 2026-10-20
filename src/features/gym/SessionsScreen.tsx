import { Link } from 'react-router-dom'

import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/States'
import { cardClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useRecentSessions } from '../../data/queries'
import { formatShortDate } from '../../lib/dates'

/** /palestra/allenamenti — gli ultimi 20 allenamenti (anche quello in corso). */
export function SessionsScreen() {
  const sessions = useRecentSessions()
  return (
    <>
      <ScreenHeader title="Allenamenti" backTo="/palestra" />
      <div className="space-y-2 px-5 pt-4">
        {sessions.isPending && <ListSkeleton rows={4} />}
        {sessions.isError && <ErrorState message={errorMessage(sessions.error)} onRetry={() => void sessions.refetch()} />}
        {sessions.data && sessions.data.length === 0 && <EmptyState text="Nessun allenamento ancora. Quando ne fai uno compare qui." />}
        <ul className="space-y-2">
          {(sessions.data ?? []).map((session) => (
            <li key={session.id}>
              <Link to={`/palestra/allenamento/${session.id}`} className={`${cardClass} flex min-h-16 flex-col justify-center px-4 py-3`}>
                <span className="text-[17px] font-extrabold leading-snug">
                  {session.dayName ?? 'Allenamento libero'}
                  {session.endedAt === null && <span className="ml-2 rounded-full bg-green-tint px-2 py-0.5 align-middle text-[11px] font-bold text-green-dark">In corso</span>}
                </span>
                <span className="text-[13px] text-muted">
                  {formatShortDate(session.date)}
                  {session.planName ? ` · ${session.planName}` : ''} · {session.exercisesDone}/{session.exercisesTotal} esercizi · {session.workSets} serie
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
