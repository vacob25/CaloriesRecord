# Registro delle decisioni (ADR)

Formato: decisione, motivo, alternative scartate, quando rivederla. Prima di cambiare una scelta già presa, leggi qui e dillo all'utente. Aggiungi una voce ogni volta che prendi una decisione tecnica non banale.

## Decise

**ADR-001 · PWA invece di app nativa**
Costo 0 € contro 99 €/anno per l'Apple Developer Program (TestFlight). Uso personale su iPhone. Limiti accettati: niente notifiche affidabili e fotocamera meno fluida. Da rivedere se servono widget o notifiche.

**ADR-002 · Dati online su Supabase, non solo locali**
iOS può cancellare i dati locali dei siti poco usati. Il database online dà backup, accesso da più dispositivi e RLS. Scartato: solo localStorage/IndexedDB.

**ADR-003 · Un solo target giornaliero, nessun recupero**
Scelta dell'utente, coerente con l'obiettivo di massa: recuperare calorie saltate in blocco porta a mangiate forzate. Le statistiche settimanali sono descrittive. Variante: bonus fisso nei giorni di allenamento (gym/calcio/entrambi, un solo bonus).

**ADR-004 · Mifflin-St Jeor come partenza, poi ricalibrazione adattiva**
Mifflin è l'equazione più precisa tra le comuni, ma sbaglia anche di centinaia di kcal sul singolo. Per questo la stima iniziale si corregge con peso e calorie reali, come proposta da confermare. Scartato: formula fissa per sempre; aggiustamento automatico senza conferma.

**ADR-005 · Calcoli in `lib/` con test**
Un errore in una formula sposta il target di giorni di dieta senza che nessuno se ne accorga. Funzioni pure testate con casi calcolati a mano (`TESTING.md`).

**ADR-009 · Accettare la ricalibrazione aggiorna `activity_factor`**
Mantenere un solo parametro (nessun override in kcal) fa sì che il BMR continui a salire col peso. Scartato: campo `maintenance_override_kcal` (resterebbe fermo mentre il peso cresce).

**ADR-010 · Giorni come stringa locale `YYYY-MM-DD`**
Evita errori di giorno a mezzanotte UTC e con l'ora legale. Il fuso è Europe/Rome.

**ADR-011 · Snapshot nelle voci pasto**
Il diario deve restare invariato se un cibo viene corretto o cancellato.

**ADR-012 · Ricette solo con ingredienti semplici in v1**
Una ricetta non può contenere un'altra ricetta (niente cicli, calcolo più semplice).

**ADR-014 · Login con codice OTP via email invece del link magico** — *sospesa l'8/10/2026, sostituita per ora da ADR-028*
Su iOS la PWA installata ha storage separato da Safari (problema noto di WebKit): il link nella mail si apre in Safari e accede lì, non nell'app. Con il codice numerico lo si inserisce direttamente nella PWA. Resta passwordless, quindi rispetta la richiesta dell'utente. Costo: un passaggio in più (copiare il codice). Alternativa se dà problemi: email + password con sessione lunga. Da verificare allo step 3 sull'iPhone vero.

**ADR-015 · Nessun dato personale reale nel repo**
Il repo è pubblico: peso, altezza, data di nascita e obiettivo stanno solo nel database (tabella `profiles`). Test ed esempi usano un profilo fittizio (uomo, 75 kg, 180 cm, 20 anni).

**ADR-018 · Chiave publishable e grant espliciti (verificato sul changelog Supabase)**
Supabase depreca le chiavi `anon` e `service_role` entro fine 2026: si usa la chiave publishable (`sb_publishable_…`) nel frontend, mai la secret. Inoltre le tabelle nuove in `public` non sono esposte alla Data API senza `grant` espliciti (progetti nuovi dal 30 maggio 2026, esistenti dal 30 ottobre 2026): la migrazione li include per `authenticated` e nessuno per `anon`. Variabile d'ambiente: `VITE_SUPABASE_PUBLISHABLE_KEY`.

**ADR-013 · Registrazioni disattivate dopo la creazione dell'utente**
App a utente singolo con repo pubblico: nessuno deve poter creare un account.

## Decise il 7 ottobre 2026 (confermate dall'utente)

**ADR-006 · react-router-dom per la navigazione**
Pro: URL per schermata, tasto indietro, standard. Contro: una dipendenza in più. Alternativa: stato locale con schermate condizionali (più semplice, ma perde indietro/avanti e deep link).

**ADR-007 · TanStack Query per i dati dal server**
Pro: cache, invalidazione, stati di caricamento/errore già gestiti. Contro: una libreria da imparare. Alternativa: `useEffect` + `useState` scritti a mano (più codice, più bug).

**ADR-008 · zod per la validazione**
Pro: un solo schema per form e risposte API, tipi derivati. Contro: dipendenza in più.

## Decise allo step 2 (7 ottobre 2026)

**ADR-016 · oxlint invece di ESLint**
È il linter del template ufficiale di Vite: un solo pacchetto, configurazione minima (`.oxlintrc.json`), regole di React hooks incluse, molto veloce. Scartato: ESLint + typescript-eslint + 2 plugin React (4-5 pacchetti per lo stesso risultato). Da rivedere se serve una regola che esiste solo in ESLint.

**ADR-017 · Font Plus Jakarta Sans servito dall'app (@fontsource)**
Il file del font finisce nel build e nella cache del service worker: la shell si apre con il font giusto anche con rete lenta, e il browser non fa richieste a Google (privacy, `SECURITY.md`). Scartato: link a Google Fonts. Costo: ~60 kB di font nel precache.

**ADR-020 · Tailwind v4 con token in CSS (`@theme`)** (era numerata 018 per errore: il numero 018 è della chiave publishable)
I token di `DESIGN.md` stanno in `src/styles/index.css`. La palette di default di Tailwind è disattivata (`--color-*: initial`): si possono usare solo i colori del design. Non esiste `tailwind.config.js`.

**ADR-019 · Barra di stato iOS `default`**
Con `black-translucent` il testo della barra di stato è bianco e su fondo chiaro (#F4F6F9) sarebbe illeggibile. `default` dà barra chiara con testo scuro e il contenuto parte sotto di essa.

## Decise allo step 3 (8 ottobre 2026)

**ADR-021 · Grant: prima `revoke all`, poi solo i 4 permessi**
La migrazione toglie ogni permesso ad `anon` e `authenticated` e poi concede ad `authenticated` solo select/insert/update/delete. Motivo: nei progetti con i vecchi permessi di default `authenticated` riceveva anche `TRUNCATE`, che svuota una tabella ignorando la RLS (verificato su Postgres locale). Completa ADR-018.

**ADR-022 · Chiavi esterne composte `(id, user_id)` verso `foods`**
`recipe_items` e `meal_entries` puntano a `foods (id, user_id)`, non solo a `foods (id)`. Una chiave esterna normale non passa dalla RLS: B potrebbe collegare una sua voce a un cibo di A conoscendone l'id. Con la chiave composta il cibo deve essere dello stesso utente. Per `meal_entries` si usa `on delete set null (food_id)` (Postgres ≥ 15) per azzerare solo `food_id` e non `user_id`.

**ADR-023 · Sessione: "senza rete" è diverso da "uscito"**
Con il token scaduto e la rete assente supabase-js conserva la sessione ma la comunica come nulla. L'app la legge con `getSession()` e, se l'errore è di rete, mostra "Serve la connessione" invece del login; il rientro è automatico quando torna la rete (al massimo ~60 s: supabase-js tiene in cache un rinnovo fallito per 60 s). Solo un errore vero del server (token revocato) porta al login. Scartato: usare l'evento `INITIAL_SESSION`, che in quel caso fa sembrare l'utente disconnesso.

**ADR-024 · Login in attesa salvato sul telefono** — *sospesa con ADR-014 (vale solo per l'OTP)*
Email e orario dell'invio del codice stanno in `localStorage` per al massimo 1 ora (validità del codice), e si cancellano all'accesso. Motivo: su iOS, passando a Mail per leggere il codice, la PWA può essere ricaricata e si perderebbe il passaggio. Non è un dato importante: se iOS lo cancella si richiede il codice.

**ADR-025 · Email non registrata: stessa risposta di una registrata** — *col login a password vale come "Email o password non corretti" per entrambi i casi*
Con `shouldCreateUser: false` Supabase risponde con un errore se l'email non esiste. L'app lo tratta come un invio riuscito ("Se l'indirizzo è giusto, la mail arriva…"), così dall'esterno non si può scoprire quale email ha un account. Costo: se sbagli a scrivere l'email, il codice semplicemente non arriva.

**ADR-026 · `profiles`: sesso, data di nascita e altezza obbligatori**
`not null` nel database: un profilo esiste solo quando questi tre dati sono stati inseriti (servono al BMR). Nessun limite numerico oltre a `> 0` sull'altezza, finché `DOMAIN_RULES.md` non ne fissa.

**ADR-027 · Schermata dati personali allo step 6, non allo step 3** (scelta dell'utente, 8/10/2026)
I dati (sesso, data di nascita, altezza, peso obiettivo) servono solo ai calcoli del target, che arrivano allo step 6: costruire lì la schermata permette di provarla subito con i numeri veri, con le regole di validazione decise insieme. Fino ad allora la tabella `profiles` resta vuota; nessuna schermata dello step 4-5 la legge.

**ADR-028 · Login con email e password (per ora)** (scelta dell'utente, 8/10/2026)
L'OTP via email dipende da un servizio di invio (SMTP/Resend) che ha dato problemi di configurazione: senza mail non si entra. La password non dipende da nessun servizio esterno. ADR-014 la prevedeva già come alternativa. Come si fa: `signInWithPassword` di supabase-js; campi con `autocomplete="username"` e `"current-password"` per il Portachiavi iCloud (funziona anche nella PWA installata); nessuna regola sulla password al login (le impone Supabase alla creazione). Rischi accettati: la sicurezza dipende dalla password (repo pubblico, URL trovabile) → password lunga e unica, lunghezza minima alzata in Supabase; nessun "password dimenticata" in app (servirebbe l'email): la si reimposta dal pannello di Supabase. L'OTP torna allo step 12 della ROADMAP; il codice dell'OTP è nella storia di git (commit `3a69c12`) e si può riprendere da lì.

## Punti aperti (rispondere prima dello step indicato)
- **Step 12:** login con codice OTP (ADR-014). Decidere se sostituisce la password o si aggiunge; serve prima l'invio email funzionante (Resend con account e mittente corretti, o dominio verificato).
- **Step 11:** icone dell'app provvisorie (anello bianco su verde, generate allo step 2): sostituirle con quelle definitive.
- **Step 3 (in corso):** sessione nella PWA verificata alla chiusura e riapertura (8/10/2026). Da annotare: dopo 1 giorno e dopo 1 settimana.
- **Step 4:** unità "porzione" per i cibi: solo grammi con scorciatoia da `serving_g`, o anche millilitri per i liquidi? (Latte, olio.) Proposta: solo grammi in v1, con densità ignorata e dichiarata.
- **Step 6:** limiti di validazione della schermata dati personali (altezza minima/massima, età minima/massima, peso obiettivo) da decidere con l'utente e scrivere in `DOMAIN_RULES.md` prima del codice.
- **Step 8:** requisiti e limiti attuali di Open Food Facts da verificare nella documentazione ufficiale.
- **Step 10:** valore di `ENERGY_PER_KG` (7700): tenere come costante modificabile e rivalutare dopo qualche mese di dati reali.
