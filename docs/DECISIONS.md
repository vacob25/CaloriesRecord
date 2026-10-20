# Registro delle decisioni (ADR)

Formato: decisione, motivo, alternative scartate, quando rivederla. Prima di cambiare una scelta già presa, leggi qui e dillo all'utente. Aggiungi una voce ogni volta che prendi una decisione tecnica non banale.

## Decise

**ADR-001 · PWA invece di app nativa**
Costo 0 € contro 99 €/anno per l'Apple Developer Program (TestFlight). Uso personale su iPhone. Limiti accettati: niente notifiche affidabili e fotocamera meno fluida. Da rivedere se servono widget o notifiche.

**ADR-002 · Dati online su Supabase, non solo locali**
iOS può cancellare i dati locali dei siti poco usati. Il database online dà backup, accesso da più dispositivi e RLS. Scartato: solo localStorage/IndexedDB.

**ADR-003 · Un solo target giornaliero, nessun recupero** — *la variante del bonus fisso è sostituita dalle calorie per sport (ADR-075)*
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

**ADR-014 · Login con codice OTP via email invece del link magico** — *sostituita: login con password (ADR-028), definitivo con ADR-064*
Su iOS la PWA installata ha storage separato da Safari (problema noto di WebKit): il link nella mail si apre in Safari e accede lì, non nell'app. Con il codice numerico lo si inserisce direttamente nella PWA. Resta passwordless, quindi rispetta la richiesta dell'utente. Costo: un passaggio in più (copiare il codice). Alternativa se dà problemi: email + password con sessione lunga. Da verificare allo step 3 sull'iPhone vero.

**ADR-015 · Nessun dato personale reale nel repo**
Il repo è pubblico: peso, altezza, data di nascita e obiettivo stanno solo nel database (tabella `profiles`). Test ed esempi usano un profilo fittizio (uomo, 75 kg, 180 cm, 20 anni).

**ADR-018 · Chiave publishable e grant espliciti (verificato sul changelog Supabase)**
Supabase depreca le chiavi `anon` e `service_role` entro fine 2026: si usa la chiave publishable (`sb_publishable_…`) nel frontend, mai la secret. Inoltre le tabelle nuove in `public` non sono esposte alla Data API senza `grant` espliciti (progetti nuovi dal 30 maggio 2026, esistenti dal 30 ottobre 2026): la migrazione li include per `authenticated` e nessuno per `anon`. Variabile d'ambiente: `VITE_SUPABASE_PUBLISHABLE_KEY`.

**ADR-013 · Registrazioni disattivate dopo la creazione dell'utente** — *sostituita il 9/10/2026 da ADR-064 (registrazione su invito)*
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

**ADR-024 · Login in attesa salvato sul telefono** — *decaduta con ADR-064 (valeva solo per il codice OTP, che non c'è più)*
Email e orario dell'invio del codice stanno in `localStorage` per al massimo 1 ora (validità del codice), e si cancellano all'accesso. Motivo: su iOS, passando a Mail per leggere il codice, la PWA può essere ricaricata e si perderebbe il passaggio. Non è un dato importante: se iOS lo cancella si richiede il codice.

**ADR-025 · Email non registrata: stessa risposta di una registrata** — *col login a password vale come "Email o password non corretti" per entrambi i casi*
Con `shouldCreateUser: false` Supabase risponde con un errore se l'email non esiste. L'app lo tratta come un invio riuscito ("Se l'indirizzo è giusto, la mail arriva…"), così dall'esterno non si può scoprire quale email ha un account. Costo: se sbagli a scrivere l'email, il codice semplicemente non arriva.

**ADR-026 · `profiles`: sesso, data di nascita e altezza obbligatori**
`not null` nel database: un profilo esiste solo quando questi tre dati sono stati inseriti (servono al BMR). Nessun limite numerico oltre a `> 0` sull'altezza, finché `DOMAIN_RULES.md` non ne fissa.

**ADR-027 · Schermata dati personali allo step 6, non allo step 3** (scelta dell'utente, 8/10/2026)
I dati (sesso, data di nascita, altezza, peso obiettivo) servono solo ai calcoli del target, che arrivano allo step 6: costruire lì la schermata permette di provarla subito con i numeri veri, con le regole di validazione decise insieme. Fino ad allora la tabella `profiles` resta vuota; nessuna schermata dello step 4-5 la legge.

**ADR-028 · Login con email e password** (scelta dell'utente, 8/10/2026) — *definitivo con ADR-064*
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

**ADR-033 · Pasto proposto in base all'ora** — *le fasce sono cambiate con i cinque pasti (ADR-060) e i pasti sono personalizzabili (ADR-071)*
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

**ADR-047 · Peso: pesata libera + promemoria dopo 5 giorni** — *il promemoria dei 5 giorni è sostituito da quello giornaliero (ADR-059); resta il riepilogo*
L'utente voleva "registrare il peso ogni 5 giorni". Con una pesata ogni 5 giorni media mobile (≥ 4 in 7 giorni), pendenza e ricalibrazione (≥ 10 in 28 giorni) non sarebbero mai disponibili. Scelta dell'utente: le regole restano, la voce Peso diventa più visibile e compare un promemoria se non ci si pesa da 5 giorni, con un riepilogo degli ultimi 5 giorni.

**ADR-048 · Porzioni casalinghe e liquidi in ml**
Ogni cibo ha `unit` (g o ml) e `portions` (lista di nome + quantità). Per i liquidi i valori sono per 100 ml, come sulle etichette: non serve nessuna densità. Nelle ricette un ingrediente in ml conta come grammi per il peso totale (approssimazione dichiarata, densità ≈ 1). Supera la proposta "solo grammi" del punto aperto dello step 4.

**ADR-049 · Acqua: contenitori e obiettivo scelto dall'utente**
Contenitori rapidi predefiniti: bicchiere 200 ml, bottiglietta 500 ml, bottiglia 1,5 L (formati comuni in Italia), più contenitori personalizzati salvati nel database. Obiettivo giornaliero solo se lo imposta l'utente: nessun valore inventato. Si scrive in litri; l'unico limite è 10 L, contro gli errori di battitura (non è un consiglio). Una singola aggiunta e un contenitore vanno da 1 a 5000 ml, come il vincolo del database. L'acqua ha una tabella sua (`water_entries`) e non entra nel diario dei pasti.

**ADR-050 · Catalogo di ingredienti da una fonte verificabile** — *esteso dai piatti comuni calcolati dagli ingredienti (ADR-072)*
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

## Step 18 (9/10/2026, scelte dell'utente)

**ADR-064 · Tester invitati: registrazione con email e password, senza email dall'app**
Sostituisce ADR-013 (registrazioni chiuse) e ADR-014 (codice OTP): il login resta email + password (ADR-028) e diventa definitivo; lo step 12 (OTP) non serve più. Registrazione aperta solo alle email in `public.allowed_emails` (migrazione 005), controllate da Supabase con l'auth hook ufficiale "Before User Created" (funzione Postgres `hook_before_user_created`, inclusa nel piano gratuito). Preferita a un trigger su `auth.users`: è fatta per questo, gira con il ruolo minimo `supabase_auth_admin` e il suo messaggio arriva all'app (un trigger darebbe un generico "Database error saving new user").
Email (scelta B dell'utente): nessun dominio, quindi nessun invio possibile ai tester (l'email integrata di Supabase invia solo ai membri del progetto, Resend senza dominio verificato solo al proprietario dell'account). "Confirm email" spento: l'elenco degli invitati sostituisce la verifica dell'email. Rischio dichiarato: chi conosce l'email di un invitato potrebbe registrarsi prima di lui; si mitiga invitando solo quando la persona è pronta. Password dimenticata: la reimposta l'amministratore dal pannello. Se in futuro si compra un dominio, conferma e recupero con codice (verifyOtp type `email` / `recovery`).
Password: da 8 caratteri a 72 byte (limite di bcrypt), stessa minima impostata in Supabase.

**ADR-065 · Consenso, privacy, esportazione ed eliminazione**
Consenso esplicito alla registrazione (casella obbligatoria che nomina i dati sulla salute, art. 9 GDPR): versione dell'informativa, data e `health_data_consent` nei metadati dell'utente (soluzione base, senza tabella di storico). Pagina pubblica `/privacy` (testo di base da far rivedere); contatto da `VITE_PRIVACY_CONTACT` su Vercel, mai nel repo. Esporta: JSON di tutte le tabelle dell'utente (la RLS filtra), condiviso con `navigator.share` e, se non disponibile, testo da copiare; un test confronta l'elenco con le tabelle delle migrazioni. Elimina: funzione `delete_my_account()` (security definer, search_path vuoto, solo `auth.uid()`, execute solo ad authenticated), conferma scrivendo ELIMINA, poi uscita e pulizia di cache e storage. Nessuna service_role, nessuna Edge Function.

## Step 19 (9/10/2026, richieste dell'utente)

**ADR-066 · Obiettivi: massa, mantenimento, definizione (cut)**
`profiles.goal` ∈ bulk / maintain / cut. Massa = +`surplus_pct` (come prima); mantenimento = 0; cut = deficit in kcal/giorno `peso · ritmo% · 7700 / 7`, ricalcolato ogni giorno col peso di quel giorno. Il ritmo è in **% del peso a settimana**, non in kcal fisse: un deficit fisso pesa troppo su chi è leggero. Tre ritmi: Graduale 0,5% (predefinito), Medio 0,7%, Deciso 1,0%; oltre l'1% si avvisa (rischio di perdere muscolo). Fonti: Helms et al. 2014 (J Int Soc Sports Nutr), posizione ISSN su diete e composizione corporea 2017, Garthe et al. 2011 (perdita lenta 0,7% vs veloce 1,4% a settimana: più massa magra conservata col ritmo lento). **Numeri da confermare con l'utente.**
Ricalibrazione con bande in kg/settimana per obiettivo: massa +0,20/+0,40; mantenimento ±0,10; cut da −1,0% a −0,5% del peso (3 decimali). Il cut richiede un peso obiettivo sotto il peso attuale; durata stimata `ceil(ln(obiettivo/peso) / ln(1 − ritmo))` settimane. Avvisi non bloccanti: ritmo di massa > 0,5 kg/sett., cut > 1%, target di riposo sotto il BMR, cut sotto i 18 anni (nota di rivolgersi a un medico: l'app non lo vieta, scelta dell'utente). Limite dichiarato: 7700 kcal/kg è ottimistico in definizione; la ricalibrazione dopo 3 settimane corregge. Non fatta la "fase di osservazione" (registrare 2-3 settimane prima di fissare il deficit): possibile seguito.

**ADR-067 · Livello di attività alla registrazione** — *il bonus unico di +200 kcal è sostituito dalle calorie per sport (ADR-075)*
Il vecchio 1,60 rifletteva le abitudini del titolare. Chi si registra sceglie tra Poco attivo 1,2 · Leggero 1,375 · Medio 1,55 · Alto 1,725 (moltiplicatori standard); è l'errore più grande della stima (10-15%), ma la ricalibrazione lo corregge. Il bonus allenamento resta uno solo (+200) anche con due sport.

**ADR-068 · Sport liberi e tipi di giorno derivati** — *corretta da ADR-077 (la 006 aveva assegnato Palestra e Calcio a tutti i profili, non solo al titolare); il limite di 2 sport e i tipi di giorno `gym`/`football`/`both` sono sostituiti da ADR-073*
`profiles.sports` (jsonb, 0-2 nomi, max 24 caratteri). I tipi di giorno non sono più `gym`/`football`: `rest`, `sport_1`, `sport_2`, `both` (etichette dagli sport: "Palestra + calcio"). La migrazione 006 converte `gym→sport_1`, `football→sport_2` e imposta gli sport del titolare a Palestra e Calcio, così i suoi dati e target restano identici. Se uno sport viene tolto, il giorno che lo usava torna a Riposo al prossimo ricalcolo. "Palestra" è proposto come consigliato.

**ADR-069 · Tutorial a popup**
8 passi (anello, peso, pasti, acqua, aggiungi, cibi, statistiche, profilo) in un popup sopra la barra in basso: evidenzia l'elemento vero (`data-tour`) e cambia schermata da solo con "Avanti". Parte una volta quando `profiles.tutorial_done_at` è vuoto; "Salta" e "Fine" lo valorizzano (salvato nel database, non nel browser: vale su ogni dispositivo); "Rivedi il tutorial" nel Profilo.

## Step 20 (11/10/2026, richieste dell'utente)

**ADR-070 · Giorni passati: stessa schermata con `?data=`**
Oggi mostra il giorno scelto con le frecce ‹ › e il parametro `?data=YYYY-MM-DD`, non una schermata nuova: bersaglio, pesata, acqua e pasti riusano gli stessi componenti. Limite di 14 giorni indietro (`BACKFILL_MAX_DAYS`, da confermare con l'uso) e mai nel futuro; un parametro non valido riporta a oggi senza errori. Chi apre un giorno passato senza target ne crea uno con i parametri di adesso e il peso di quel giorno (o l'ultimo prima): è la stessa regola di oggi e non tocca i giorni che hanno già il loro target. La ricalibrazione e il promemoria del peso restano su oggi. Swipe orizzontale (hook `useDaySwipe`): il contenuto segue il dito, oltre 60 px (e con l'orizzontale almeno 1,5 volte il verticale) cambia giorno con un'animazione d'ingresso (Web Animations, disattivata con "riduci movimento"); si trasforma solo il contenitore, non i pannelli `fixed`; i gesti che partono entro 24 px dal bordo sinistro sono lasciati a iOS.

**ADR-071 · Pasti su misura: tabella `meal_slots` e chiave esterna**
Ogni utente ha i propri pasti (max 8, nome ≤ 20 caratteri, unico senza distinguere maiuscole). Chiave stabile `slot_key` + nome modificabile: rinominare non tocca il diario. `meal_entries.meal_type` punta ai pasti con una chiave esterna (non più un elenco fisso): preferita a un testo libero perché impedisce voci "orfane". Eliminare un pasto con voci è rifiutato dal database (NO ACTION, non RESTRICT, perché con RESTRICT la cancellazione dell'account fallirebbe); l'app lo spiega e propone di rinominare. Almeno un pasto resta sempre. Riordino per trascinamento senza librerie (eventi pointer): tenendo premuto 350 ms su una riga, o subito dalle due linee a destra, la riga si solleva (scala 1,03 e ombra), segue il dito e le altre si fanno da parte; un movimento prima dei 350 ms è uno scorrimento dell'elenco. Alternativa senza trascinare per tastiera e VoiceOver: frecce su/giù sulle due linee (al posto dei vecchi pulsanti su/giù, per non allargare le righe). Il pasto proposto per ora del giorno usa le fasce di prima; se il pasto della fascia non esiste più, quello precedente che esiste. Nessuna service_role: tutto con RLS per utente e un trigger che gira con i permessi di chi crea il profilo.

**ADR-072 · Piatti comuni nel catalogo, calcolati dagli ingredienti**
Modifica di ADR-050 (che escludeva i piatti composti) su richiesta dell'utente. Regola di ADR-050 mantenuta: i valori non si scrivono a memoria. Ogni piatto è CALCOLATO dalla ricetta (grammi per una porzione, valori per 100 g degli ingredienti già nel catalogo, quindi CREA) con l'acqua assorbita o persa in cottura dichiarata; la ricetta è scritta nella fonte e la voce porta "STIMA". Sono stime di ricette tradizionali, non misure: pizza, ravioli o cordon bleu veri variano molto (ragù con carne magra; olio assorbito nei fritti stimato; pangrattato sostituito da pane bianco). Il file `piatti.json` è validato come il resto (zod, §9, id e nomi unici insieme agli ingredienti) e un test ricalcola un piatto dagli ingredienti. Alla scelta il piatto diventa un proprio cibo, modificabile.

## Step 21 (12/10/2026, richieste dell'utente)

**ADR-073 · Fino a 4 sport; il giorno è un insieme di sport** — *il bonus di +200 per giorno è sostituito dalle calorie per sport (ADR-075)*
Sostituisce il limite di 2 sport (ADR-068). `daily_targets.training_type` non è più un elenco fisso (`rest`/`sport_1`/`sport_2`/`both`) ma `rest` oppure gli sport del giorno come `sport_1`, `sport_1+sport_3` (numeri in ordine = posizione nell'elenco del profilo). Con 4 sport le combinazioni sarebbero 15: non si elencano, nascono dai tocchi (Palestra, poi Nuoto → "Palestra + nuoto"; un secondo tocco toglie lo sport). Vincolo del database: `rest` o `sport_1…4` uniti da `+`. Il bonus allenamento resta uno solo (+200) per qualunque numero di sport (decisione di ADR-067, da riconsiderare se chi fa due sport nello stesso giorno risulta sotto-alimentato). Come prima, gli indici seguono l'ordine degli sport: togliere o riordinare gli sport cambia ciò che i vecchi giorni indicano (limite già accettato); al ricalcolo gli indici che non esistono più si tolgono. Il vecchio `both` è migrato a `sport_1+sport_2` e l'app lo legge ancora come i primi due sport.

**ADR-074 · Trascinare le voci tra i pasti (home)**
Stesso gesto del riordino dei pasti (ADR-071), senza librerie: pressione di ~350 ms su una voce, che si solleva (scala 1,03, ombra) e segue il dito; il pasto sotto il dito si evidenzia (anello verde, riquadro tratteggiato colorato); al rilascio su un altro pasto la voce ci passa (aggiorna solo `meal_type`, grammi e calorie invariati), altrove torna al suo posto. Vicino ai bordi dello schermo la pagina scorre da sola. Il tocco veloce apre ancora la modifica (il puntatore si cattura solo quando parte il trascinamento, altrimenti il click non arriva al pulsante), un movimento prima del tempo è scorrimento o swipe tra i giorni, e mentre si trascina lo swipe tra i giorni è sospeso. Alternativa senza trascinare per tastiera e VoiceOver: nella modifica della voce il selettore del pasto già esistente.

## Step 22 (12/10/2026, richiesta dell'utente)

**ADR-075 · Calorie per sport dal Compendium; più sport si sommano**
Sostituisce il bonus unico di 200 kcal (ADR-067). Per tennis, corsa, calcio e palestra: `kcal = (MET − 1) · peso · ore` (si toglie 1 MET di riposo, già nel mantenimento), con il peso del giorno. MET dal Compendium of Physical Activities (Ainsworth 2011; aggiornamento adulti 2024, Herrmann et al.): tennis singolo **8,0**; calcio amatoriale **7,0** (agonistico 10,0); corsa a 6 mph (~10 km/h) **9,8** (nel 2024 le tabelle danno 9,3-10,0 secondo la colonna); pesi con sforzo intenso **6,0**. **Limite di verifica:** da questo ambiente le tabelle ufficiali (pacompendium.com) non erano raggiungibili; i valori sono confermati da più fonti secondarie che citano il Compendium (tabelle sportive, una revisione su PMC per il calcio, riepiloghi dell'edizione 2011), non letti dalla tabella ufficiale. Non verificati e quindi non usati: nuoto, ciclismo, basket, pallavolo, pesi a sforzo leggero (3,5). Le **durate** (tennis 60, corsa 45, calcio 60, palestra 45 min effettivi) sono ipotesi mie di "allenamento medio", non della fonte: da confermare. Esempio a 75 kg: 525, 495, 450, 281 kcal. Più sport nello stesso giorno **si sommano** (richiesta dell'utente); gli sport fuori tabella valgono il bonus di riserva del profilo (`training_bonus_kcal`, rinominato "Bonus per gli altri sport", default 200) e si sommano anch'essi. Rischio dichiarato: il livello di attività già include gli allenamenti, quindi il target nei giorni di allenamento può risultare alto (doppio conteggio); la ricalibrazione corregge, e un livello di attività più basso corregge alla radice. I valori di riferimento restano in `lib/sportEnergy.ts`, un solo posto da cambiare.

## Step 23 (12/10/2026, richiesta dell'utente)

**ADR-076 · Campi numerici: tastiera numerica e pulizia centralizzata; obiettivo acqua in un pop-up**
Ogni campo che chiede un numero ha `inputMode="decimal"` (cifre e virgola) o `"numeric"` (solo cifre: ml, codice a barre). La tastiera numerica da sola non basta (si può incollare, e su tastiere esterne si scrive tutto): `Field` pulisce ciò che arriva con `sanitizeNumberInput` — cifre e UN separatore (virgola o punto), niente lettere, spazi o segni — così vale per tutti i campi fatti con `Field`; i due campi senza `Field` (grammi del pasto, quantità delle porzioni) usano la stessa funzione. I campi di testo (nomi, email, password, ricerche) non cambiano. Si è scelto `inputMode` e non `type="number"`: quest'ultimo su iPhone non accetta la virgola in tutti i casi e dà valori vuoti con testo parziale. L'obiettivo dell'acqua si imposta da un pop-up in Oggi (`WaterGoalSheet`, ADR-049: facoltativo, scelto dall'utente) e resta anche nel Profilo.

## Correzioni dopo la revisione del 19/10/2026

**ADR-077 · Sport assegnati per errore: azzerati e scelti dall'utente (correzione #18)**
La migrazione 006 ha eseguito `update public.profiles set sports = '["Palestra", "Calcio"]'` senza `WHERE`: tutti i profili esistenti, tester compresi, hanno ricevuto due sport mai scelti (e dallo step 22 le loro calorie). Decisione di Riccardo: non indovinare. La migrazione 009 azzera gli sport di chi ha ancora esattamente quel valore (anche il titolare, che li riseleziona con un tocco; chi li aveva già cambiati non è toccato), segna `sports_choice_pending = true` e cancella i target di oggi e dei giorni futuri di quei profili, che l'app ricrea come riposo. I giorni passati non si toccano (ADR-039). Alla prima apertura dopo la 009 l'app apre un pannello "Scegli i tuoi sport" (anche nessuno: "Non faccio sport"; "Più tardi" lo rimanda alla prossima apertura) e in Oggi resta un avviso finché non si sceglie; il pannello non si apre sopra il tutorial. **Target mentre lo sport non è scelto:** ogni giorno è riposo, cioè mantenimento con lo scostamento dell'obiettivo, senza calorie di allenamento. Salvare gli sport (nel pannello o nel Profilo) chiude la richiesta e ricalcola il target di oggi.

**ADR-078 · Test end-to-end nel repo con Supabase simulato, e CI (correzione #1)**
I test end-to-end stavano solo nella cartella temporanea della sessione di sviluppo. Ora sono in `tests/e2e/` con `@playwright/test` e `axe-core` (dipendenze **solo di sviluppo**, versioni bloccate, approvate da Riccardo il 19/10). Ambiente: Postgres con tutte le migrazioni vere e uno stub minimo di Supabase (ruoli, `auth.users`, `auth.uid()`), PostgREST 12.2.3 e un'autenticazione simulata nel test (login, registrazione con la hook vera della 005, logout). Alternativa scartata: la CLI di Supabase in locale (più fedele per Auth, ma pesante da avviare in CI e con più parti da aggiornare). Limite dichiarato: l'Auth simulata non prova il vero Supabase Auth (scadenza e rinnovo del token, email); quello resta da provare sull'iPhone. CI su GitHub Actions per ogni PR e per `main`: typecheck, lint, test, build ed end-to-end, senza segreti. Il video della fotocamera per lo scanner si genera durante il test (14 MB, non nel repo).

**ADR-084 · Accessibilità e PWA (revisione #8, #9, #45, #46, #48, #49, #51, #52, #53)**
**#8, #9** `SheetFrame` gestisce il focus (titolo all'apertura, ritorno al pulsante, Tab trattenuto, scorrimento della pagina bloccato) e ha un'altezza massima legata a `100dvh`, alle zone sicure e alla barra, con intestazione ferma e contenuto che scorre; tolto l'aggiramento locale di `MealSlotsSheet`. Limite: con la tastiera aperta su iPhone `dvh` non si riduce (la tastiera copre il pannello senza cambiare il viewport); non risolvibile con il solo CSS in Safari. **#45** `--color-orange-text` → #A35200 (contrasto 5,6:1); la barra arancione resta (2,7:1) perché il valore è scritto come testo. **#46** i grafici usano `var(--color-…)`. **#48** anello di focus verde su campi e scelte a carte (`has-[:focus-visible]`). **#49** il Toast si ferma con il focus o il puntatore, il peso ha un'etichetta che dice "modifica", il tutorial restituisce il focus alla chiusura e l'avviso di aggiornamento sta sopra il tutorial. **#51** zone sicure dello scanner e del banner offline. **#52** il manifest ha `id: '/'`; le schermate di avvio iOS (richiedono uno strumento nuovo) non sono incluse. **#53** il login usa `inputClass` condiviso; email e password sono segnate come sbagliate solo se lo sono (mai per un errore di rete) e la password è collegata al messaggio d'errore. **Non fatto:** **#47** (l'acqua usa il blu che DESIGN riserva a proteine e peso, e DESIGN stesso chiede la barra blu per l'acqua): serve una tua scelta, vedi i punti aperti.

## Punti aperti (rispondere prima dello step indicato)
- **Colore dell'acqua (revisione #47):** DESIGN dice che il blu è di proteine e peso e "non va riusato", ma chiede una barra blu per l'acqua. Opzioni: (a) eccezione esplicita: l'acqua è blu perché è l'acqua; (b) un colore neutro (grigio-azzurro) solo per l'acqua. Va deciso anche per i colori degli allenamenti della Fase 3. Consiglio (a) per l'acqua.
- **Schermate di avvio iOS (revisione #52):** oggi all'apertura dalla Home si vede un attimo lo schermo bianco. Le schermate di avvio si generano con uno strumento nuovo (da approvare). Da decidere se vale la pena.
**ADR-083 · Documenti allineati al codice (revisione #23-#26, #44, #55)**
Nessuna decisione nuova: si toglie ciò che i documenti dicevano e il codice non fa più. L'accesso con codice OTP (step 12) è segnato "superato da ADR-064" ovunque; la tabella degli step arriva al 25; `STATUS.md` e `CLAUDE.md` non fissano più un numero di step; gli ADR sostituiti hanno il rimando a chi li ha sostituiti (003, 024, 028, 033, 047, 050, 067, 068, 073); `TESTING.md`, `DESIGN.md` e `DOMAIN_RULES.md` parlano di sport sommati, 4 sport e livelli di attività al posto di `football`/`both`, bonus unico di 200 kcal, "Giorno calcio +200" e fattore 1,60 di partenza; §8 dice "giorni registrati con un target" e §5 che le soglie sono costanti nel codice; ARCHITECTURE elenca i file veri, la variabile `VITE_PRIVACY_CONTACT` e le migrazioni 001-010 (le nuove con `begin;`/`commit;`). Nel codice: `cleanName` (lib/text.ts) sostituisce due funzioni identiche (`cleanMealName`, `cleanSportName`), e `kcalOf`, usata solo dai test, è rimossa. **Non toccato:** i testi storici dei vecchi step in ROADMAP (descrivono com'era allora).
**ADR-082 · Sicurezza e privacy: anti-clickjacking, privacy legata alle tabelle, funzione del trigger (revisione #19, #21, #28)**
**#19** `vercel.json` aggiunge `X-Frame-Options: DENY` e `Content-Security-Policy: frame-ancestors 'none'`: l'app non si può incorniciare in un altro sito. Una CSP completa non è inclusa di proposito: un errore romperebbe l'app in produzione (Supabase, Open Food Facts, font, fotocamera dello scanner, service worker) e da qui non si può provare sull'iPhone; resta un lavoro a parte. **#21** la pagina Privacy elenca ora i dati da `lib/privacyData.ts`, un `Record<ExportTable, string>`: aggiungere una tabella all'esportazione obbliga a descriverla (errore di compilazione) e l'esportazione è già legata alle tabelle delle migrazioni da un test, quindi una tabella nuova non può più restare fuori dalla pagina. L'informativa ora nomina obiettivo, ritmo del cut, sport, nomi dei pasti, contenitori e tipo di giorno: dati già salvati dagli step 19-22, dopo il consenso dei tester del 9/10. `PRIVACY_VERSION` passa al 19/10/2026 (vale per chi si registra da adesso). **#28** migrazione 010: `revoke execute` su `seed_meal_slots()` come le altre funzioni dei trigger; `rls_two_users.sql` ora controlla che nessuna funzione trigger sia eseguibile da anon/authenticated. **#20** resta un passaggio di Riccardo (eseguire i due controlli sul progetto reale, SECURITY.md).

## Punti aperti (rispondere prima dello step indicato)
- **Consenso dei tester dopo il cambio dell'informativa (ADR-082):** i tester hanno accettato la versione del 9/10; l'informativa ora nomina dati (obiettivo, sport…) che l'app già salvava ma che il testo non diceva. Opzioni: (a) niente, vale dalle nuove registrazioni; (b) un avviso al prossimo accesso con link alla nuova informativa e un tocco su "Ho letto"; (c) riaccettazione obbligatoria. Consiglio (b): è onesto senza bloccare nessuno. Da decidere.
**ADR-081 · Correzioni ai calcoli (revisione #11, #12, #22, #27, #37-#43)**
Dalla revisione del 19/10, tutte in `src/lib/` con test. **#37** `maintenance()` arrotonda all'intero da sola (§2) e i chiamanti non arrotondano più. **#38** l'arrotondamento a 10 kcal della proposta di ricalibrazione non supera più il ±5%: si scende (o si sale) al multiplo di 10 dentro il limite (2843 → 2980, non 2990); un test end-to-end dello step 10 fissava il vecchio comportamento ed è stato corretto. **#39** il peso si arrotonda a 1 decimale prima del controllo 30-250, come i grammi. **#42** `per100gFromServing` e `recipePer100g` restituiscono `null` con un divisore ≤ 0 invece di Infinity/NaN. **#12** l'avviso "carboidrati sotto 3 g/kg" vale solo con obiettivo Massa (`showLowCarbsWarning`; DOMAIN_RULES §3 lo diceva già). **#27** gli avvisi del piano nel Profilo usano `bmr()` di `lib/` e non il mantenimento salvato diviso il fattore: nel giorno di una ricalibrazione accettata i due non coincidono. **#11** la settimana ha una sola riga in `tdee_estimates`: se lunedì era "nessuna" e poi arriva una proposta, quella riga diventa la proposta (`weeklyRowAction`, prima la regola stava nel livello dati, senza test) e la scheda non dice più "Sei nel ritmo voluto" a pendenza fuori banda. **#40** costanti sparse (porzioni, swipe, settimane di ricalibrazione, soglia peso stabile) spostate in `constants.ts`; il deficit del cut mostrato e il numero di settimane non si calcolano più nei componenti. **#41** documentato come limite noto (DOMAIN_RULES §2) invece di cambiare lo schema. **#22/#43** aggiunti i casi di ora legale (marzo 2027, `localHour`, settimane del cambio) e i test mancanti (soglie 80% / 10 pesate / 21 giorni, `planWarnings` cut 1,2%, `isLowCarbs`, `hasKcalMismatch`, `fractionToPercent`, `formatShortDate`, `per100Label`). **Non fatti, aspettano una decisione di Riccardo (regole di dominio, non si inventano):** #13 carboidrati negativi con target molto basso, #14 giorno in corso nelle statistiche di settimana/mese.
**ADR-080 · Riordino dei pasti: pulsanti "Sposta su/giù" come alternativa accessibile (correzione #10)**
Il riordino si faceva solo trascinando o con le frecce della tastiera; VoiceOver su iPhone non invia le frecce, quindi senza tastiera fisica non si poteva riordinare (e `DESIGN.md` diceva il contrario: errore dello step 20). Ora ogni pasto ha due pulsanti veri, "Sposta [pasto] su" e "Sposta [pasto] giù", con annuncio a voce della nuova posizione. **Scelta:** fuori vista finché non hanno il focus, invece che sempre visibili: con matita, X e le due linee la riga sul telefono ha poco spazio per il nome, e chi vede lo schermo ha già il trascinamento. Chi usa VoiceOver, Switch Control o la tastiera li raggiunge normalmente. Alternativa scartata: pulsanti sempre visibili (nome troncato su 390 px) o un "modo spostamento" a più tocchi (più codice e più stati per lo stesso risultato). Limite: Voice Control ("Tocca Sposta giù") può non vedere elementi fuori vista; se serve, si rendono visibili.
**ADR-079 · Salvataggi con id dell'app e inserimento idempotente; salvataggio in attesa visibile (correzione #2)**
Senza rete un salvataggio non falliva: restava "in pausa" (comportamento predefinito di TanStack Query, `networkMode: 'online'`) senza dirlo, e se la richiesta partiva ma la risposta si perdeva, "Riprova" creava una voce doppia. Decisione di Riccardo (19/10): id generato dall'app e inserimento idempotente, progettato una sola volta perché lo riusano anche le sessioni di allenamento (HO_02). **Meccanismo:** `data/ids.ts` (`newId`, e `useAttemptIds`: lo stesso gesto ripetuto, cioè doppio tocco o "Riprova", riusa lo stesso id; dopo un salvataggio riuscito il gesto successivo ne ha uno nuovo) e `data/insertOnce.ts` (`INSERT … ON CONFLICT (id) DO NOTHING` tramite `upsert` con `ignoreDuplicates`). **Nessuna migrazione:** `id uuid default gen_random_uuid()` accetta già un id passato dall'app. **Sicurezza:** serve solo il permesso di inserimento; con l'id di una riga altrui la richiesta non scrive e non rivela niente (provato in `supabase/checks/rls_two_users.sql`). **Dove vale oggi:** voci pasto, acqua e contenitori; cibi e ricette no (un doppione si vede e si cancella, e il codice a barre è già unico). **Attesa:** i salvataggi restano in pausa e partono da soli al ritorno della rete (scelta di Riccardo: niente errore immediato); il banner dice "Salvataggio in attesa… Non chiudere l'app, altrimenti non viene salvato". **Limite dichiarato:** la coda vive solo in memoria; se l'app si chiude prima del ritorno della rete il salvataggio si perde. Alternativa scartata per ora: coda salvata sul telefono (IndexedDB) con ripresa all'avvio, più robusta ma con più casi (conflitti, sessione scaduta, ordine) e una nuova parte da mantenere. Dopo un errore le liste si rileggono (`onSettled`): la voce potrebbe essere stata salvata comunque. **Altri punti della stessa PR:** il profilo non sostituisce più l'app con un errore se solo il ricaricamento in background fallisce (#3); `errorElement` con messaggio italiano e "Riprova" su tutte le rotte (#5); token scaduto (`PGRST301`/`PGRST303`) → messaggio chiaro e rinnovo della sessione, o ritorno al login se rifiutato (#7); nessun caricamento infinito se la lettura iniziale della sessione fallisce (#54); controllo degli aggiornamenti al ritorno nell'app e ogni ora, e "Aggiorna" disattivato mentre un salvataggio è in corso (#4, #50). **Corretto un errore della revisione:** #6 ("Esci" senza rete non fa nulla) non esiste: supabase-js toglie la sessione locale prima di restituire l'errore di rete. Provato con un test, che resta come protezione.

## Punti aperti (rispondere prima dello step indicato)
- **Revisione #13 (carboidrati negativi):** con un target basso (cut) e g/kg alti i carboidrati possono scendere sotto zero e si salvano. Proposta: minimo 0 g, avviso "proteine e grassi superano il target" e, nel database, `check (carbs_g >= 0)`. Serve la tua conferma.
- **Revisione #14 (giorno in corso nelle statistiche):** nella settimana o nel mese in corso il giorno di oggi, ancora a metà, conta come registrato e abbassa la media. Proposta: escludere il giorno in corso dalla media e dai "giorni rispettati" (o mostrarlo "in corso"). Serve la tua conferma.
- **Doppio conteggio allenamenti (step 22):** decidere se ridefinire i livelli di attività (1,2 / 1,375 / 1,55 / 1,725) come "giornata senza allenamento" e lasciare il resto alle calorie degli sport.
- **Fase di osservazione per il cut (facoltativa):** registrare 2-3 settimane di peso e cibo prima di fissare il deficit, usando la ricalibrazione per stimare il vero mantenimento.
- **Open Food Facts (quando vuoi):** per identificarsi come chiede OFF servirebbe uno User-Agent, impossibile dal browser. Opzioni: (a) restare con `app_name` (attuale, va bene per un uso personale con poche richieste); (b) una piccola funzione su Vercel che fa da proxy e imposta lo User-Agent (aggiunge un backend, oggi escluso da ARCHITECTURE). OFF suggerisce anche di compilare il loro modulo "API usage" per non rischiare blocchi.
- **Prestazioni (facoltativo):** pacchetto principale ~745 kB (~216 kB compressi). Misurato: react-dom 204 kB, supabase-js ~200 kB (di cui ~77 kB realtime/storage non usati), codice dell'app 95 kB, react-router 90 kB, zod 81 kB. Tagli possibili: `zod/mini` (stesso pacchetto, riscrivere gli schemi, −60/70 kB) o usare `@supabase/auth-js` + `@supabase/postgrest-js` al posto di supabase-js (−77 kB, ma cambia una dipendenza decisa). Il service worker mette tutto in cache dopo la prima apertura: decidere solo se l'avvio sull'iPhone risulta lento.
- **Step 11 (tuo):** icone dell'app provvisorie (anello bianco su verde, generate allo step 2) e nessuna schermata di avvio iOS dedicata: decidere icona e schermata definitive.
- **Step 11 (tuo):** 2 settimane di uso reale con l'elenco dei problemi (criterio di accettazione).
- **Step 3 (fatto), sessione:** nella PWA verificata alla chiusura e riapertura (8/10/2026). Da annotare: se resta collegata dopo 1 giorno e dopo 1 settimana.
- **Step 10:** valore di `ENERGY_PER_KG` (7700): tenere come costante modificabile e rivalutare dopo qualche mese di dati reali.
- **Precisione della modifica di una voce:** lo snapshot è salvato a 1 decimale (`numeric(7,1)`); correggere una voce registrata con pochissimi grammi (es. 1 g → 100 g) amplifica l'arrotondamento. Soluzione possibile: salvare anche i valori per 100 nello snapshot (nuova migrazione). Da decidere.
- **Una ricalibrazione per settimana:** è garantita dall'app, non dal database (manca un indice unico su `(user_id, week_start)`); con due dispositivi aperti insieme potrebbero nascere due righe. Possibile migrazione futura.
- **Avviso "valori incoerenti" su alimenti quasi a zero calorie (acqua, caffè):** §9 applicato alla lettera dà sempre l'avviso. Da decidere se ignorare il controllo sotto una soglia.
