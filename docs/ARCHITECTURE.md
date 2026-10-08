# Architettura

Single-page app React servita come PWA. Nessun backend proprio: il browser parla direttamente con Supabase (protetto da RLS) e con Open Food Facts.

```
iPhone (Safari, PWA) ──► Vercel (file statici)
        │
        ├──► Supabase: Auth (email e password) + Postgres (RLS)
        └──► Open Food Facts (ricerca, barcode)
```

## Dipendenze
| Pacchetto | Scopo | Stato |
| --- | --- | --- |
| react, react-dom, vite, typescript | base | deciso |
| tailwindcss | stile | deciso |
| vite-plugin-pwa | manifest e service worker | deciso |
| @supabase/supabase-js | database e login | deciso (installato allo step 3) |
| recharts | grafici | deciso |
| vitest | test | deciso |
| @zxing/browser | barcode da fotocamera | deciso (step 8) |
| react-router-dom | navigazione tra schermate | deciso (ADR-006) |
| @tanstack/react-query | cache e stato dei dati server | deciso (ADR-007) |
| zod | validazione di input e risposte API | deciso (ADR-008, installato allo step 3) |
| @vitejs/plugin-react, @tailwindcss/vite | plugin di build per React e Tailwind v4 | deciso (step 2) |
| oxlint | lint (comando `npm run lint`) | deciso (ADR-016) |
| @fontsource-variable/plus-jakarta-sans | font servito dall'app, non da Google | deciso (ADR-017) |

Non aggiungere altro senza motivarlo all'utente.

## Struttura cartelle
```
src/
  lib/            logica pura, senza React né Supabase (testata)
    nutrition.ts    BMR, mantenimento, target, macro
    weight.ts       media mobile, pendenza
    recalibration.ts proposta di ricalibrazione
    dates.ts        giorno locale Europe/Rome, intervalli settimana/mese
    stats.ts        aggregazioni per le statistiche
  data/           accesso ai dati (unico posto che conosce Supabase/OFF)
    supabase.ts     client
    foods.ts  meals.ts  weight.ts  targets.ts  profile.ts
    openFoodFacts.ts
    types.ts        tipi generati/derivati dallo schema
  features/       una cartella per area, con componenti e hook propri
    today/  add-meal/  foods/  weight/  stats/  profile/  auth/
  components/     componenti UI condivisi (Ring, MacroBar, Sheet, Button...)
  app/            router, layout, provider, barra di navigazione
  styles/         tailwind e token
tests/            test di integrazione se servono (i test unitari stanno accanto ai file)
supabase/
  migrations/     SQL numerati (vedi DATA_MODEL.md)
docs/
```

## Regole di livello
1. `lib/` non importa da `data/`, `features/` o React. Riceve dati, restituisce dati.
2. Solo `data/` parla con la rete. I componenti non chiamano mai `supabase` direttamente.
3. Un componente di `features/x` non importa da `features/y`: ciò che è condiviso va in `components/` o `lib/`.
4. Nessuna formula nei componenti. Se serve un numero calcolato, c'è una funzione in `lib/` con test.
5. Le risposte di Open Food Facts si validano e si convertono in un tipo interno prima di usarle: non fidarti dei campi (possono mancare o essere sbagliati).

## Flusso dati
- Lettura: componente → hook (`useMealsForDay(date)`) → `data/meals.ts` → Supabase. Cache per chiave `[tabella, data]`.
- Scrittura: componente → mutation → `data/…` → invalida le chiavi toccate. Aggiornamento ottimistico solo su aggiunta/cancellazione di una voce pasto.
- Il target del giorno si legge da `daily_targets`; se manca per quella data si crea (vedi DOMAIN_RULES.md, "Target del giorno") copiando i parametri del profilo.

## PWA e iPhone (limiti reali)
- Si installa da Safari: Condividi → "Aggiungi alla schermata Home". Serve HTTPS (Vercel lo dà).
- Manifest: `display: standalone`, `lang: it`, icone 192 e 512 (anche maskable), `apple-touch-icon` 180 px, `theme_color: #1A7F5A`. Aggiungere i meta `apple-mobile-web-app-capable` e `viewport-fit=cover`; gestire le safe area (`env(safe-area-inset-*)`) per notch e barra in basso.
- Il service worker mette in cache solo la shell dell'app. Dati e calcoli richiedono rete: se manca, mostrare un messaggio chiaro, non fingere. Nessuna modalità offline in v1.
- Fotocamera: `getUserMedia` richiede un gesto dell'utente (tap) e HTTPS; sul `<video>` servono `playsinline` e `muted`. Va provata su iPhone vero, non solo sul simulatore.
- Gli aggiornamenti del service worker su iOS arrivano al riavvio dell'app: prevedere un avviso "nuova versione disponibile" (`registerType: 'prompt'`).
- iOS può cancellare i dati locali dei siti poco usati: nessun dato importante solo in localStorage. In locale solo preferenze (es. ultimo pasto scelto).
- Login: email e password nell'app (ADR-028), con Portachiavi iCloud; mai link magico. Il codice OTP (ADR-014) è rinviato allo step 12. Su iOS l'app installata ha uno storage separato da Safari (problema noto di WebKit): un link nella mail si aprirebbe in Safari e accederebbe lì, non nella PWA (ADR-014).
- Notifiche e widget: fuori scope in v1.

## Errori e stati
Ogni schermata gestisce tre stati: caricamento (scheletro), errore (messaggio + riprova), vuoto (invito all'azione). Gli errori di rete non cancellano mai ciò che l'utente stava scrivendo.

## Variabili d'ambiente
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (la chiave publishable `sb_publishable_…`; le vecchie chiavi `anon`/`service_role` sono deprecate da Supabase entro fine 2026). Nient'altro. Elenco in `.env.example`, valori solo in `.env.local` (ignorato da git) e nelle impostazioni di Vercel.
