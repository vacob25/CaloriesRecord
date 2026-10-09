import { Link } from 'react-router-dom'

import { readPrivacyContact } from '../../data/env'
import { PRIVACY_VERSION } from '../../lib/auth'
import { formatLongDate } from '../../lib/dates'

/**
 * /privacy — pagina pubblica (anche senza login), linkata da Accedi e Registrati (step 18).
 * Testo di base da far rivedere: i dati su peso e alimentazione sono dati sulla salute (GDPR art. 9).
 * Il contatto arriva da VITE_PRIVACY_CONTACT (Vercel), mai dal repo.
 */
export function PrivacyScreen() {
  const contact = readPrivacyContact(import.meta.env)

  const h2 = 'mt-6 text-[18px] font-extrabold'
  const p = 'mt-2 text-[15px] leading-relaxed text-ink-2'

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
      <Link to="/login" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-green-dark">
        <span aria-hidden="true">‹</span> Indietro
      </Link>
      <h1 className="mt-2 text-[28px] font-extrabold leading-tight">Privacy</h1>
      <p className="mt-1 text-[13px] text-muted">Versione del {formatLongDate(PRIVACY_VERSION)}</p>
      <p role="note" className="mt-4 rounded-button border-l-4 border-ink bg-surface p-3 text-[13px] font-semibold text-ink">
        Testo di base da far rivedere: i dati su peso e alimentazione sono dati sulla salute.
      </p>

      <h2 className={h2}>Chi gestisce i dati</h2>
      <p className={p}>
        CaloriesRecord è un’app personale, usata da un piccolo gruppo di tester invitati. Non è un servizio commerciale e
        non è un dispositivo medico.
      </p>

      <h2 className={h2}>Quali dati</h2>
      <ul className={`${p} list-disc space-y-1 pl-5`}>
        <li>Account: email e password (la password è salvata cifrata da Supabase: nessuno la può leggere).</li>
        <li>Profilo: sesso, data di nascita, altezza, peso obiettivo e parametri del calcolo.</li>
        <li>Pesate, cibi, ricette, pasti, acqua, target giornalieri e stime della ricalibrazione.</li>
        <li>Consenso: versione di questa informativa e data in cui l’hai accettata.</li>
      </ul>

      <h2 className={h2}>Perché</h2>
      <p className={p}>
        Solo per farti funzionare l’app: calcolare il tuo target, i macro, le statistiche e l’andamento del peso. Base:
        il tuo consenso esplicito alla registrazione, necessario perché sono dati sulla salute. Puoi revocarlo eliminando
        l’account.
      </p>

      <h2 className={h2}>Dove stanno</h2>
      <ul className={`${p} list-disc space-y-1 pl-5`}>
        <li>Database e account: Supabase, server nella regione di Francoforte (Germania, UE).</li>
        <li>Il sito dell’app: Vercel (serve solo i file dell’app, non i tuoi dati).</li>
        <li>Email: l’app non ne invia. Se in futuro servirà, passeranno da Resend.</li>
        <li>
          Ricerca prodotti: a Open Food Facts arrivano solo il codice a barre o il testo che cerchi, mai i tuoi dati.
        </li>
      </ul>

      <h2 className={h2}>Chi li vede</h2>
      <p className={p}>
        Ogni utente vede solo i propri dati: lo garantisce il database (Row Level Security), non solo l’app. L’amministratore
        tecnico del progetto può accedere al database per manutenzione; non condivide né vende i dati.
      </p>
      <p className={p}>
        Nessuna pubblicità, nessun tracker, nessuna statistica di utilizzo. Il browser conserva solo la sessione di accesso.
      </p>

      <h2 className={h2}>Esportare e cancellare</h2>
      <p className={p}>
        Dal Profilo: «Esporta i miei dati» ti dà un file con tutti i tuoi dati. «Elimina account» cancella subito, e per
        sempre, l’account e tutti i dati collegati. Il piano gratuito di Supabase non conserva copie di backup.
      </p>
      <p className={p}>Puoi chiedere in ogni momento accesso, correzione o cancellazione dei tuoi dati.</p>

      <h2 className={h2}>Contatto</h2>
      <p className={p}>{contact ?? 'Contatto non ancora configurato: chiedilo a chi ti ha invitato.'}</p>
    </main>
  )
}
