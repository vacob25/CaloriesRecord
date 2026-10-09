# Architettura

Single-page app React servita come PWA. Nessun backend proprio: il browser parla direttamente con Supabase (protetto da RLS) e con Open Food Facts.

```
iPhone (Safari, PWA) ──► Vercel (file statici)
        │
        ├──► Supabase: Auth (email e password) + Postgres (RLS)
        └──► Open Food Facts: world.openfoodfacts.org (barcode, API v3.4)
             e search.openfoodfacts.org (ricerca per nome) — ADR-041
```

## Dipendenze
| Pacchetto | Scopo | Stato |
| --- | --- | --- |
| react, react-dom, vite, typescript | base | deciso |
| tailwindcss | stile | deciso |
| vite-plugin-pwa | manifest e service worker | deciso |
| @supabase/supabase-js | database e login | deciso (installato allo step 3) |
| recharts | grafici | deciso (installato allo step 7; caricato solo nelle schermate Peso e Statistiche) |
| vitest | test | deciso |
| @zxing/browser (+ @zxing/library, sua dipendenza obbligatoria) | barcode da fotocamera | deciso (installato allo step 8; caricato solo nello scanner) |
| react-router-dom | navigazione tra schermate | deciso (ADR-006) |
| @tanstack/react-query | cache e stato dei dati server | deciso (ADR-007, installato allo step 4) |
| zod | validazione di input e risposte API | deciso (ADR-008, installato allo step 3) |
| @vitejs/plugin-react, @tailwindcss/vite | plugin di build per React e Tailwind v4 | deciso (step 2) |
| oxlint | lint (comando `npm run lint`) | deciso (ADR-016) |
| @fontsource-variable/plus-jakarta-sans | font servito dall'app, non da Google | deciso (ADR-017) |

Non aggiungere altro senza motivarlo all'utente.

## Struttura cartelle
I test unitari stanno accanto al file che provano (`x.test.ts`). Elenco ad alto livello: per i dettagli basta `ls`.
```
src/
  lib/            logica pura, senza React né Supabase (testata)
    nutrition.ts  targets.ts      BMR, mantenimento, target del giorno, macro, ritmo stimato (§2)
    weight.ts  weightText.ts      media mobile, pendenza, promemoria, testi del peso
    recalibration.ts              proposta di ricalibrazione (§7)
    stats.ts  period.ts           statistiche e periodi settimana/mese
    dates.ts                      giorno locale Europe/Rome
    meals.ts  search.ts           pasti, recenti, quantità proposta, ricerca senza accenti
    portions.ts  water.ts         porzioni casalinghe, acqua
    foodValidation.ts  recipeValidation.ts  profileValidation.ts   validazione dei moduli (§9, §10)
    openFoodFacts.ts  catalog.ts  conversione e validazione di OFF e del catalogo
    rateLimit.ts  auth.ts  numbers.ts  labels.ts   limiti OFF, login/registrazione/pulizia storage, numeri, etichette
    exportData.ts                         esportazione dei propri dati e conferma eliminazione (step 18)
    constants.ts                  tutte le costanti di dominio
    __fixtures__/                 risposta OFF inventata per i test
  data/           accesso ai dati (unico posto che conosce Supabase/OFF)
    supabase.ts  env.ts           client e variabili d'ambiente
    auth.ts  authErrors.ts  dbErrors.ts   login, registrazione, uscita ed errori in italiano
    account.ts                            esporta i miei dati, elimina account (step 18)
    foods.ts  meals.ts  profile.ts  weights.ts  targets.ts  recalibration.ts  water.ts
    openFoodFacts.ts  barcode.ts  chiamate a OFF; codice a barre: prima i propri cibi, poi OFF
    queries.ts                    hook TanStack Query condivisi (useFoods, useEntries, …) e chiavi della cache
    types.ts                      tipi delle righe del database
    catalog/ingredienti.json      catalogo degli ingredienti (ADR-050), con il suo test
  features/       una cartella per area, con componenti e hook propri
    today/  add-meal/  foods/  weight/  stats/  profile/  auth/  privacy/
  components/     UI condivisa: SheetFrame, GramsSheet, ConfirmButton, FavoriteButton, Field, Icon,
                  MacroBar, MealPicker, OfflineBanner, Ring, ScreenHeader, States, Toast,
                  WaterIcon, WeightChart, WeightPill, ui.ts, useToday.ts
  app/            router, layout, provider, guardie delle rotte, barra di navigazione, avviso di aggiornamento
  styles/         tailwind e token (index.css)
supabase/
  migrations/     SQL numerati (001, 002, 003; vedi DATA_MODEL.md)
  checks/         rls_two_users.sql, verifica RLS con due utenti (SECURITY.md)
docs/
```

## Regole di livello
1. `lib/` non importa da `data/`, `features/` o React. Riceve dati, restituisce dati.
2. Solo `data/` parla con la rete. I componenti non chiamano mai `supabase` direttamente.
3. Un componente di `features/x` non importa da `features/y`: ciò che è condiviso va in `components/` o `lib/`.
4. Nessuna formula nei componenti. Se serve un numero calcolato, c'è una funzione in `lib/` con test.
5. Le risposte di Open Food Facts si validano e si convertono in un tipo interno prima di usarle: non fidarti dei campi (possono mancare o essere sbagliati).

## Flusso dati
- Lettura: componente → hook (`useEntries(date)` in `data/queries.ts`) → `data/meals.ts` → Supabase. Cache per chiave `[tabella, data]`. Gli hook usati da più feature stanno in `data/queries.ts` (regola 3: una feature non importa da un'altra).
- All'uscita (logout) la cache di TanStack Query si svuota: nessun dato dell'utente resta in memoria.
- Scrittura: componente → mutation → `data/…` → invalida le chiavi toccate. Aggiornamento ottimistico solo sulla cancellazione di una voce pasto (sparisce subito, torna se il server dà errore). L'aggiunta non è ottimistica: dopo il salvataggio compare l'avviso "Aggiunto · Annulla".
- Il target del giorno si legge da `daily_targets`; se manca per quella data si crea (vedi DOMAIN_RULES.md, "Target del giorno") copiando i parametri del profilo.

## PWA e iPhone (limiti reali)
- Si installa da Safari: Condividi → "Aggiungi alla schermata Home". Serve HTTPS (Vercel lo dà).
- Manifest: `display: standalone`, `lang: it`, icone 192 e 512 (anche maskable), `apple-touch-icon` 180 px, `theme_color: #1A7F5A`. Aggiungere i meta `apple-mobile-web-app-capable` e `viewport-fit=cover`; gestire le safe area (`env(safe-area-inset-*)`) per notch e barra in basso.
- Il service worker mette in cache solo la shell dell'app (file del build: JS, CSS, HTML, icone, font). Il catalogo `ingredienti.json` si carica solo quando serve (`import()` dinamico, scheda Catalogo o ricerca) ma, essendo un file del build, è nel precache come gli altri. Dati e calcoli richiedono rete: se manca, mostrare un messaggio chiaro, non fingere. Nessuna modalità offline in v1.
- Fotocamera: `getUserMedia` richiede un gesto dell'utente (tap) e HTTPS; sul `<video>` servono `playsinline` e `muted`. Va provata su iPhone vero, non solo sul simulatore.
- Gli aggiornamenti del service worker su iOS arrivano al riavvio dell'app: prevedere un avviso "nuova versione disponibile" (`registerType: 'prompt'`).
- iOS può cancellare i dati locali dei siti poco usati: nessun dato importante solo in localStorage. In locale solo preferenze (es. ultimo pasto scelto).
- Login: email e password nell'app (ADR-028), con Portachiavi iCloud; mai link magico. Il codice OTP (ADR-014) è rinviato allo step 12. Su iOS l'app installata ha uno storage separato da Safari (problema noto di WebKit): un link nella mail si aprirebbe in Safari e accederebbe lì, non nella PWA (ADR-014).
- Notifiche e widget: fuori scope in v1.

## Errori e stati
Ogni schermata gestisce tre stati: caricamento (scheletro), errore (messaggio + riprova), vuoto (invito all'azione). Gli errori di rete non cancellano mai ciò che l'utente stava scrivendo.

## Variabili d'ambiente
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (la chiave publishable `sb_publishable_…`; le vecchie chiavi `anon`/`service_role` sono deprecate da Supabase entro fine 2026). Nient'altro. Elenco in `.env.example`, valori solo in `.env.local` (ignorato da git) e nelle impostazioni di Vercel.
