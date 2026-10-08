import { OFF_PRODUCT_READS_PER_MINUTE, OFF_SEARCHES_PER_MINUTE } from '../lib/constants'
import {
  convertOffProduct,
  parseProductResponse,
  parseSearchResponse,
  type OffConversion,
  type OffSearchHit,
} from '../lib/openFoodFacts'
import { checkRateLimit } from '../lib/rateLimit'
import { DataError } from './dbErrors'

/**
 * Open Food Facts, sola lettura (ADR-041). Nessun dato personale viene inviato:
 * solo il codice a barre o il testo cercato. Nessuna credenziale.
 */
const OFF_BASE = 'https://world.openfoodfacts.org'
const SEARCH_BASE = 'https://search.openfoodfacts.org'
/** Il browser non permette di impostare lo User-Agent: ci si identifica con app_name (ADR-041). */
const APP_NAME = 'CaloriesRecord'
const TIMEOUT_MS = 12_000
const FIELDS = ['code', 'product_name', 'product_name_it', 'brands', 'nutriments', 'serving_quantity', 'serving_quantity_unit']

// Orari delle richieste recenti, in sessionStorage: il conteggio resiste anche se si ricarica la pagina.
function loadTimes(kind: string): number[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`off.${kind}`) ?? '[]')
    return Array.isArray(value) ? value.filter((t): t is number => typeof t === 'number') : []
  } catch {
    return []
  }
}

function saveTimes(kind: string, times: number[]): void {
  try {
    sessionStorage.setItem(`off.${kind}`, JSON.stringify(times))
  } catch {
    // storage non disponibile: il limite vale solo finché la pagina resta aperta
  }
}

function guard(kind: 'product' | 'search'): void {
  const limit = kind === 'product' ? OFF_PRODUCT_READS_PER_MINUTE : OFF_SEARCHES_PER_MINUTE
  const result = checkRateLimit(loadTimes(kind), Date.now(), limit)
  saveTimes(kind, result.recent)
  if (!result.allowed) {
    throw new DataError(
      `Troppe richieste a Open Food Facts in un minuto (limite del servizio). Riprova tra ${result.retryInSeconds} s.`,
    )
  }
}

/** Senza rete si risponde subito, senza consumare il limite di richieste al minuto. */
function requireOnline(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new DataError('Serve la connessione per cercare su Open Food Facts.')
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  requireOnline()
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (response.status === 429) throw new DataError('Open Food Facts chiede di rallentare: riprova tra un minuto.')
    if (response.status === 503) throw new DataError('Open Food Facts è sovraccarico in questo momento: riprova tra poco.')
    return response
  } catch (error) {
    if (error instanceof DataError) throw error
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new DataError('Open Food Facts non risponde: riprova tra poco.')
    }
    throw new DataError('Non riesco a raggiungere Open Food Facts. Controlla la connessione e riprova.')
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export type OffLookup = { found: false } | { found: true; conversion: OffConversion }

/** Prodotto per codice a barre (API v3.4: struttura `nutriments` stabile). */
export async function lookupBarcode(code: string): Promise<OffLookup> {
  requireOnline()
  guard('product')
  const params = new URLSearchParams({ fields: FIELDS.join(','), app_name: APP_NAME })
  const response = await request(`${OFF_BASE}/api/v3.4/product/${encodeURIComponent(code)}?${params}`)
  if (!response.ok && response.status !== 404) {
    throw new DataError(`Open Food Facts ha risposto con un errore (stato ${response.status}). Riprova tra poco.`)
  }
  const result = parseProductResponse(response.status, await readJson(response))
  return result.found ? { found: true, conversion: convertOffProduct(result.product, code) } : { found: false }
}

/** Ricerca per nome con Search-a-licious. Solo su richiesta esplicita, mai mentre si scrive (limite 10/min). */
export async function searchProducts(query: string): Promise<OffSearchHit[]> {
  requireOnline()
  guard('search')
  // POST: il testo cercato non finisce negli indirizzi registrati nei log (scelta del servizio "per la privacy").
  const response = await request(`${SEARCH_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, langs: ['it', 'en'], page_size: 20, fields: FIELDS }),
  })
  if (!response.ok) {
    throw new DataError(`La ricerca su Open Food Facts non ha funzionato (stato ${response.status}). Riprova tra poco.`)
  }
  return parseSearchResponse(await readJson(response))
}
