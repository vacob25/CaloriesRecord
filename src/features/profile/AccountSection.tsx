import { useState } from 'react'

import { FormMessage } from '../../components/States'
import { cardClass, dangerButtonClass, inputClass, secondaryButtonClass } from '../../components/ui'
import { deleteMyAccount, exportMyData } from '../../data/account'
import { signOut } from '../../data/auth'
import { errorMessage } from '../../data/dbErrors'
import { localDate } from '../../lib/dates'
import { buildExport, DELETE_CONFIRM_WORD, exportFileName, isDeleteConfirmed } from '../../lib/exportData'

type ExportState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'shared' } | { kind: 'text'; json: string; copied: boolean } | { kind: 'error'; message: string }

/**
 * I tuoi dati (step 18): esporta in JSON ed elimina l'account.
 * Su iOS in PWA scaricare un file è inaffidabile: si usa il foglio di condivisione (navigator.share con un file);
 * se non è disponibile si mostra il testo con "Copia".
 */
export function AccountSection() {
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' })
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleExport() {
    setExportState({ kind: 'busy' })
    try {
      const { email, data } = await exportMyData()
      const json = buildExport(data, new Date(), email)
      const file = new File([json], exportFileName(localDate(new Date())), { type: 'application/json' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'I miei dati di CaloriesRecord' })
          setExportState({ kind: 'shared' })
          return
        } catch (error) {
          // Foglio chiuso senza scegliere: nessun errore da mostrare.
          if (error instanceof DOMException && error.name === 'AbortError') {
            setExportState({ kind: 'idle' })
            return
          }
        }
      }
      setExportState({ kind: 'text', json, copied: false })
    } catch (error) {
      setExportState({ kind: 'error', message: errorMessage(error) })
    }
  }

  async function copy(json: string) {
    try {
      await navigator.clipboard.writeText(json)
      setExportState({ kind: 'text', json, copied: true })
    } catch {
      setExportState({ kind: 'text', json, copied: false })
    }
  }

  async function handleDelete() {
    if (!isDeleteConfirmed(confirmText)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteMyAccount()
      // Account cancellato: si esce da questo dispositivo e si pulisce tutto (cache e storage).
      await signOut()
    } catch (error) {
      setDeleteError(errorMessage(error))
      setDeleting(false)
    }
  }

  return (
    <section aria-labelledby="account-title" className={`${cardClass} mx-5 mt-4 p-5`}>
      <h2 id="account-title" className="text-[18px] font-extrabold">
        I tuoi dati
      </h2>
      <p className="mt-1 text-[13px] text-muted">Un file JSON con tutto: profilo, pesate, cibi, pasti, acqua, target.</p>
      <button type="button" onClick={() => void handleExport()} disabled={exportState.kind === 'busy'} className={`${secondaryButtonClass} mt-3`}>
        {exportState.kind === 'busy' ? 'Preparo il file…' : 'Esporta i miei dati'}
      </button>
      {exportState.kind === 'shared' && (
        <p role="status" className="mt-2 text-[13px] font-semibold text-green-dark">
          File pronto: salvalo in File o mandalo dove vuoi.
        </p>
      )}
      {exportState.kind === 'error' && <FormMessage kind="error">{exportState.message}</FormMessage>}
      {exportState.kind === 'text' && (
        <div className="mt-3">
          <label htmlFor="export-json" className="block text-[13px] font-semibold text-ink-2">
            Il tuo file (condivisione non disponibile qui): copia il testo
          </label>
          <textarea id="export-json" readOnly value={exportState.json} rows={6} className={`${inputClass} font-mono text-[12px]`} />
          <button type="button" onClick={() => void copy(exportState.json)} className={`${secondaryButtonClass} mt-2`}>
            {exportState.copied ? 'Copiato' : 'Copia tutto'}
          </button>
        </div>
      )}

      <h3 className="mt-6 text-[15px] font-bold">Elimina account</h3>
      <p className="mt-1 text-[13px] text-muted">
        Cancella subito e per sempre l’account e tutti i tuoi dati. Non si può annullare: se vuoi una copia, esporta prima.
      </p>
      <label htmlFor="delete-confirm" className="mt-3 block text-[13px] font-semibold text-ink-2">
        Scrivi {DELETE_CONFIRM_WORD} per confermare
      </label>
      <input
        id="delete-confirm"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
        className={inputClass}
      />
      {deleteError && <FormMessage kind="error">{deleteError}</FormMessage>}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={!isDeleteConfirmed(confirmText) || deleting}
        className={`${dangerButtonClass} mt-3`}
      >
        {deleting ? 'Eliminazione…' : 'Elimina account e dati'}
      </button>
    </section>
  )
}
