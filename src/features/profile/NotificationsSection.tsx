import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { FormMessage } from '../../components/States'
import { cardClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { disablePush, enablePush, readPushState, sendTestPush } from '../../data/push'
import { testResultMessage, type PushState } from '../../lib/push'

const stateQueryKey = ['push-state'] as const

const EXPLANATION: Partial<Record<PushState, string>> = {
  'not-configured': 'Le notifiche non sono ancora configurate in questa versione dell’app.',
  unsupported: 'Questo browser non supporta le notifiche.',
  'needs-install': 'Su iPhone le notifiche funzionano solo dall’app installata: in Safari tocca Condividi → “Aggiungi alla schermata Home”, poi aprila da lì.',
  denied: 'Hai negato il permesso. Per riattivarlo: Impostazioni di iPhone → Notifiche → Calorie.',
}

/** Notifiche (Fase 1, ADR-086): attivazione per dispositivo e notifica di prova. Per ora nessun promemoria automatico. */
export function NotificationsSection() {
  const client = useQueryClient()
  const state = useQuery({ queryKey: stateQueryKey, queryFn: readPushState, staleTime: 0, gcTime: 0 })
  const refresh = () => client.invalidateQueries({ queryKey: stateQueryKey })
  const enable = useMutation({ mutationFn: enablePush, onSettled: refresh })
  const disable = useMutation({ mutationFn: disablePush, onSettled: refresh })
  const test = useMutation({ mutationFn: sendTestPush })

  const current = state.data
  return (
    <section aria-labelledby="notifications-title" className={`${cardClass} mx-5 mt-4 p-5`}>
      <h2 id="notifications-title" className="text-[18px] font-extrabold">
        Notifiche
      </h2>
      {current === undefined && <p className="mt-1 text-[13px] text-muted">Controllo…</p>}
      {current !== undefined && EXPLANATION[current] && <p className="mt-1 text-[13px] text-muted">{EXPLANATION[current]}</p>}
      {current === 'off' && (
        <>
          <p className="mt-1 text-[13px] text-muted">
            Attivale su questo dispositivo. Il testo passa dai server di Apple o Google, quindi non contiene mai peso, calorie o cibi.
          </p>
          <button type="button" onClick={() => enable.mutate()} disabled={enable.isPending} className={`${primaryButtonClass} mt-3`}>
            {enable.isPending ? 'Attivazione…' : 'Attiva le notifiche'}
          </button>
        </>
      )}
      {current === 'on' && (
        <>
          <p className="mt-1 text-[13px] text-muted">Attive su questo dispositivo.</p>
          <button type="button" onClick={() => test.mutate()} disabled={test.isPending} className={`${primaryButtonClass} mt-3`}>
            {test.isPending ? 'Invio…' : 'Invia notifica di prova'}
          </button>
          <button type="button" onClick={() => disable.mutate()} disabled={disable.isPending} className={`${secondaryButtonClass} mt-3`}>
            {disable.isPending ? 'Disattivazione…' : 'Disattiva'}
          </button>
        </>
      )}
      {enable.isError && <FormMessage kind="error">{errorMessage(enable.error)}</FormMessage>}
      {disable.isError && <FormMessage kind="error">{errorMessage(disable.error)}</FormMessage>}
      {test.isError && <FormMessage kind="error">{errorMessage(test.error)}</FormMessage>}
      {test.isSuccess && (
        <p role="status" className="mt-3 text-[13px] font-semibold text-green-dark">
          {testResultMessage(test.data)}
        </p>
      )}
    </section>
  )
}
