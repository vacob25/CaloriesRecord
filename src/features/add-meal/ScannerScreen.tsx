import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Field } from '../../components/Field'
import { FormMessage } from '../../components/States'
import { primaryButtonClass, secondaryButtonClass } from '../../components/ui'
import { errorMessage } from '../../data/dbErrors'
import { useResolveBarcode } from '../../data/queries'
import { isMealType } from '../../lib/labels'
import { isPlausibleBarcode } from '../../lib/openFoodFacts'

type CameraState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable'

const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
])

/** /aggiungi/scanner?pasto=… — fotocamera a schermo intero, torcia se disponibile, codice scritto a mano come alternativa. */
export function ScannerScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const pasto = params.get('pasto')
  const backTo = `/aggiungi${isMealType(pasto) ? `?pasto=${pasto}` : ''}`
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  // La libreria può leggere lo stesso codice più volte prima di fermarsi: si tiene solo la prima lettura.
  const handledRef = useRef(false)
  const [camera, setCamera] = useState<CameraState>('idle')
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const resolve = useResolveBarcode()

  useEffect(() => () => controlsRef.current?.stop(), [])

  function stopCamera() {
    controlsRef.current?.stop()
    controlsRef.current = null
    setTorchOn(false)
  }

  function handleCode(code: string) {
    stopCamera()
    setCamera('idle')
    setNotFound(null)
    resolve.mutate(code, {
      onSuccess: (result) => {
        if (result.kind === 'food') {
          navigate(`${backTo}${backTo.includes('?') ? '&' : '?'}cibo=${result.food.id}`, { replace: true })
        } else if (result.kind === 'incomplete') {
          navigate('/cibi/nuovo', {
            state: {
              prefill: result.form,
              source: 'open_food_facts',
              note: `Su Open Food Facts mancano: ${result.missing.join(', ')}. Completa dall’etichetta e salva.`,
              returnTo: backTo,
            },
          })
        } else {
          setNotFound(result.code)
        }
      },
    })
  }

  // La fotocamera parte solo da un tocco (iOS lo richiede) e solo con HTTPS.
  async function startCamera() {
    if (!videoRef.current || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable')
      return
    }
    setCamera('starting')
    handledRef.current = false
    resolve.reset()
    setNotFound(null)
    try {
      const reader = new BrowserMultiFormatReader(HINTS)
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (result && !handledRef.current) {
            handledRef.current = true
            handleCode(result.getText())
          }
        },
      )
      controlsRef.current = controls
      setTorchAvailable(typeof controls.switchTorch === 'function')
      setCamera('scanning')
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }

  async function toggleTorch() {
    const next = !torchOn
    try {
      await controlsRef.current?.switchTorch?.(next)
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  function handleManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = manual.replace(/\s+/g, '')
    if (!isPlausibleBarcode(code)) {
      setManualError('Il codice a barre è fatto di 8-14 cifre.')
      return
    }
    setManualError(null)
    handleCode(code)
  }

  const scanning = camera === 'scanning' || camera === 'starting'

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink text-surface">
      <div className="relative flex-1 overflow-hidden">
        {/* playsInline e muted: senza, iOS apre il video a schermo intero o non lo avvia. */}
        <video ref={videoRef} playsInline muted autoPlay className={`size-full object-cover ${scanning ? '' : 'hidden'}`} />
        {scanning && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-72 rounded-card border-4 border-surface/90 shadow-[0_0_0_9999px_rgba(21,23,30,0.45)]" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <Link to={backTo} replace className="min-h-11 rounded-full bg-ink/70 px-4 py-2.5 text-[15px] font-bold">
            Annulla
          </Link>
          {scanning && torchAvailable && (
            <button type="button" onClick={toggleTorch} aria-pressed={torchOn} className="min-h-11 rounded-full bg-ink/70 px-4 text-[15px] font-bold">
              {torchOn ? 'Spegni torcia' : 'Torcia'}
            </button>
          )}
        </div>
        {scanning && (
          <p role="status" className="absolute inset-x-0 bottom-6 text-center text-[15px] font-semibold">
            {camera === 'starting' ? 'Avvio fotocamera…' : 'Inquadra il codice a barre nel riquadro'}
          </p>
        )}
        {!scanning && (
          <div className="flex h-full flex-col justify-center px-6 pt-16">
            <h1 className="text-[22px] font-extrabold">Scansiona un codice a barre</h1>
            {resolve.isPending && <p role="status" className="mt-3 text-[15px]">Cerco il prodotto…</p>}
            {camera === 'denied' && (
              <p role="alert" className="mt-3 text-[15px]">
                ⚠︎ Accesso alla fotocamera negato. Puoi riattivarlo in Impostazioni → Safari → Fotocamera (o nelle impostazioni
                dell’app sulla schermata Home), oppure scrivere il codice qui sotto o cercare il prodotto per nome.
              </p>
            )}
            {camera === 'unavailable' && (
              <p role="alert" className="mt-3 text-[15px]">
                ⚠︎ Fotocamera non disponibile su questo dispositivo. Scrivi il codice qui sotto o cerca il prodotto per nome.
              </p>
            )}
            {notFound && (
              <div role="alert" className="mt-3">
                <p className="text-[15px]">Non trovato su Open Food Facts ({notFound}). Crealo a mano: il codice è già compilato.</p>
                <Link
                  to={`/cibi/nuovo?barcode=${notFound}`}
                  state={{ returnTo: backTo }}
                  className={`${primaryButtonClass} mt-3 flex items-center justify-center`}
                >
                  Crea a mano
                </Link>
              </div>
            )}
            {resolve.isError && (
              <div className="text-ink">
                <FormMessage kind="error">{errorMessage(resolve.error)}</FormMessage>
              </div>
            )}
            {camera !== 'denied' && camera !== 'unavailable' && !resolve.isPending && (
              <button type="button" onClick={() => void startCamera()} className={`${primaryButtonClass} mt-5`}>
                {notFound || resolve.isError ? 'Scansiona di nuovo' : 'Avvia fotocamera'}
              </button>
            )}
            <form onSubmit={handleManual} noValidate className="mt-6 rounded-card bg-surface p-4 text-ink">
              <Field
                id="manual-barcode"
                label="Oppure scrivi il codice"
                inputMode="numeric"
                autoComplete="off"
                value={manual}
                onChange={(event) => setManual(event.target.value)}
                error={manualError ?? undefined}
              />
              <button type="submit" disabled={resolve.isPending} className={`${secondaryButtonClass} mt-3`}>
                Cerca codice
              </button>
            </form>
            <Link to={backTo} replace className="mt-4 min-h-11 text-center text-[15px] font-semibold underline">
              Cerca per nome
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
