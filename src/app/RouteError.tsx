import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

import { secondaryButtonClass } from '../components/ui'

/**
 * Rete di sicurezza di tutte le rotte: se una schermata non si carica (pacchetto sparito dopo un aggiornamento)
 * o va in errore mentre si disegna, l'utente vede un messaggio in italiano invece della pagina tecnica di React Router.
 */
export function RouteError() {
  const error = useRouteError()
  const missing = isRouteErrorResponse(error) && error.status === 404
  return (
    <main role="alert" className="mx-auto max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+48px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">{missing ? 'Pagina non trovata' : 'Qualcosa è andato storto'}</h1>
      <p className="mt-3 text-[15px] text-ink-2">
        {missing
          ? 'Questa pagina non esiste.'
          : 'Non sono riuscito ad aprire questa schermata. Succede, per esempio, dopo un aggiornamento o con la rete debole. I dati salvati sono al sicuro.'}
      </p>
      <button type="button" onClick={() => (missing ? globalThis.location.assign('/') : globalThis.location.reload())} className={`${secondaryButtonClass} mt-6`}>
        Riprova
      </button>
    </main>
  )
}
