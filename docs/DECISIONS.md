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

## Decise allo step 4 (8 ottobre 2026)

**ADR-029 · Ricette salvate con una funzione SQL (`save_recipe`, migrazione 002)**
Una ricetta è una riga di `foods` più le sue righe di `recipe_items`. supabase-js non fa transazioni: con più chiamate un errore a metà lascerebbe una ricetta senza ingredienti. La funzione fa tutto in una transazione, è `security invoker` (vale la RLS) ed eseguibile solo da `authenticated`. I valori per 100 g li calcola l'app (`lib/nutrition.ts`, testato). Quando si modifica un cibo, l'app ricalcola le ricette che lo usano (una chiamata per ricetta: se una fallisce resta indietro solo quella, e si sistema risalvandola).

**ADR-030 · Errori e avvisi senza arancio**
DESIGN.md riserva l'arancio a carboidrati e "sotto target"; inoltre `--orange-text` (#C4680C) su bianco ha contrasto ~3,9:1, sotto il 4,5:1 richiesto per testi piccoli. Errori e avvisi usano il colore del testo, un'icona ⚠︎ e una parola ("Attenzione"): l'informazione non dipende dal colore.

**ADR-031 · Peso cotto senza tetto dei 5000 g**
Il limite di §9 (≤ 5000 g) vale per grammi di voci pasto e ingredienti. Il peso totale cotto di una ricetta può superarlo (pentola per più giorni): si controlla solo che sia > 0.

**ADR-032 · Ricerca nei propri cibi sul telefono**
Si scaricano tutti i propri cibi (poche centinaia di righe) e si filtra in `lib/search.ts`: ignora accenti e maiuscole ("ragu" trova "ragù"), è istantanea e funziona anche mentre si scrive. `ilike` sul server non ignora gli accenti.

## Decise allo step 5 (8 ottobre 2026) — da confermare con l'uso

**ADR-033 · Pasto proposto in base all'ora**
DESIGN.md dice "default: in base all'ora" senza orari. Fasce scelte (ora di Roma, in `lib/constants.ts`): 5-11 colazione, 11-15 pranzo, 15-18 snack, 18-23 cena, 23-5 snack. È solo il valore iniziale: si cambia con un tocco. Da correggere se non corrisponde alle tue abitudini.

**ADR-034 · Grammi proposti quando registri un cibo**
In ordine: gli ultimi grammi usati per quel cibo, poi la porzione (`serving_g`), poi 100 g. Così un cibo recente si registra in 3 tocchi (+ → cibo → Aggiungi) senza scrivere niente.

**ADR-035 · Modificare i grammi di una voce scala lo snapshot**
Se cambi i grammi di una voce già registrata, kcal e macro si ricalcolano in proporzione dai valori salvati nella voce, non dal cibo (che può essere cambiato o cancellato). Così vale sempre ADR-011.

**ADR-036 · "Aggiunto · Annulla" per 6 secondi**
DESIGN.md dice "per alcuni secondi": 6 s (`UNDO_SECONDS`).

## Decise allo step 6 (8 ottobre 2026, con l'utente)

**ADR-037 · Il peso si chiede già alla prima apertura**
Il target dello step 6 richiede il peso, ma la registrazione del peso è allo step 7. La schermata "dati personali" chiede anche il peso di oggi e lo salva come prima pesata (`weight_logs`). Il peso usato per BMR e macro segue già la regola dello step 7: media mobile 7 giorni se ci sono almeno 4 pesate, altrimenti l'ultima pesata (`lib/weight.ts`, con test).

**ADR-039 · Una modifica del profilo vale già da oggi**
Il target di un giorno si crea alla prima apertura e poi non cambia (DATA_MODEL). Se però cambi un parametro nel Profilo, il target di OGGI si ricalcola subito (mantenendo il tipo di giorno): altrimenti la modifica si vedrebbe solo domani e sembrerebbe non funzionare. I giorni passati non si toccano mai (criterio dello step 6, verificato). Diverso per la ricalibrazione (step 10), che per DOMAIN_RULES §7 vale dal giorno dopo.

**ADR-038 · Limiti dei dati personali**
Altezza 100-250 cm, età 14-100 anni, pesi 30-250 kg (DOMAIN_RULES §10). Proposta accettata dall'utente.

## Decise allo step 7 (8 ottobre 2026)

**ADR-040 · Grafico del peso**
Un solo asse; punti blu = pesate grezze (con anello bianco di 2 px), linea blu di 2 px = media mobile 7 giorni, tratteggio blu = traguardo (blu = peso e traguardo, DESIGN.md; contrasto verificato con lo script della skill dataviz). Testi e assi nei colori del testo, mai nel colore della serie. Alternativa testuale ("Media in salita di 0,6 kg in 3 settimane") e l'elenco delle pesate come vista a tabella. La pill del peso è in `components/` perché la usano Oggi e Peso.

## Decise allo step 8 (8 ottobre 2026)

**ADR-041 · Open Food Facts: endpoint, versione e limiti** (verificati sulla documentazione ufficiale l'8/10/2026: `docs/api/index.md`, `ref-api-and-product-schema-change-log.md` e gli schemi `docs/api/ref/` del repository openfoodfacts/openfoodfacts-server; `app/api.py` e `app/_types.py` di openfoodfacts/search-a-licious)
- Barcode: `GET https://world.openfoodfacts.org/api/v3.4/product/{codice}` con `fields=code,product_name,product_name_it,brands,nutriments,serving_quantity,serving_quantity_unit`. Si chiede **v3.4** apposta: la v3.5 ha una nuova struttura dei nutrienti "ancora in sviluppo attivo"; chiedendo una versione precedente il server restituisce la struttura vecchia e stabile (`nutriments.energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`). Non trovato = HTTP 404 o `status: "failure"`.
- Ricerca per nome: la ricerca testuale non è nell'API v2/v3 del server; si usa Search-a-licious, `POST https://search.openfoodfacts.org/search` (`q`, `langs`, `page_size`, `fields`; risposta `hits`). Solo con il pulsante "Cerca su Open Food Facts", mai mentre si scrive.
- Limiti: 15 letture prodotto e 10 ricerche al minuto per IP (per utente se le richieste partono dal telefono). L'app li conta (in `sessionStorage`) e si ferma prima, con un messaggio: superarli può portare al ban dell'IP.
- Identificazione: la documentazione chiede uno User-Agent `NomeApp/Versione (email)`, ma **un browser non permette di impostarlo**. Si manda `app_name=CaloriesRecord` (parametro che OFF usa per identificare le app). Vedi punto aperto.
- Dati non fidati: ogni risposta passa da zod (`lib/openFoodFacts.ts`, testato con una fixture inventata) e dalla validazione §9. Campi mancanti o valori impossibili → modulo "Nuovo cibo" precompilato con i campi mancanti VUOTI e una nota: mai zeri silenziosi. Porzione usata solo se in grammi.
- Alla prima scelta il prodotto si salva tra i propri cibi (fonte `open_food_facts`); un codice già tra i propri cibi non chiama OFF (funziona anche senza rete). Nessun dato personale inviato.

**ADR-042 · Scanner: fotocamera da un tocco, codice scritto come riserva**
La fotocamera parte dal pulsante "Avvia fotocamera" (iOS richiede un gesto). Formati EAN-13, EAN-8, UPC-A, UPC-E. Pulsante torcia solo se il dispositivo la espone al browser (su iPhone Safari potrebbe non esserci): per questo con poca luce c'è sempre "Oppure scrivi il codice". Permesso negato → spiegazione su come riattivarlo + codice a mano + ricerca per nome. Verificato in Chromium con una fotocamera finta che mostra un vero EAN-13: zxing lo legge.

## Decise allo step 9 (8 ottobre 2026)

**ADR-043 · Statistiche: colori e definizioni**
Barre delle calorie: verde = rispettato, arancio = sotto target (DESIGN.md); "oltre il target" in grigio, perché il design non gli dà un colore e in un bulk non è un allarme. L'arancio su bianco ha contrasto 2,6:1 (script della skill dataviz): per questo c'è sempre la tabella dei giorni con lo stato scritto. Un giorno registrato ma senza target (non si è aperta l'app quel giorno) conta nella media ma non nel rapporto "rispettati". Peso del periodo = variazione della media mobile tra il primo e l'ultimo giorno, in kg/settimana (§8); "—" se manca una delle due medie. Non si naviga oltre il periodo attuale.

## Decise allo step 10 (8 ottobre 2026) — da confermare

**ADR-044 · Finestra della ricalibrazione tagliata all'inizio dell'uso** (interpretazione di §7, da confermare)
§7 chiede "28 giorni conclusi, con almeno 21 giorni dall'inizio dell'uso" e "almeno 80% dei giorni registrati". Se l'80% fosse sempre su 28 giorni, con 21 giorni d'uso si arriverebbe al massimo al 75% e la soglia dei 21 giorni non servirebbe. Scelta: la finestra è degli ultimi 28 giorni conclusi ma comincia non prima del primo giorno d'uso (prima voce o prima pesata); servono ≥ 21 giorni nella finestra, l'80% di quei giorni registrati (≥ 50% del target) e ≥ 10 pesate. La pendenza si arrotonda a 3 decimali (come la colonna) prima del confronto con la banda, così 0,20 e 0,40 sono dentro.

**ADR-045 · Una valutazione a settimana, alla prima apertura**
Alla prima apertura di una settimana (lun-dom, Roma) si salva una riga in `tdee_estimates`: `pending` se c'è una proposta, `none` se si è in banda o mancano dati. Le aperture successive della stessa settimana rileggono quella riga: al massimo una proposta a settimana. Se a inizio settimana mancano dati, si riprova la settimana dopo. Accettare cambia solo `activity_factor` (vale da domani, il target di oggi resta); rifiutare cambia solo lo stato della riga. L'unicità per settimana è garantita dall'app, non da un vincolo nel database (basterebbe una migrazione con `unique (user_id, week_start)` se servisse).

## Decise allo step 11 (8 ottobre 2026)

**ADR-046 · Rifinitura tecnica**
- Accessibilità verificata con axe-core (regole WCAG 2.1 A/AA) su tutte le 12 schermate: 0 violazioni; tutte le aree toccabili ≥ 44 px (misurate). Corretti: elenco di "Aggiungi pasto" che perdeva la semantica di lista, link troppo piccolo in Peso.
- Pannelli inferiori (`components/SheetFrame.tsx`): X "Chiudi" visibile da 44 px, Esc, tocco sullo sfondo; lo sfondo è nascosto agli screen reader.
- Banner "Serve la connessione" in tutte le schermate quando il telefono è offline (DESIGN.md, Stati comuni).
- Prestazioni: separate solo le schermate pesanti (Peso/Statistiche con Recharts, scanner con zxing). Provato a separare anche Cibi/Profilo/Benvenuto: risparmio 4 kB, non vale l'attesa in più → annullato.

## Decise l'8/10/2026 con l'utente (step 13-16)

**ADR-047 · Peso: pesata libera + promemoria dopo 5 giorni**
L'utente voleva "registrare il peso ogni 5 giorni". Con una pesata ogni 5 giorni media mobile (≥ 4 in 7 giorni), pendenza e ricalibrazione (≥ 10 in 28 giorni) non sarebbero mai disponibili. Scelta dell'utente: le regole restano, la voce Peso diventa più visibile e compare un promemoria se non ci si pesa da 5 giorni, con un riepilogo degli ultimi 5 giorni.

**ADR-048 · Porzioni casalinghe e liquidi in ml**
Ogni cibo ha `unit` (g o ml) e `portions` (lista di nome + quantità). Per i liquidi i valori sono per 100 ml, come sulle etichette: non serve nessuna densità. Nelle ricette un ingrediente in ml conta come grammi per il peso totale (approssimazione dichiarata, densità ≈ 1). Supera la proposta "solo grammi" del punto aperto dello step 4.

**ADR-049 · Acqua: contenitori e obiettivo scelto dall'utente**
Contenitori rapidi predefiniti: bicchiere 200 ml, bottiglietta 500 ml, bottiglia 1,5 L (formati comuni in Italia), più contenitori personalizzati salvati nel database. Obiettivo giornaliero solo se lo imposta l'utente: nessun valore inventato. Si scrive in litri; l'unico limite è 10 L, contro gli errori di battitura (non è un consiglio). Una singola aggiunta e un contenitore vanno da 1 a 5000 ml, come il vincolo del database. L'acqua ha una tabella sua (`water_entries`) e non entra nel diario dei pasti.

**ADR-050 · Catalogo di ingredienti da una fonte verificabile**
Da questo ambiente le banche dati ufficiali (CREA, USDA, IEO) non sono raggiungibili e i valori non si scrivono a memoria. Il catalogo si produce in un'altra chat con ricerca web (testo in `docs/prompts/catalogo-ingredienti.md`), con la fonte per ogni voce; qui si valida con zod e le regole §9 prima di importarlo. È un file JSON statico nell'app (dati pubblici): niente tabella condivisa nel database, così la RLS per utente resta semplice; la voce scelta si copia tra i propri cibi. Dettagli (step 16): il file è `src/data/catalog/ingredienti.json`, caricato solo all'apertura della scheda Catalogo o durante una ricerca; le voci che non passano zod o §9 si scartano (e il test `ingredienti.test.ts` fallisce, così non arrivano in produzione); kcal incoerenti oltre il 20% sono ammesse solo con una nota che le spiega. La copia ha `source = manual` (nessuna migrazione per un nuovo valore) ed è riconosciuta per nome + unità: sceglierla di nuovo usa il cibo già salvato.

## Revisione dell'8/10/2026

**ADR-051 · Quantità arrotondate prima della validazione**
Grammi/ml, porzioni, obiettivo acqua e peso cotto si arrotondano come li salva il database e poi si controllano: un valore che diventerebbe 0 (es. 0,04 g) è rifiutato nel modulo, non dal database. Il peso cotto ha come massimo `COOKED_WEIGHT_MAX_G`, il limite tecnico di `numeric(8,1)`, non un limite di dominio (ADR-031 resta valida).

**ADR-052 · Mantenimento intero prima del target**
Il mantenimento si arrotonda all'intero prima di calcolare il target, perché `daily_targets.maintenance_kcal` è `int` e il target di un giorno deve potersi ricalcolare dal mantenimento salvato (cambio del tipo di giorno). DOMAIN_RULES §2 aggiornato. Effetto al massimo di 10 kcal sul target; il profilo di esempio non cambia (2848 → 3130/3330).

**ADR-053 · Avviso sul ritmo stimato (§2)**
Implementato l'avviso "ritmo stimato > `GAIN_RATE_WARNING_KG_WEEK`": ritmo = mantenimento di oggi riscalato sul nuovo fattore di attività × `surplus_pct` × 7 / `ENERGY_PER_KG` (surplus dei giorni di riposo, bonus escluso). Si mostra al salvataggio dei parametri nel Profilo; è un avviso, non un blocco.

**ADR-054 · Quantità proposta con le porzioni (estende ADR-034)**
Ordine: ultima quantità usata → `serving_g` → prima porzione casalinga (1×, già selezionata) → 100 g.

**ADR-055 · Open Food Facts: liquidi in ml**
Un prodotto con `serving_quantity_unit` = `ml` si salva con unità `ml` (per i liquidi i valori `_100g` di OFF sono per 100 ml, come dice la documentazione OFF), con la porzione in ml; altrimenti in grammi. Supera la nota "porzione usata solo se in grammi" di ADR-041.

**ADR-056 · Catalogo: copie e scelta della scheda**
Una voce già copiata si riconosce per nome (senza distinguere maiuscole: `ilike` con i caratteri jolly neutralizzati) + unità. Il catalogo si usa anche nella scelta degli ingredienti di una ricetta. La scheda Catalogo è aperta all'inizio quando l'utente non ha ancora cibi propri.

**ADR-057 · Statistiche: peso di un periodo non finito**
Per la settimana o il mese in corso la variazione del peso si misura fino a oggi, non fino alla fine del periodo (che non ha ancora dati).

**ADR-058 · Ritmo voluto e banda della ricalibrazione sono due cose diverse**
`TARGET_RATE_MIN/MAX_KG_WEEK` (+0,20/+0,35, l'obiettivo di CLAUDE.md) è il ritmo voluto del bulk; `RECAL_BAND_MIN/MAX` (+0,20/+0,40, §7) è la tolleranza entro cui la ricalibrazione non propone niente. Sono corretti entrambi; i testi dell'app si generano dalle costanti, mai scritti a mano.

## Step 17 (8/10/2026, richieste dell'utente)

**ADR-059 · Promemoria del peso ogni giorno**
Supera la soglia dei 5 giorni di ADR-047: il promemoria compare in cima a Oggi finché il peso di oggi non è registrato (`WEIGHT_DAILY_REMINDER_DAYS` = 1). Il riepilogo "Ultimi 5 giorni" in Peso resta (`WEIGHT_REMINDER_DAYS`). Non compare se la card del target sta già chiedendo il peso.

**ADR-060 · Cinque pasti: Snack di metà mattina e Spuntino**
Nuovo `meal_type` `morning_snack` ("Snack", tra colazione e pranzo); `snack` resta nel database e nell'app si chiama "Spuntino" (le voci già registrate non cambiano). Migrazione 004. Fasce orarie proposte (ADR-033, da confermare con l'uso): 5-10 colazione, 10-12 snack, 12-15 pranzo, 15-18 spuntino, 18-23 cena, 23-5 spuntino.

**ADR-061 · Acqua: contatori per contenitore**
Ogni aggiunta salva il contenitore da cui viene (`water_entries.container`, migrazione 004): così il conteggio "− N +" è esatto e 200 ml scritti a mano non diventano un bicchiere. Il "−" toglie l'ultima aggiunta di quel contenitore e sostituisce "Ultima aggiunta · Annulla". Salvare un nuovo contenitore non aggiunge acqua.

**ADR-062 · Cibi: Preferiti e Alimenti recenti**
In Cibi restano in alto Nuovo cibo e Nuova ricetta; poi "Preferiti" (stella, matita per modificare) e "Alimenti recenti" (`RECENT_FOODS_LIMIT` = 8, lo stesso limite della scheda Recenti in Aggiungi pasto). Gli altri cibi si trovano con la ricerca o con "Tutti i tuoi cibi": senza, un cibo né preferito né recente non si potrebbe più modificare.

**ADR-063 · Catalogo a riquadri con stelle**
Le 12 categorie sono riquadri con un'icona a linea; dentro una categoria ogni voce ha la stella e i preferiti stanno in cima. La stella su una voce non ancora copiata la copia tra i propri cibi già preferita: un solo concetto di "preferito" per tutta l'app.

## Punti aperti (rispondere prima dello step indicato)
- **Open Food Facts (quando vuoi):** per identificarsi come chiede OFF servirebbe uno User-Agent, impossibile dal browser. Opzioni: (a) restare con `app_name` (attuale, va bene per un uso personale con poche richieste); (b) una piccola funzione su Vercel che fa da proxy e imposta lo User-Agent (aggiunge un backend, oggi escluso da ARCHITECTURE). OFF suggerisce anche di compilare il loro modulo "API usage" per non rischiare blocchi.
- **Step 12:** login con codice OTP (ADR-014). Decidere se sostituisce la password o si aggiunge; serve prima l'invio email funzionante (Resend con account e mittente corretti, o dominio verificato).
- **Prestazioni (facoltativo):** pacchetto principale ~745 kB (~216 kB compressi). Misurato: react-dom 204 kB, supabase-js ~200 kB (di cui ~77 kB realtime/storage non usati), codice dell'app 95 kB, react-router 90 kB, zod 81 kB. Tagli possibili: `zod/mini` (stesso pacchetto, riscrivere gli schemi, −60/70 kB) o usare `@supabase/auth-js` + `@supabase/postgrest-js` al posto di supabase-js (−77 kB, ma cambia una dipendenza decisa). Il service worker mette tutto in cache dopo la prima apertura: decidere solo se l'avvio sull'iPhone risulta lento.
- **Step 11 (tuo):** icone dell'app provvisorie (anello bianco su verde, generate allo step 2) e nessuna schermata di avvio iOS dedicata: decidere icona e schermata definitive.
- **Step 11 (tuo):** 2 settimane di uso reale con l'elenco dei problemi (criterio di accettazione).
- **Step 3 (fatto), sessione:** nella PWA verificata alla chiusura e riapertura (8/10/2026). Da annotare: se resta collegata dopo 1 giorno e dopo 1 settimana.
- **Step 10:** valore di `ENERGY_PER_KG` (7700): tenere come costante modificabile e rivalutare dopo qualche mese di dati reali.
- **Precisione della modifica di una voce:** lo snapshot è salvato a 1 decimale (`numeric(7,1)`); correggere una voce registrata con pochissimi grammi (es. 1 g → 100 g) amplifica l'arrotondamento. Soluzione possibile: salvare anche i valori per 100 nello snapshot (nuova migrazione). Da decidere.
- **Una ricalibrazione per settimana:** è garantita dall'app, non dal database (manca un indice unico su `(user_id, week_start)`); con due dispositivi aperti insieme potrebbero nascere due righe. Possibile migrazione futura.
- **Avviso "valori incoerenti" su alimenti quasi a zero calorie (acqua, caffè):** §9 applicato alla lettera dà sempre l'avviso. Da decidere se ignorare il controllo sotto una soglia.
